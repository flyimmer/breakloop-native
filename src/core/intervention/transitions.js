/**
 * Intervention State Machine - Transition Functions
 * 
 * Framework-agnostic pure functions for state transitions.
 * All functions are pure: they take state as input and return new state.
 */

/**
 * Main reducer function for intervention state transitions
 * 
 * IMPORTANT: Each app gets its own independent intervention flow.
 * When BEGIN_INTERVENTION is dispatched for a different app while an intervention
 * is already active, the old intervention is abandoned and a new one starts.
 * This prevents intervention state from mixing between apps.
 * 
 * @param {Object} context - Current intervention context
 * @param {Object} action - Action object with type and payload
 * @returns {Object} New intervention context
 */
export const interventionReducer = (context, action) => {
  // Log all actions for debugging
  if (__DEV__) {
    console.log('[Intervention Reducer] Action:', action.type, {
      currentState: context.state,
      currentBreathingCount: context.breathingCount,
      action,
    });
  }

  switch (action.type) {
    case 'BEGIN_INTERVENTION':
      // If intervention is already active for a DIFFERENT app, reset and start fresh
      // This ensures each app gets its own independent intervention flow
      const isDifferentApp = context.targetApp && context.targetApp !== action.app;

      // ARCHITECTURE: Quick Task is now separate from intervention
      // Intervention ALWAYS starts with breathing (no Quick Task logic here)
      const newState = {
        ...context,
        state: 'breathing',
        targetApp: action.app,
        breathingCount: action.breathingDuration,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
        wasCompleted: false, // Clear completed flag when starting new intervention
        intentionTimerSet: false, // Clear intention timer flag when starting new intervention
        wasCancelled: false, // Clear cancelled flag when starting new intervention
        // TIME-DERIVED BREATHING FIX:
        breathingStartedAtMs: Date.now(),
        initialBreathingDuration: action.breathingDuration,
        breathingDurationSec: action.breathingDuration, // Explicit store as requested
        breathingCompleted: false, // Strict guard against double transitions
      };

      if (__DEV__) {
        console.log('[Intervention Reducer] BEGIN_INTERVENTION result:', {
          newState: newState.state,
          newBreathingCount: newState.breathingCount,
          targetApp: newState.targetApp,
        });
      }

      return newState;

    case 'BREATHING_TICK':
      if (context.state !== 'breathing' || context.breathingCompleted) {
        if (__DEV__) {
          console.log('[Intervention Reducer] BREATHING_TICK ignored - invalid state/completed');
        }
        return context;
      }
      const now = Date.now();
      const startedAt = context.breathingStartedAtMs || now; // Fallback if missing
      const elapsedSec = Math.floor((now - startedAt) / 1000);
      const initialDuration = context.initialBreathingDuration || 5; // Fallback default // Use initialBreathingDuration as authoritative source

      // Calculate authoritative remaining time
      const newCount = Math.max(0, initialDuration - elapsedSec);
      const willTransition = newCount === 0;

      if (__DEV__) {
        console.log('[Intervention Reducer] BREATHING_TICK:', {
          oldCount: context.breathingCount,
          newCount,
          elapsedSec,
          willTransition,
          nextState: willTransition ? 'root-cause' : 'breathing',
        });
      }

      return {
        ...context,
        breathingCount: newCount,
        // Auto-transition DISABLED: Wait for user action
        state: context.state,
        breathingCompleted: willTransition, // Mark as completed to show buttons
      };

    case 'BREATHING_COMPLETE':
      if (context.state !== 'breathing') return context;
      return {
        ...context,
        state: 'root-cause',
        breathingCount: 0,
      };

    case 'SELECT_CAUSE':
      if (context.state !== 'root-cause') return context;
      if (context.selectedCauses.includes(action.causeId)) return context;
      return {
        ...context,
        selectedCauses: [...context.selectedCauses, action.causeId],
      };

    case 'DESELECT_CAUSE':
      if (context.state !== 'root-cause') return context;
      return {
        ...context,
        selectedCauses: context.selectedCauses.filter(id => id !== action.causeId),
      };

    case 'PROCEED_TO_ALTERNATIVES':
      if (context.state !== 'root-cause') return context;
      return {
        ...context,
        state: 'alternatives',
      };

    case 'PROCEED_TO_TIMER':
      // User chose "I really need to use it"
      return {
        ...context,
        state: 'timer',
      };

    case 'SELECT_ALTERNATIVE':
      // Selection only: sets selectedAlternative without state transition
      // Used when user taps a card to preview/select (but hasn't committed yet)
      if (context.state !== 'alternatives') return context;
      return {
        ...context,
        selectedAlternative: action.alternative,
        // Stay in 'alternatives' state - no transition
      };

    case 'PROCEED_TO_ACTION':
      // Commit: transitions from alternatives to action state
      // Used when user explicitly commits (e.g., "Plan this activity", "Start")
      if (context.state !== 'alternatives') return context;
      if (!context.selectedAlternative) return context;
      return {
        ...context,
        state: 'action',
      };

    case 'START_ALTERNATIVE':
      if (context.state !== 'action') return context;
      return {
        ...context,
        state: 'action_timer',
        actionTimer: action.durationMinutes * 60, // Convert to seconds
      };

    case 'ACTION_TIMER_TICK':
      if (context.state !== 'action_timer') return context;
      const newTimer = Math.max(0, context.actionTimer - 1);
      return {
        ...context,
        actionTimer: newTimer,
      };

    case 'ACTION_TIMER_COMPLETE':
      if (context.state !== 'action_timer') return context;
      return {
        ...context,
        state: 'reflection',
        actionTimer: 0,
      };


    case 'RESUME_INTERVENTION':
      // V3: Resume from preserved snapshot
      return {
        ...context,
        state: 'action_timer',
        actionTimer: action.actionTimer,
        targetApp: action.targetApp, // Ensure target app is set
        wasCompleted: false,
        wasCancelled: false,
      };

    case 'FINISH_ACTION':
      // User manually finishes action (before timer completes)
      if (context.state !== 'action_timer') return context;
      return {
        ...context,
        state: 'reflection',
      };

    case 'FINISH_REFLECTION':
      if (context.state !== 'reflection') return context;
      return {
        ...context,
        state: 'idle',
        targetApp: null,
        selectedAlternative: null,
        wasCompleted: true, // Mark intervention as completed normally
        intentionTimerSet: false, // Clear intention timer flag
        wasCancelled: false, // Not cancelled (completed normally)
      };

    case 'GO_BACK_FROM_ACTION':
      // User goes back from action view to alternatives
      if (context.state !== 'action') return context;
      return {
        ...context,
        state: 'alternatives',
        selectedAlternative: null,
      };

    case 'GO_BACK_TO_ROOT_CAUSE':
      // User goes back from alternatives to root-cause (swipe back navigation)
      if (context.state !== 'alternatives') return context;
      return {
        ...context,
        state: 'root-cause',
        // Keep selectedCauses so user can see their previous selections
      };

    case 'SET_INTENTION_TIMER':
      // User selected intention timer duration - reset to idle and release app
      // The OS Trigger Brain will handle setting the actual timer
      // IMPORTANT: Keep targetApp so App.tsx can launch it
      return {
        ...context,
        state: 'idle',
        targetApp: context.targetApp, // Preserve target app for launch
        breathingCount: 0,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
        wasCompleted: false, // Not completed (user chose intention timer)
        intentionTimerSet: true, // Flag to indicate intention timer was set
        wasCancelled: false, // Not cancelled (user chose intention timer)
      };

    case 'BEGIN_INTERVENTION':
      if (__DEV__) {
        console.log('[Intervention Reducer] BEGIN_INTERVENTION clearing resetReason');
      }
      return {
        ...context,
        state: 'breathing',
        targetApp: action.targetApp, // Ensure targetApp is updated
        breathingCount: 0,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
        wasCompleted: false,
        intentionTimerSet: false,
        wasCancelled: false,
        resetReason: null,
        breathingStartedAtMs: Date.now(),
        initialBreathingDuration: action.breathingDuration,
        breathingDurationSec: action.breathingDuration,
        breathingCompleted: false,
      };

    // ... (BREATHING_TICK, etc. are correct)

    case 'RESET_INTERVENTION':
      if (__DEV__) {
        console.log('[Intervention Reducer] RESET_INTERVENTION reason=', action.reason);
      }
      return {
        ...context,
        state: 'idle',
        targetApp: null,
        breathingCount: 0,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
        wasCompleted: false, // Not completed (was cancelled)
        intentionTimerSet: false, // Clear intention timer flag
        wasCancelled: action.cancelled === true, // Set cancelled flag if explicitly cancelled
        resetReason: action.reason || null, // Store reason (e.g., 'APP_SWITCH')
      };

    // REMOVED: PROCEED_TO_BREATHING and ACTIVATE_QUICK_TASK
    // Quick Task is now handled by separate QuickTaskProvider
    // These actions are no longer part of intervention flow

    default:
      return context;
  }
};

/**
 * Helper: Begin intervention for an app
 * @param {Object} context - Current intervention context
 * @param {Object} app - App object with id and name
 * @param {number} breathingDuration - Duration of breathing countdown in seconds
 * @returns {Object} New intervention context
 */
export const beginIntervention = (context, app, breathingDuration) => {
  return interventionReducer(context, {
    type: 'BEGIN_INTERVENTION',
    app,
    breathingDuration,
  });
};

/**
 * Helper: Toggle cause selection
 * @param {Object} context - Current intervention context
 * @param {string} causeId - Cause ID to toggle
 * @returns {Object} New intervention context
 */
export const toggleCause = (context, causeId) => {
  if (context.selectedCauses.includes(causeId)) {
    return interventionReducer(context, { type: 'DESELECT_CAUSE', causeId });
  } else {
    return interventionReducer(context, { type: 'SELECT_CAUSE', causeId });
  }
};

/**
 * Helper: Check if can proceed to alternatives
 * @param {Object} context - Current intervention context
 * @returns {boolean}
 */
export const canProceedToAlternatives = (context) => {
  return context.state === 'root-cause' && context.selectedCauses.length > 0;
};

/**
 * Helper: Parse duration string to minutes
 * @param {string} durationStr - Duration string (e.g., "5m", "30m")
 * @returns {number} Duration in minutes
 */
export const parseDurationToMinutes = (durationStr) => {
  const match = durationStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 5;
};

/**
 * Helper: Start alternative with parsed duration
 * @param {Object} context - Current intervention context
 * @param {Object} alternative - Alternative activity object
 * @returns {Object} New intervention context
 */
export const startAlternative = (context, alternative) => {
  const durationMinutes = parseDurationToMinutes(alternative.duration || '5m');

  // First select the alternative (selection only, no state transition)
  const withSelected = interventionReducer(context, {
    type: 'SELECT_ALTERNATIVE',
    alternative,
  });

  // Then commit to action state
  const withCommitted = interventionReducer(withSelected, {
    type: 'PROCEED_TO_ACTION',
  });

  // Then start the timer (transition to 'action_timer')
  return interventionReducer(withCommitted, {
    type: 'START_ALTERNATIVE',
    durationMinutes,
  });
};

