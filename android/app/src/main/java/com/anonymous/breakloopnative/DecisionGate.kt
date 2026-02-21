package com.anonymous.breakloopnative

import com.anonymous.breakloopnative.ForegroundDetectionService.Companion.QuickTaskState

/**
 * PURE decision logic — Track B V2.
 * No side effects, no state mutation, no dependencies on Service/Context.
 *
 * Decision priority (§3.2):
 *   0. !isMonitored        → NoAction
 *   1. hardBreakActive     → ShowHardBreak  (emergencyAllow overrides → treat as intention)
 *   2. hasActiveSession    → NoAction
 *   3. surface active      → NoAction
 *   4. intention active    → NoAction
 *   5. QT running          → NoAction
 *   6. QT quota > 0        → StartQuickTask
 *   7. otherwise           → StartIntervention
 */
object DecisionGate {

    sealed class GateAction {
        object StartQuickTask : GateAction()
        object StartIntervention : GateAction()
        object ShowHardBreak : GateAction()      // Track B: Hard Break override
        object NoAction : GateAction()
    }

    data class GateSnapshot(
        val isMonitored: Boolean,
        // ── Track B: Hard Break (highest priority) ──
        val hardBreakActive: Boolean = false,       // now < hardBreakUntil(A)
        val emergencyAllowActive: Boolean = false,  // now < emergencyAllowUntil(A)
        // ── Existing fields ──
        val qtRemaining: Int,
        val isSystemSurfaceActive: Boolean,
        val hasActiveSession: Boolean,
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
        // Track B
        const val HARD_BREAK_ACTIVE = "HARD_BREAK_ACTIVE"
        const val HARD_BREAK_EMERGENCY_ALLOW = "HARD_BREAK_EMERGENCY_ALLOW"
    }

    /**
     * PURE FUNCTION: Evaluate entry + return Action & Reason.
     * Does NOT emit commands or mutate state.
     */
    fun evaluate(pkg: String, nowMs: Long, s: GateSnapshot, disallowQuickTask: Boolean = false): Pair<GateAction, String> {
        // 1. Not Monitored (Implicit Guard)
        if (!s.isMonitored) return GateAction.NoAction to Reason.NOT_MONITORED

        // ── Track B Row 0: Hard Break (highest priority override) ──
        // If Hard Break is active AND emergency allow is NOT active → show Hard Break UI
        // If Hard Break is active BUT emergency allow IS active → treat as intention-active (pass-through)
        if (s.hardBreakActive) {
            if (s.emergencyAllowActive) {
                // Emergency unlock purchased time — treat like an active intention
                return GateAction.NoAction to Reason.HARD_BREAK_EMERGENCY_ALLOW
            }
            return GateAction.ShowHardBreak to Reason.HARD_BREAK_ACTIVE
        }

        // 2. Active Session Check (ACTIVE map only - not OFFERING)
        if (s.hasActiveSession) return GateAction.NoAction to Reason.ALREADY_ACTIVE_SESSION
        
        // 3. Post Choice Block (Specific State Guard)
        if (s.quickTaskState == QuickTaskState.POST_CHOICE) {
            return GateAction.NoAction to Reason.POST_CHOICE_ACTIVE
        }

        // 4. OFFERING Block (Prompt already shown)
        if (s.quickTaskState == QuickTaskState.OFFERING) {
            return GateAction.NoAction to Reason.QT_OFFERING_ACTIVE
        }

        // 5. Intention Suppression (Highest User Priority)
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
             return GateAction.StartIntervention to Reason.START_INTERVENTION_RESUME
        }

        // 7. Quick Task Active Check (Timer Running)
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

        // 9. Global Surface Check
        if (s.isSystemSurfaceActive) return GateAction.NoAction to Reason.SURFACE_ACTIVE

        // 10. Quick Task Decision
        if (!disallowQuickTask && s.qtRemaining > 0) {
            return GateAction.StartQuickTask to Reason.START_QUICK_TASK
        }
        
        // 11. Intervention Fallback
        return GateAction.StartIntervention to Reason.START_INTERVENTION
    }
}
