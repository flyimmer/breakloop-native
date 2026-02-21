package com.anonymous.breakloopnative

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * SystemBrainBridge — Track B native-side event pipeline.
 *
 * Receives RuntimeEvents from ForegroundDetectionService and runs:
 *   FG_ENTRY: PendingReturnContext check → DecisionGate → SurfaceRouter
 *   APP_EXIT: SurfaceRouter.closeSurface → SessionManager cleanup
 *
 * Single-threaded event queue on mainHandler (matches existing FDS threading model).
 * Keeps SystemBrainService (HeadlessJsTaskService) untouched.
 *
 * Log tags:
 *   BRAIN_ENTRY  — ForegroundEntry pipeline
 *   BRAIN_EXIT   — AppExit pipeline
 *   BRAIN_RETURN — PendingReturnContext consumption
 */
object SystemBrainBridge {

    private const val TAG = "BRAIN"
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Holds app context for launching surfaces; set during FDS init
    @Volatile private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
        Log.i(TAG, "[INIT] SystemBrainBridge ready")
    }

    // ── Public entry point: called from FDS ──

    fun enqueue(event: RuntimeEvent) {
        mainHandler.post { handleEvent(event) }
    }

    // ── Private handler (always on main thread) ──

    private fun handleEvent(event: RuntimeEvent) {
        when (event) {
            is RuntimeEvent.ForegroundEntry -> handleForegroundEntry(event.app)
            is RuntimeEvent.AppExit         -> handleAppExit(event.app)
            is RuntimeEvent.TimerExpired    -> handleTimerExpired(event)
            is RuntimeEvent.UserActionEvent -> {
                // Delegated to SurfaceRouter
                SurfaceRouter.handleUserAction(
                    event.surfaceId, event.actionId, event.sessionId, event.payload
                )
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FG_ENTRY pipeline
    // ─────────────────────────────────────────────────────────────

    private fun handleForegroundEntry(app: String) {
        val ctx = appContext ?: run {
            Log.w(TAG, "[BRAIN_ENTRY] No context, skip app=$app")
            return
        }

        Log.i(TAG, "[BRAIN_ENTRY] app=$app")

        // ── Step 0: PendingReturnContext check (§9.3, takes priority over DecisionGate) ──
        scope.launch {
            val consumeResult = ReturnContextStoreHolder.store?.consumePendingForApp(app)

            mainHandler.post {
                when (consumeResult) {
                    is ReturnContextStore.ConsumeResult.Success -> {
                        val rc = consumeResult.context
                        Log.i(TAG, "[BRAIN_RETURN] Consumed pending id=${rc.contextId} cp=${rc.sourceCheckpoint} app=$app")
                        // Single-surface check before showing checkpoint
                        if (!enforceMaxOneSurface(app, SessionManager.Kind.CHECKPOINT)) return@post
                        val model = InterventionFlowController.showCheckpoint(
                            app = app,
                            sessionId = SessionManager.getCurrentSessionId() ?: rc.sessionId,
                            cpNumber = rc.sourceCheckpoint
                        )
                        SurfaceRouter.render(ctx, model)
                    }
                    is ReturnContextStore.ConsumeResult.Expired -> {
                        Log.i(TAG, "[BRAIN_RETURN] Pending expired → toast + fresh DecisionGate app=$app")
                        // TODO: show toast "Session expired. Your next check-in will start fresh."
                        runDecisionGatePipeline(app, ctx)
                    }
                    is ReturnContextStore.ConsumeResult.WrongApp -> {
                        // Pending exists but for a different app, run normal pipeline
                        Log.d(TAG, "[BRAIN_RETURN] WrongApp (app=$app) → normal DecisionGate")
                        runDecisionGatePipeline(app, ctx)
                    }
                    is ReturnContextStore.ConsumeResult.NoPending, null -> {
                        // Normal path
                        runDecisionGatePipeline(app, ctx)
                    }
                }
            }
        }
    }

    private fun runDecisionGatePipeline(app: String, ctx: Context) {
        // Build snapshot using FDS companion (single source of truth for existing state)
        val snapshot = ForegroundDetectionService.buildBridgeSnapshot(app)

        val now = System.currentTimeMillis()
        val (decision, reason) = DecisionGate.evaluate(app, now, snapshot)

        Log.i(TAG, "[BRAIN_GATE] app=$app decision=${decision.javaClass.simpleName} reason=$reason")

        when (decision) {
            is DecisionGate.GateAction.ShowHardBreak -> {
                Log.i(TAG, "[BRAIN_GATE→HARD_BREAK] app=$app")
                if (!enforceMaxOneSurface(app, SessionManager.Kind.HARD_BREAK)) return
                val sessionId = SessionManager.getCurrentSessionId() ?: return
                val model = SurfaceModel(
                    surfaceId = SurfaceRouter.Surface.HARD_BREAK,
                    renderer = Renderer.COMPOSE,
                    app = app,
                    sessionId = sessionId
                )
                SurfaceRouter.render(ctx, model)
            }
            is DecisionGate.GateAction.StartIntervention -> {
                Log.i(TAG, "[BRAIN_GATE→INTERVENTION] app=$app")
                if (!enforceMaxOneSurface(app, SessionManager.Kind.INTERVENTION)) return
                val sessionId = SessionManager.getCurrentSessionId() ?: return
                val model = InterventionFlowController.start(app, sessionId)
                SurfaceRouter.render(ctx, model)
            }
            is DecisionGate.GateAction.StartQuickTask -> {
                // Delegated to existing FDS QT path — Bridge doesn't duplicate QT logic
                Log.d(TAG, "[BRAIN_GATE→QT] app=$app — delegated to FDS legacy QT path")
                // No action from bridge; FDS already handles QT
            }
            is DecisionGate.GateAction.NoAction -> {
                Log.d(TAG, "[BRAIN_GATE→NO_ACTION] app=$app reason=$reason")
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // APP_EXIT pipeline (§9.4 Rule 1)
    // ─────────────────────────────────────────────────────────────

    private fun handleAppExit(app: String) {
        Log.i(TAG, "[BRAIN_EXIT] app=$app")

        val session = SessionManager.getCurrentSession()
        if (session == null || session.pkg != app) {
            Log.d(TAG, "[BRAIN_EXIT] No session for app=$app (current=${session?.pkg})")
            return
        }

        SurfaceRouter.closeSurface("APP_EXIT_$app")
        InterventionFlowController.clearFlow(app)
        Log.i(TAG, "[BRAIN_EXIT] Closed surface + cleared flow for app=$app session=${session.sessionId}")
    }

    // ─────────────────────────────────────────────────────────────
    // TIMER_EXPIRED pipeline (P4)
    // ─────────────────────────────────────────────────────────────

    private fun handleTimerExpired(event: RuntimeEvent.TimerExpired) {
        Log.i(TAG, "[BRAIN_TIMER] kind=${event.kind} app=${event.app} expected=${event.expectedUntilMs}")

        if (event.kind != TimerKind.INTENTION) {
            Log.d(TAG, "[BRAIN_TIMER] Non-INTENTION timer, ignoring for now")
            return
        }

        val app = event.app
        val ctx = appContext ?: run {
            Log.w(TAG, "[BRAIN_TIMER] No context, skip")
            return
        }

        // Stale guard: expectedUntilMs must match persisted IntentionStore value
        val storedUntilMs = IntentionStoreHolder.store?.getIntention(app) ?: 0L
        if (event.expectedUntilMs != storedUntilMs) {
            Log.w(TAG, "[TIMER_STALE] expected=${event.expectedUntilMs} stored=$storedUntilMs — rejected")
            return
        }

        // Foreground gate: only act if app is currently foreground
        val currentFg = ForegroundDetectionService.getCurrentForegroundApp()
        if (currentFg != app) {
            Log.i(TAG, "[TIMER_OFFSCREEN] app=$app not fg (current=$currentFg) — skipping")
            return
        }

        // Invariants met → increment checkpointCount + show CP surface
        scope.launch {
            val cpCount = InterventionRunStoreHolder.store?.incrementCheckpointCount(app) ?: 1
            IntentionStoreHolder.store?.clearIntention(app)  // Timer consumed

            mainHandler.post {
                val hardBreakEnabled = false // TODO P8: read from settings
                if (!enforceMaxOneSurface(app, SessionManager.Kind.CHECKPOINT)) return@post
                val sessionId = SessionManager.getCurrentSessionId() ?: return@post
                val model = InterventionFlowController.showCheckpoint(app, sessionId, cpCount)
                // Enrich with CP-specific props
                val enrichedModel = model.copy(props = model.props + mapOf(
                    "hardBreakEnabled" to hardBreakEnabled,
                    "availableTimers" to computeAvailableTimers(cpCount)
                ))
                SurfaceRouter.render(ctx, enrichedModel)
                Log.i(TAG, "[BRAIN_CP] app=$app cp=$cpCount hardBreak=$hardBreakEnabled session=$sessionId")
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Timer Scheduling (P4/P5)
    // ─────────────────────────────────────────────────────────────

    /**
     * Schedule an intention timer. Called from AppMonitorModule (JS bridge).
     * Persists untilMs in IntentionStore, then posts a delayed callback.
     */
    fun scheduleIntentionTimer(app: String, durationMs: Long) {
        val untilMs = System.currentTimeMillis() + durationMs
        scope.launch {
            IntentionStoreHolder.store?.setIntention(app, untilMs)
        }
        mainHandler.postDelayed({
            enqueue(RuntimeEvent.TimerExpired(TimerKind.INTENTION, app, untilMs))
        }, durationMs)
        Log.i(TAG, "[TIMER_SCHEDULE] app=$app duration=${durationMs / 1000}s until=$untilMs")
    }

    /**
     * P5: Compute available timer presets based on checkpointCount.
     * Returns comma-separated minutes: "1,5,15,30,45"
     */
    fun computeAvailableTimers(cpCount: Int): String {
        return when {
            cpCount >= 3 -> "1,5"
            cpCount == 2 -> "1,5,15"
            cpCount == 1 -> "1,5,15,30"
            else         -> "1,5,15,30,45"
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /** Launch the device home screen. Used by IFC on QUIT. */
    fun launchHome() {
        try {
            val ctx = appContext ?: return
            val homeIntent = android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
                addCategory(android.content.Intent.CATEGORY_HOME)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(homeIntent)
            Log.i(TAG, "[LAUNCH_HOME] Sent to home screen")
        } catch (e: Exception) {
            Log.w(TAG, "[LAUNCH_HOME] Failed: ${e.message}")
        }
    }

    /** Returns false if single-surface invariant violated; logs the suppression. */
    private fun enforceMaxOneSurface(app: String, kind: SessionManager.Kind): Boolean {
        val decision = SessionManager.tryStart(app, kind, System.currentTimeMillis())
        return when (decision) {
            is SessionManager.StartDecision.Start -> true
            is SessionManager.StartDecision.Suppress -> {
                Log.i(TAG, "[BRAIN_SINGLE_SURFACE] Suppressed kind=$kind app=$app reason=${decision.reason}")
                false
            }
        }
    }
}

/**
 * Lazy singleton holders for stores.
 * Initialized alongside FDS stores in onServiceConnected.
 */
object ReturnContextStoreHolder {
    @Volatile var store: ReturnContextStore? = null
}

object IntentionStoreHolder {
    @Volatile var store: IntentionStore? = null
}

object InterventionRunStoreHolder {
    @Volatile var store: InterventionRunStore? = null
}
