/**
 * Intervention State Machine - Transition Functions
 * 
 * Framework-agnostic pure functions for state transitions.
 * All functions are pure: they take state as input and return new state.
 */

/**
 * Main reducer function for intervention state transitions
 * @param {Object} context - Current intervention context
 * @param {Object} action - Action object with type and payload
 * @returns {Object} New intervention context
 */
export const interventionReducer = (context, action) => {
  switch (action.type) {
    case 'BEGIN_INTERVENTION':
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
      if (context.state !== 'alternatives') return context;
      return {
        ...context,
        selectedAlternative: action.alternative,
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
  
  // First select the alternative (transition to 'action')
  const withSelected = interventionReducer(context, {
    type: 'SELECT_ALTERNATIVE',
    alternative,
  });
  
  // Then start the timer (transition to 'action_timer')
  return interventionReducer(withSelected, {
    type: 'START_ALTERNATIVE',
    durationMinutes,
  });
};

