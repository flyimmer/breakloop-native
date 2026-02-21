package com.anonymous.breakloopnative

import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Track B §4: SurfaceRouter
 *
 * Routes GateAction → correct controller.
 * Routes UserAction → correct handler.
 * Decides render target (Compose / RN) per surface ID.
 * Enforces single-surface via SessionManager.
 *
 * Option A: Separate Activities (§4.4)
 * - SystemSurfaceActivity (existing) for RN screens
 * - SystemSurfaceActivityCompose (new) for Compose screens
 */
object SurfaceRouter {

    private const val TAG = "SURFACE_ROUTER"

    // ── Surface ID constants ──
    object Surface {
        // RN surfaces
        const val BREATHING = "BREATHING"
        const val FAST_LANE_ENTRY = "FAST_LANE_ENTRY"
        const val PURPOSE_PICKER = "PURPOSE_PICKER"
        const val TIMEBOX = "TIMEBOX"
        const val SUPPORT_TRIGGER = "SUPPORT_TRIGGER"
        const val SUPPORT_MICRO_WHY = "SUPPORT_MICRO_WHY"
        const val QUICK_TASK_OFFERING = "QUICK_TASK_OFFERING"
        const val POST_QT_CHOICE = "POST_QT_CHOICE"

        // Compose surfaces
        const val CHECKPOINT = "CHECKPOINT"           // CP1-4, cpNumber in props
        const val HARD_BREAK = "HARD_BREAK"
        const val EMERGENCY_CHOOSER = "EMERGENCY_CHOOSER"
        const val FACE_DOWN_CHALLENGE = "FACE_DOWN_CHALLENGE"
        const val EMERGENCY_TIMER = "EMERGENCY_TIMER"
    }

    // ── Renderer mapping (§4.1) ──
    private val rendererMap = mapOf(
        Surface.BREATHING to Renderer.RN,
        Surface.FAST_LANE_ENTRY to Renderer.RN,
        Surface.PURPOSE_PICKER to Renderer.RN,
        Surface.TIMEBOX to Renderer.RN,
        Surface.SUPPORT_TRIGGER to Renderer.RN,
        Surface.SUPPORT_MICRO_WHY to Renderer.RN,
        Surface.QUICK_TASK_OFFERING to Renderer.RN,
        Surface.POST_QT_CHOICE to Renderer.RN,

        Surface.CHECKPOINT to Renderer.COMPOSE,
        Surface.HARD_BREAK to Renderer.COMPOSE,
        Surface.EMERGENCY_CHOOSER to Renderer.COMPOSE,
        Surface.FACE_DOWN_CHALLENGE to Renderer.COMPOSE,
        Surface.EMERGENCY_TIMER to Renderer.COMPOSE,
    )

    fun getRenderer(surfaceId: String): Renderer {
        return rendererMap[surfaceId] ?: Renderer.RN // Default to RN for unknown
    }

    // ── Launch surface (§4.4: separate activities) ──

    fun render(context: Context, model: SurfaceModel) {
        val renderer = model.renderer
        Log.i(TAG, "[RENDER] surface=${model.surfaceId} renderer=$renderer app=${model.app} session=${model.sessionId}")

        when (renderer) {
            Renderer.RN -> launchRnSurface(context, model)
            Renderer.COMPOSE -> launchComposeSurface(context, model)
        }
    }

    private fun launchRnSurface(context: Context, model: SurfaceModel) {
        // Map surfaceId to legacy wakeReason for backward compat with existing RN screens
        val wakeReason = mapSurfaceIdToWakeReason(model.surfaceId)

        val intent = Intent(context, SystemSurfaceActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(SystemSurfaceActivity.EXTRA_TRIGGERING_APP, model.app)
            putExtra(SystemSurfaceActivity.EXTRA_WAKE_REASON, wakeReason)
            putExtra(SystemSurfaceActivity.EXTRA_SESSION_ID, model.sessionId)
            // Pass additional props as extras
            model.props.forEach { (key, value) ->
                when (value) {
                    is String -> putExtra("prop_$key", value)
                    is Int -> putExtra("prop_$key", value)
                    is Long -> putExtra("prop_$key", value)
                    is Boolean -> putExtra("prop_$key", value)
                }
            }
        }
        context.startActivity(intent)
        Log.i(TAG, "[LAUNCH_RN] wakeReason=$wakeReason app=${model.app}")
    }

    private fun launchComposeSurface(context: Context, model: SurfaceModel) {
        val intent = Intent(context, SystemSurfaceActivityCompose::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(SystemSurfaceActivityCompose.EXTRA_SURFACE_ID, model.surfaceId)
            putExtra(SystemSurfaceActivityCompose.EXTRA_APP, model.app)
            putExtra(SystemSurfaceActivityCompose.EXTRA_SESSION_ID, model.sessionId)
            // Pass props as extras
            model.props.forEach { (key, value) ->
                when (value) {
                    is String -> putExtra("prop_$key", value)
                    is Int -> putExtra("prop_$key", value)
                    is Long -> putExtra("prop_$key", value)
                    is Boolean -> putExtra("prop_$key", value)
                }
            }
        }
        context.startActivity(intent)
        Log.i(TAG, "[LAUNCH_COMPOSE] surface=${model.surfaceId} app=${model.app}")
    }

    // ── Close surface (§9.4 Rule 1: OnAppExit) ──

    fun closeSurface(reason: String) {
        // 1. End SessionManager state first (authoritative)
        val session = SessionManager.getCurrentSession()
        if (session != null) {
            SessionManager.endSession(session.sessionId, reason)
            Log.i(TAG, "[CLOSE_SURFACE] session=${session.sessionId} app=${session.pkg} reason=$reason")
        } else {
            Log.i(TAG, "[CLOSE_SURFACE] no active session, closing activities anyway reason=$reason")
        }
        // 2. Finish activities (best-effort cleanup)
        SystemSurfaceManager.requestClose(session?.sessionId ?: "unknown", reason)
        SystemSurfaceActivityCompose.finishIfActive(reason)
    }

    // ── UserAction routing ──

    fun handleUserAction(surfaceId: String, actionId: String, sessionId: String, payload: String?) {
        Log.i(TAG, "[USER_ACTION] surface=$surfaceId action=$actionId session=$sessionId")
        // Route to appropriate controller based on surfaceId
        // This will be wired in P4-P11 as controllers are built
        when (surfaceId) {
            Surface.CHECKPOINT,
            Surface.BREATHING,
            Surface.FAST_LANE_ENTRY,
            Surface.PURPOSE_PICKER,
            Surface.TIMEBOX -> {
                // InterventionFlowController handles
                InterventionFlowController.onUserAction(surfaceId, actionId, sessionId, payload)
            }
            Surface.HARD_BREAK,
            Surface.EMERGENCY_CHOOSER,
            Surface.FACE_DOWN_CHALLENGE,
            Surface.EMERGENCY_TIMER -> {
                // HardBreakController handles (to be wired in P8)
                Log.i(TAG, "[USER_ACTION] HardBreak flow — action=$actionId (controller pending P8)")
            }
            Surface.SUPPORT_TRIGGER,
            Surface.SUPPORT_MICRO_WHY -> {
                // SupportLadderController handles (to be wired in P10)
                Log.i(TAG, "[USER_ACTION] Support flow — action=$actionId (controller pending P10)")
            }
            else -> {
                Log.w(TAG, "[USER_ACTION] Unknown surface: $surfaceId")
            }
        }
    }

    // ── Helpers ──

    private fun mapSurfaceIdToWakeReason(surfaceId: String): String {
        return when (surfaceId) {
            Surface.BREATHING -> SystemSurfaceActivity.WAKE_REASON_SHOW_INTERVENTION_BREATHING
            Surface.QUICK_TASK_OFFERING -> SystemSurfaceActivity.WAKE_REASON_SHOW_QUICK_TASK
            Surface.POST_QT_CHOICE -> SystemSurfaceActivity.WAKE_REASON_SHOW_POST_QUICK_TASK_CHOICE
            Surface.TIMEBOX -> "SHOW_TIMEBOX"
            Surface.FAST_LANE_ENTRY -> "SHOW_FAST_LANE_ENTRY"
            Surface.PURPOSE_PICKER -> "SHOW_PURPOSE_PICKER"
            Surface.SUPPORT_TRIGGER -> "SHOW_SUPPORT_TRIGGER"
            Surface.SUPPORT_MICRO_WHY -> "SHOW_SUPPORT_MICRO_WHY"
            else -> SystemSurfaceActivity.WAKE_REASON_SHOW_INTERVENTION
        }
    }
}
