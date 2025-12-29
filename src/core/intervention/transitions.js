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
  switch (action.type) {
    case 'BEGIN_INTERVENTION':
      // If intervention is already active for a DIFFERENT app, reset and start fresh
      // This ensures each app gets its own independent intervention flow
      const isDifferentApp = context.targetApp && context.targetApp !== action.app;
      
      return {
        ...context,
        state: 'breathing',
        targetApp: action.app,
        breathingCount: action.breathingDuration,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
      };

    case 'BREATHING_TICK':
      if (context.state !== 'breathing') return context;
      const newCount = Math.max(0, context.breathingCount - 1);
      return {
        ...context,
        breathingCount: newCount,
        // Auto-transition to root-cause when breathing completes
        state: newCount === 0 ? 'root-cause' : context.state,
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
      };

    case 'GO_BACK_FROM_ACTION':
      // User goes back from action view to alternatives
      if (context.state !== 'action') return context;
      return {
        ...context,
        state: 'alternatives',
        selectedAlternative: null,
      };

    case 'RESET_INTERVENTION':
      return {
        ...context,
        state: 'idle',
        targetApp: null,
        breathingCount: 0,
        selectedCauses: [],
        selectedAlternative: null,
        actionTimer: 0,
      };

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

