package com.anonymous.breakloopv0

import com.anonymous.breakloopv0.ForegroundDetectionService.Companion.QuickTaskState

/**
 * PURE decision logic for M3a refactor.
 * No side effects, no state mutation, no dependencies on Service/Context.
 */
object DecisionGate {

    sealed class GateAction {
        object StartQuickTask : GateAction()
        object StartIntervention : GateAction()
        object NoAction : GateAction()
    }

    data class GateSnapshot(
        val isMonitored: Boolean,
        val qtRemaining: Int,
        val isSystemSurfaceActive: Boolean,
        val hasActiveSession: Boolean, // New: Per-App Active Session Check
        val quickTaskState: QuickTaskState,
        val intentionRemainingMs: Long,
        val isInterventionPreserved: Boolean,
        val lastInterventionEmittedAt: Long,
        val isQuitSuppressed: Boolean,
        val quitSuppressionRemainingMs: Long,
        val isWakeSuppressed: Boolean,
        val wakeSuppressionRemainingMs: Long,
        val isForceEntry: Boolean
    )

    object Reason {
        const val START_INTERVENTION_PRESERVED = "START_INTERVENTION_PRESERVED"
        const val START_INTERVENTION_RESUME = "START_INTERVENTION_RESUME"
        const val DEBOUNCE_INTERVENTION = "DEBOUNCE_INTERVENTION"
        const val SURFACE_ACTIVE = "SURFACE_ACTIVE"
        const val ALREADY_ACTIVE_SESSION = "ALREADY_ACTIVE_SESSION"
        const val QT_OFFERING_ACTIVE = "QT_OFFERING_ACTIVE"
        const val POST_CHOICE_ACTIVE = "POST_CHOICE_ACTIVE"
        const val T_QUICK_TASK_ACTIVE = "T_QUICK_TASK_ACTIVE"
        const val QUOTA_ZERO = "QUOTA_ZERO"
        const val SUPPRESSION_QUIT = "SUPPRESSION_QUIT"
        const val SUPPRESSION_WAKE = "SUPPRESSION_WAKE"
        const val START_QUICK_TASK = "START_QUICK_TASK"
        const val START_INTERVENTION = "START_INTERVENTION"
        const val NOT_MONITORED = "NOT_MONITORED"
        const val T_INTENTION_ACTIVE = "T_INTENTION_ACTIVE"
    }

    /**
     * PURE FUNCTION: Evaluate entry + return Action & Reason.
     * Does NOT emit commands or mutate state.
     */
    fun evaluate(pkg: String, nowMs: Long, s: GateSnapshot, disallowQuickTask: Boolean = false): Pair<GateAction, String> {
        // 1. Not Monitored (Implicit Guard)
        if (!s.isMonitored) return GateAction.NoAction to Reason.NOT_MONITORED

        // 2. Active Session Check (ACTIVE map only - not OFFERING)
        // "Active Session rule": If we have an ACTIVE session, we are already handling this app.
        if (s.hasActiveSession) return GateAction.NoAction to Reason.ALREADY_ACTIVE_SESSION
        
        // 3. Post Choice Block (Specific State Guard)
        if (s.quickTaskState == QuickTaskState.POST_CHOICE) {
            return GateAction.NoAction to Reason.POST_CHOICE_ACTIVE
        }

        // 4. OFFERING Block (Prompt already shown)
        // Prevents duplicate offers even if surface flags get weird
        if (s.quickTaskState == QuickTaskState.OFFERING) {
            return GateAction.NoAction to Reason.QT_OFFERING_ACTIVE
        }

        // 5. Intention Suppression (Highest User Priority)
        // If user has an active intention, suppress EVERYTHING.
        if (s.intentionRemainingMs > 0) {
            return GateAction.NoAction to "${Reason.T_INTENTION_ACTIVE}_${s.intentionRemainingMs}ms"
        }

        // 6. Preservation / Resumption (Intervention Priority)
        
        // 6a. Preservation Override
        if (s.isInterventionPreserved) {
             if (nowMs - s.lastInterventionEmittedAt < 800) {
                 return GateAction.NoAction to Reason.DEBOUNCE_INTERVENTION
             }
             return GateAction.StartIntervention to Reason.START_INTERVENTION_PRESERVED
        }
        
        // 6b. Intervention Active (Resumption)
        if (s.quickTaskState == QuickTaskState.INTERVENTION_ACTIVE) {
             // In V3, we treat this as a signal to Resume Intervention
             return GateAction.StartIntervention to Reason.START_INTERVENTION_RESUME
        }

        // 7. Quick Task Active Check (Timer Running)
        // Check if QT timer is actively running (not just state)
        // This is checked via the entry's expiresAt or similar mechanism
        // For now, we rely on ACTIVE state being caught by hasActiveSession above
        // But we add explicit check for any other "active QT" scenarios
        if (s.quickTaskState == QuickTaskState.ACTIVE) {
             return GateAction.NoAction to Reason.T_QUICK_TASK_ACTIVE
        }

        // 8. Suppressions (Quit/Wake)
        if (s.isQuitSuppressed && !s.isForceEntry) {
            if (s.quitSuppressionRemainingMs > 0) {
                return GateAction.NoAction to "${Reason.SUPPRESSION_QUIT}_${s.quitSuppressionRemainingMs}ms"
            }
        }
        
        if (s.isWakeSuppressed && !s.isForceEntry) {
            if (s.wakeSuppressionRemainingMs > 0) {
                 return GateAction.NoAction to "${Reason.SUPPRESSION_WAKE}_${s.wakeSuppressionRemainingMs}ms"
            }
        }

        // 9. Global Surface Check (After all per-app checks)
        // "Global Surface rule": If ANY surface is active, we validly block entry to avoid visual pile-up.
        if (s.isSystemSurfaceActive) return GateAction.NoAction to Reason.SURFACE_ACTIVE

        // 10. Quick Task Decision
        // If Quota > 0 AND NOT disallowed -> Start QT
        if (!disallowQuickTask && s.qtRemaining > 0) {
            return GateAction.StartQuickTask to Reason.START_QUICK_TASK
        }
        
        // 11. Intervention Fallback (Quota 0 or Disallowed)
        // If we reached here, we are eligible for intervention (no intention, no suppression).
        return GateAction.StartIntervention to Reason.START_INTERVENTION
    }
}
