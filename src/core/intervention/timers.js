/**
 * Intervention State Machine - Timer Utilities
 * 
 * Framework-agnostic timer calculation functions.
 * These functions handle breathing countdown and action timer logic.
 */

/**
 * Check if breathing countdown should tick
 * @param {string} state - Current intervention state
 * @param {number} breathingCount - Current breathing count
 * @returns {boolean}
 */
export const shouldTickBreathing = (state, breathingCount) => {
  return state === 'breathing' && breathingCount > 0;
};

/**
 * Check if breathing countdown is complete
 * @param {string} state - Current intervention state
 * @param {number} breathingCount - Current breathing count
 * @returns {boolean}
 */
export const isBreathingComplete = (state, breathingCount) => {
  return state === 'breathing' && breathingCount === 0;
};

/**
 * Check if action timer should tick
 * @param {string} state - Current intervention state
 * @param {number} actionTimer - Current action timer value
 * @returns {boolean}
 */
export const shouldTickActionTimer = (state, actionTimer) => {
  return state === 'action_timer' && actionTimer > 0;
};

/**
 * Check if action timer is complete
 * @param {string} state - Current intervention state
 * @param {number} actionTimer - Current action timer value
 * @returns {boolean}
 */
export const isActionTimerComplete = (state, actionTimer) => {
  return state === 'action_timer' && actionTimer === 0;
};

/**
 * Format seconds to MM:SS display format
 * @param {number} totalSeconds - Total seconds
 * @returns {string} Formatted time string
 */
export const formatTimerDisplay = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Calculate remaining time percentage (for progress bars)
 * @param {number} current - Current time value
 * @param {number} total - Total time value
 * @returns {number} Percentage (0-100)
 */
export const calculateTimerProgress = (current, total) => {
  if (total === 0) return 0;
  return (current / total) * 100;
};

/**
 * Get timer interval in milliseconds
 * Breathing uses 1000ms (1 second)
 * Action timer uses 1000ms (1 second)
 * @param {string} timerType - 'breathing' or 'action'
 * @returns {number} Interval in milliseconds
 */
export const getTimerInterval = (timerType) => {
  return 1000; // Both use 1 second intervals
};

