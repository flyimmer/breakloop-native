package com.anonymous.breakloopnative

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Track B §2.1: InterventionFlowController
 *
 * Full intervention state machine:
 *   Breathing → Purpose/FastLane/Timebox → Checkpoints → Support Ladder
 *
 * Pure state transitions. Produces SurfaceModel for SurfaceRouter to render.
 * Replaces FDS.Companion.interventionFlowByApp (marked legacy).
 */
object InterventionFlowController {

    private const val TAG = "IFC"

    // ── Intervention Flow States ──
    enum class FlowState {
        IDLE,
        BREATHING,
        PURPOSE_PICKER,
        FAST_LANE_ENTRY,
        TIMEBOX,
        ACTIVE_INTENTION,       // User is in purchased time
        CHECKPOINT,             // Timer expired, showing CP screen
        SUPPORT_TRIGGER,
        SUPPORT_MICRO_WHY,
        SUPPORT_ALTERNATIVES,   // Deep-linked to main app
        HARD_BREAK              // Delegated to HardBreakController
    }

    // Per-app flow state
    data class FlowContext(
        val app: String,
        val state: FlowState = FlowState.IDLE,
        val sessionId: String = "",
        val cpNumber: Int = 0           // Current checkpoint being shown
    )

    // In-memory state (authoritative, replaces FDS.interventionFlowByApp)
    private val flowByApp = mutableMapOf<String, FlowContext>()

    // ── Start Intervention ──

    fun start(app: String, sessionId: String): SurfaceModel {
        val flow = FlowContext(app = app, state = FlowState.BREATHING, sessionId = sessionId)
        flowByApp[app] = flow
        Log.i(TAG, "[START] app=$app session=$sessionId → BREATHING")
        return buildModel(flow, SurfaceRouter.Surface.BREATHING)
    }

    // ── State Queries ──

    fun getFlowState(app: String): FlowState {
        return flowByApp[app]?.state ?: FlowState.IDLE
    }

    fun isActive(app: String): Boolean {
        val state = getFlowState(app)
        return state != FlowState.IDLE
    }

    // ── Checkpoint Entry (called by SystemBrainService on timer expiry) ──

    fun showCheckpoint(app: String, sessionId: String, cpNumber: Int): SurfaceModel {
        val flow = FlowContext(app = app, state = FlowState.CHECKPOINT, sessionId = sessionId, cpNumber = cpNumber)
        flowByApp[app] = flow
        Log.i(TAG, "[CHECKPOINT] app=$app cp=$cpNumber session=$sessionId")
        return buildModel(flow, SurfaceRouter.Surface.CHECKPOINT, mapOf(
            "checkpointCount" to cpNumber
        ))
    }

    // ── UserAction Handler ──

    fun onUserAction(surfaceId: String, actionId: String, sessionId: String, payload: String?) {
        Log.i(TAG, "[USER_ACTION] surface=$surfaceId action=$actionId session=$sessionId")

        // Find the flow context for this session
        val flow = flowByApp.values.find { it.sessionId == sessionId }
        if (flow == null) {
            Log.w(TAG, "[USER_ACTION] No flow for session=$sessionId")
            return
        }

        // State transitions based on surface + action
        // These will be fully wired in P4-P6
        when (surfaceId) {
            SurfaceRouter.Surface.BREATHING -> handleBreathingAction(flow, actionId)
            SurfaceRouter.Surface.CHECKPOINT -> handleCheckpointAction(flow, actionId, payload)
            SurfaceRouter.Surface.TIMEBOX -> handleTimeboxAction(flow, actionId, payload)
            SurfaceRouter.Surface.PURPOSE_PICKER -> handlePurposeAction(flow, actionId, payload)
            SurfaceRouter.Surface.FAST_LANE_ENTRY -> handleFastLaneAction(flow, actionId, payload)
            else -> Log.w(TAG, "[USER_ACTION] Unhandled surface=$surfaceId for IFC")
        }
    }

    // ── Action Handlers (stubs for P4-P6 wiring) ──

    private fun handleBreathingAction(flow: FlowContext, actionId: String) {
        when (actionId) {
            "BREATHING_COMPLETE" -> {
                // Transition to Purpose/FastLane/Timebox based on purposeRequired
                // For now, go directly to Timebox (legacy behavior)
                val updated = flow.copy(state = FlowState.TIMEBOX)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[BREATHING→TIMEBOX] app=${flow.app}")
            }
            "QUIT" -> {
                clearFlow(flow.app)
                Log.i(TAG, "[BREATHING→QUIT] app=${flow.app}")
            }
        }
    }

    private fun handleCheckpointAction(flow: FlowContext, actionId: String, payload: String?) {
        when (actionId) {
            "SET_TIMER" -> {
                // User chose a timer at checkpoint → schedule native intention timer
                val minutes = payload?.toIntOrNull() ?: 5
                val durationMs = minutes * 60L * 1000L
                SystemBrainBridge.scheduleIntentionTimer(flow.app, durationMs)
                val updated = flow.copy(state = FlowState.ACTIVE_INTENTION)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[CP→ACTIVE_INTENTION] app=${flow.app} cp=${flow.cpNumber} timer=${minutes}m")
                // Close checkpoint surface — user returns to their app
                SurfaceRouter.closeSurface("CP_SET_TIMER")
            }
            "HELP_ME" -> {
                // Enter support ladder (stub for P10)
                val updated = flow.copy(state = FlowState.SUPPORT_TRIGGER)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[CP→SUPPORT] app=${flow.app}")
                // TODO P10: SurfaceRouter.render(ctx, supportModel)
            }
            "QUIT" -> {
                Log.i(TAG, "[CP→QUIT] app=${flow.app}")
                SurfaceRouter.closeSurface("USER_QUIT_CP")
                clearFlow(flow.app)
                // Clear run state for this app (fresh on next intervention)
                CoroutineScope(Dispatchers.Main + SupervisorJob()).launch {
                    InterventionRunStoreHolder.store?.clearRunState(flow.app)
                }
                // Send user to home screen
                SystemBrainBridge.launchHome()
            }
        }
    }

    private fun handleTimeboxAction(flow: FlowContext, actionId: String, payload: String?) {
        when (actionId) {
            "START_TIMER" -> {
                val updated = flow.copy(state = FlowState.ACTIVE_INTENTION)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[TIMEBOX→ACTIVE_INTENTION] app=${flow.app}")
            }
            "QUIT" -> {
                clearFlow(flow.app)
            }
        }
    }

    private fun handlePurposeAction(flow: FlowContext, actionId: String, payload: String?) {
        when (actionId) {
            "PURPOSE_SELECTED" -> {
                val updated = flow.copy(state = FlowState.TIMEBOX)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[PURPOSE→TIMEBOX] app=${flow.app}")
            }
        }
    }

    private fun handleFastLaneAction(flow: FlowContext, actionId: String, payload: String?) {
        when (actionId) {
            "CONFIRM_PURPOSE" -> {
                val updated = flow.copy(state = FlowState.TIMEBOX)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[FAST_LANE→TIMEBOX] app=${flow.app}")
            }
            "CHANGE_PURPOSE" -> {
                val updated = flow.copy(state = FlowState.PURPOSE_PICKER)
                flowByApp[flow.app] = updated
                Log.i(TAG, "[FAST_LANE→PURPOSE] app=${flow.app}")
            }
        }
    }

    // ── Cleanup ──

    fun clearFlow(app: String) {
        flowByApp.remove(app)
        Log.i(TAG, "[CLEAR] app=$app")
    }

    fun clearAll() {
        flowByApp.clear()
        Log.i(TAG, "[CLEAR_ALL]")
    }

    // ── Model Builder ──

    private fun buildModel(
        flow: FlowContext,
        surfaceId: String,
        extraProps: Map<String, Any> = emptyMap()
    ): SurfaceModel {
        return SurfaceModel(
            surfaceId = surfaceId,
            renderer = SurfaceRouter.getRenderer(surfaceId),
            app = flow.app,
            sessionId = flow.sessionId,
            props = extraProps
        )
    }
}
