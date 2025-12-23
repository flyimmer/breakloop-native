/**
 * Intervention State Machine - State Definitions
 * 
 * Framework-agnostic state shape and initial values for the intervention flow.
 * This module defines the core state structure without any React dependencies.
 */

/**
 * Intervention flow states:
 * - 'idle': No intervention active
 * - 'breathing': Breathing countdown before intervention
 * - 'root-cause': User selects emotional causes
 * - 'alternatives': User browses alternative activities
 * - 'action': User views selected alternative details
 * - 'action_timer': Timer running for selected alternative
 * - 'timer': User chose "I really need to use it" - set unlock timer
 * - 'reflection': Post-activity reflection
 */

/**
 * Initial intervention context
 * @returns {Object} Initial intervention context
 */
export const createInitialInterventionContext = () => ({
  state: 'idle',
  targetApp: null,
  breathingCount: 3,
  selectedCauses: [],
  selectedAlternative: null,
  actionTimer: 0,
});

/**
 * Check if intervention is active (not idle)
 * @param {string} state - Current intervention state
 * @returns {boolean}
 */
export const isInterventionActive = (state) => {
  return state !== 'idle';
};

/**
 * Check if intervention is in a state that blocks app access
 * @param {string} state - Current intervention state
 * @returns {boolean}
 */
export const isInterventionBlocking = (state) => {
  return state === 'breathing' || state === 'root-cause' || state === 'alternatives';
};

/**
 * Get the next state after breathing completes
 * @returns {string}
 */
export const getNextStateAfterBreathing = () => {
  return 'root-cause';
};

/**
 * Get the next state after action timer completes
 * @returns {string}
 */
export const getNextStateAfterActionTimer = () => {
  return 'reflection';
};

