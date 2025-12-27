/**
 * OS Configuration Adapter (v0 - TEMPORARY)
 * 
 * Single source of truth for OS-related configuration.
 * Currently uses in-memory values that match Settings UI defaults.
 * 
 * TODO: Wire to real settings state when Settings UI persistence is ready.
 * This adapter will then read from user preferences instead of hardcoded values.
 */

// ============================================================================
// TEMPORARY IN-MEMORY CONFIGURATION
// These values match the current Settings UI defaults
// ============================================================================

/**
 * List of monitored apps (package names)
 * Matches default apps shown in Settings UI
 */
const MONITORED_APPS = new Set<string>([
  'com.instagram.android',        // Instagram
  'com.zhiliaoapp.musically',     // TikTok
]);

/**
 * Minimum interval between intervention triggers (milliseconds)
 * Current value: 5 minutes
 */
const APP_SWITCH_INTERVAL_MS = 0.5 * 60 * 1000; // 1 minutes

/**
 * Duration of breathing countdown in intervention flow (seconds)
 * Current value: 5 seconds
 */
const INTERVENTION_DURATION_SEC = 5; // 5 seconds

/**
 * Default intention timer duration (milliseconds)
 * TEMPORARY: Set to 2 minutes for testing
 * Current value: 2 minutes
 */
const INTENTION_TIMER_DURATION_MS = 2* 60 * 1000; // 2 minutes

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if an app should trigger interventions.
 * 
 * @param packageName - Android package name (e.g., 'com.instagram.android')
 * @returns true if app is monitored, false otherwise
 */
export function isMonitoredApp(packageName: string): boolean {
  return MONITORED_APPS.has(packageName);
}

/**
 * Get the minimum interval between intervention triggers.
 * 
 * Used to prevent intervention spam when rapidly switching apps.
 * 
 * @returns Interval in milliseconds (default: 5 minutes)
 */
export function getAppSwitchIntervalMs(): number {
  return APP_SWITCH_INTERVAL_MS;
}

/**
 * Get the breathing countdown duration for intervention flow.
 * 
 * @returns Duration in seconds (default: 5 seconds)
 */
export function getInterventionDurationSec(): number {
  return INTERVENTION_DURATION_SEC;
}

/**
 * Get the default intention timer duration.
 * 
 * Used when setting intention timers for monitored apps.
 * 
 * @returns Duration in milliseconds (default: 2 minutes)
 */
export function getIntentionTimerDurationMs(): number {
  return INTENTION_TIMER_DURATION_MS;
}

/**
 * Get the list of all monitored app package names (for debugging/testing).
 * 
 * @returns Array of package names
 */
export function getMonitoredAppsList(): string[] {
  return Array.from(MONITORED_APPS);
}

