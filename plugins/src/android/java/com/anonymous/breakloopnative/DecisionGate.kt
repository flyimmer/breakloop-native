package com.anonymous.breakloopnative

import com.anonymous.breakloopnative.ForegroundDetectionService.Companion.QuickTaskState

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
        val quickTaskState: QuickTaskState,
        val intentionRemainingMs: Long, // Placeholder M3a
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
        const val STATE_NOT_IDLE = "STATE_NOT_IDLE"
        const val QUOTA_ZERO = "QUOTA_ZERO"
        const val SUPPRESSION_QUIT = "SUPPRESSION_QUIT"
        const val SUPPRESSION_WAKE = "SUPPRESSION_WAKE"
        const val SUPPRESSION_WAKE_EXPIRED = "SUPPRESSION_WAKE_EXPIRED"
        const val START_QUICK_TASK = "START_QUICK_TASK"
        const val NOT_MONITORED = "NOT_MONITORED"
        const val T_INTENTION_ACTIVE = "T_INTENTION_ACTIVE"
    }

    /**
     * PURE FUNCTION: Evaluate entry + return Action & Reason.
     * Does NOT emit commands or mutate state.
     */
    fun evaluate(pkg: String, nowMs: Long, s: GateSnapshot): Pair<GateAction, String> {
        // 1. Not Monitored (Implicit Guard, though caller checks set usually)
        if (!s.isMonitored) return GateAction.NoAction to Reason.NOT_MONITORED

        // 2. V3: Intention Suppression (Highest Priority)
        // If user has an active intention, suppress EVERYTHING (QT and Intervention)
        if (s.intentionRemainingMs > 0) {
            return GateAction.NoAction to "${Reason.T_INTENTION_ACTIVE}_${s.intentionRemainingMs}ms"
        }

        // 3. V3: Early Preservation Override
        if (s.isInterventionPreserved) {
            // DEBOUNCE: Suppress duplicate SHOW_INTERVENTION within 800ms
            if (nowMs - s.lastInterventionEmittedAt < 800) {
                return GateAction.NoAction to Reason.DEBOUNCE_INTERVENTION
            }
            // Mapped to StartIntervention (caller handles resumeMode extras)
            return GateAction.StartIntervention to Reason.START_INTERVENTION_PRESERVED
        }

        // 3. V3: Handle Interrupted Intervention Resumption (Intervention is Active state)
        if (s.quickTaskState == QuickTaskState.INTERVENTION_ACTIVE) {
             // Logic in service was: if preserved -> show; else -> reset. 
             // But we already checked `isInterventionPreserved` above.
             // Wait, the service logic has two blocks checks for preservation. 
             // First block: `if (preservedInterventionFlags[app] == true)` returns early.
             // Second block: `if (entry?.state == QuickTaskState.INTERVENTION_ACTIVE)`
             // If we are here, isInterventionPreserved is FALSE.
             
             // Original logic for !preserved && INTERVENTION_ACTIVE: 
             // Log "Intervention active but not preserved -> Resetting to IDLE"
             // And then "Fall through to normal decision logic".
             // So DecisionGate should NOT return NoAction here, but treat it as IDLE effectively?
             // Or rather, the state IS INTERVENTION_ACTIVE, so subsequent checks will see that.
             // But the original code resets it to IDLE *before* the eligibility check.
             // Since DecisionGate cannot mutate state, we must Simulate the reset for the rest of the eval.
             // Let's defer this thought. If we are here, s.quickTaskState IS INTERVENTION_ACTIVE and s.isInterventionPreserved IS FALSE.
             
             // The subsequent check is: 
             // else if (qtState != QuickTaskState.IDLE && qtState != QuickTaskState.POST_CHOICE)
             
             // If we don't simulate reset, INTERVENTION_ACTIVE will block entry with STATE_NOT_IDLE.
             // BUT, original code resets it to IDLE, then continues.
             // So for PURE evaluation, we should treat the *effective* state as IDLE if (INTERVENTION_ACTIVE && !PRESERVED).
        }
        
        // Resolve Effective State for Calculation
        val effectiveState = if (s.quickTaskState == QuickTaskState.INTERVENTION_ACTIVE && !s.isInterventionPreserved) {
            // In service, this triggers a reset side-effect. Here we just assume IDLE for calculation.
            QuickTaskState.IDLE
        } else {
            s.quickTaskState
        }

        // 4. AVOID CONFLICTS: Quick Task Eligibility Logic
        if (s.isSystemSurfaceActive) {
            return GateAction.NoAction to Reason.SURFACE_ACTIVE
        }
        
        if (effectiveState != QuickTaskState.IDLE && effectiveState != QuickTaskState.POST_CHOICE) {
            // DECISION or ACTIVE (or stuck INTERVENTION_ACTIVE if we didn't handle it above, but we did)
             return GateAction.NoAction to "${Reason.STATE_NOT_IDLE}_${effectiveState}"
        }
        
        if (s.qtRemaining <= 0) {
            return GateAction.NoAction to Reason.QUOTA_ZERO
        }
        
        // Suppressions (DEFENSIVE: Trust remainingMs > 0 over isSuppressed flag)
        if (s.isQuitSuppressed && !s.isForceEntry) {
            if (s.quitSuppressionRemainingMs > 0) {
                return GateAction.NoAction to "${Reason.SUPPRESSION_QUIT}_${s.quitSuppressionRemainingMs}ms"
            }
            // Logic fall-through: Flag was true but time expired -> Treat as NOT suppressed
        }
        
        if (s.isWakeSuppressed && !s.isForceEntry) {
            if (s.wakeSuppressionRemainingMs > 0) {
                 return GateAction.NoAction to "${Reason.SUPPRESSION_WAKE}_${s.wakeSuppressionRemainingMs}ms"
            }
            // Logic fall-through: Flag was true but time expired -> Treat as NOT suppressed
        }

        // If we passed all guards -> ELIGIBLE
        return GateAction.StartQuickTask to Reason.START_QUICK_TASK
    }
}
