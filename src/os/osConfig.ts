/**
 * OS Configuration Adapter
 * 
 * Single source of truth for OS-related configuration.
 * Monitored apps are loaded from user settings (AsyncStorage) on app start
 * and can be updated when user changes settings.
 */

// ============================================================================
// CONFIGURATION VALUES
// ============================================================================

/**
 * List of monitored apps (package names)
 * Initially empty - loaded from AsyncStorage on app start
 * Updated when user changes monitored apps in Settings
 */
let MONITORED_APPS = new Set<string>();

/**
 * Minimum interval between intervention triggers (milliseconds)
 * Configurable range: 1 minute to 30 minutes
 * Current value: 5 minutes
 */
let APP_SWITCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Duration of breathing countdown in intervention flow (seconds)
 * Configurable range: 5 seconds to 30 seconds
 * Current value: 5 seconds
 */
let INTERVENTION_DURATION_SEC = 5; // 5 seconds

/**
 * Default intention timer duration (milliseconds)
 * TEMPORARY: Set to 2 minutes for testing
 * Current value: 2 minutes
 */
const INTENTION_TIMER_DURATION_MS = 2* 60 * 1000; // 2 minutes

/**
 * Quick Task feature configuration
 */
let QUICK_TASK_DURATION_MS = 3 * 60 * 1000; // Default: 3 minutes
let QUICK_TASK_USES_PER_WINDOW = 1; // Default: 1 use per window
const QUICK_TASK_WINDOW_MS = 15 * 60 * 1000; // Fixed: 15 minutes
let IS_PREMIUM_CUSTOMER = true; // Default: true (for now, assume premium)

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
  const isMonitored = MONITORED_APPS.has(packageName);
  if (__DEV__) {
    console.log('[osConfig] isMonitoredApp check:', {
      packageName,
      isMonitored,
      monitoredAppsCount: MONITORED_APPS.size,
      monitoredApps: Array.from(MONITORED_APPS),
    });
  }
  return isMonitored;
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

/**
 * Update the monitored apps list.
 * Called when user saves monitored apps in Settings or on app start.
 * Also updates the native ForegroundDetectionService on Android.
 * 
 * @param packageNames - Array of package names to monitor
 */
export function setMonitoredApps(packageNames: string[]): void {
  MONITORED_APPS = new Set(packageNames);
  if (__DEV__) {
    console.log('[osConfig] Updated monitored apps:', Array.from(MONITORED_APPS));
  }

  // Update native service on Android
  if (typeof window !== 'undefined') {
    // React Native environment
    try {
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
        NativeModules.AppMonitorModule.setMonitoredApps(packageNames)
          .then((result: any) => {
            if (__DEV__) {
              console.log('[osConfig] ✅ Native service updated with', result.count, 'monitored apps');
            }
          })
          .catch((error: any) => {
            console.error('[osConfig] ❌ Failed to update native service:', error);
          });
      }
    } catch (error) {
      console.error('[osConfig] Failed to update native monitored apps:', error);
    }
  }
}

// ============================================================================
// QUICK TASK CONFIGURATION
// ============================================================================

/**
 * Get the Quick Task duration in milliseconds.
 * 
 * @returns Duration in milliseconds (default: 3 minutes)
 */
export function getQuickTaskDurationMs(): number {
  return QUICK_TASK_DURATION_MS;
}

/**
 * Get the number of Quick Task uses allowed per 15-minute window.
 * 
 * @returns Number of uses (default: 1)
 */
export function getQuickTaskUsesPerWindow(): number {
  return QUICK_TASK_USES_PER_WINDOW;
}

/**
 * Get the Quick Task window duration in milliseconds.
 * 
 * @returns Window duration in milliseconds (fixed: 15 minutes)
 */
export function getQuickTaskWindowMs(): number {
  return QUICK_TASK_WINDOW_MS;
}

/**
 * Check if the user is a premium customer.
 * 
 * @returns true if premium, false otherwise
 */
export function getIsPremiumCustomer(): boolean {
  return IS_PREMIUM_CUSTOMER;
}

/**
 * Update Quick Task configuration.
 * Called when user saves Quick Task settings in Settings.
 * 
 * @param durationMs - Quick Task duration in milliseconds
 * @param usesPerWindow - Number of uses per 15-minute window
 * @param isPremium - Whether user is premium customer
 */
export function setQuickTaskConfig(
  durationMs: number,
  usesPerWindow: number,
  isPremium: boolean
): void {
  QUICK_TASK_DURATION_MS = durationMs;
  QUICK_TASK_USES_PER_WINDOW = usesPerWindow;
  IS_PREMIUM_CUSTOMER = isPremium;
  if (__DEV__) {
    console.log('[osConfig] Updated Quick Task config:', {
      durationMs,
      usesPerWindow,
      isPremium,
    });
  }
}

/**
 * Update intervention preferences configuration.
 * Called when user saves preferences in Settings.
 * 
 * @param interventionDurationSec - Breathing countdown duration in seconds (5-30)
 * @param appSwitchIntervalMs - Minimum interval between interventions in milliseconds (1-30 minutes)
 */
export function setInterventionPreferences(
  interventionDurationSec: number,
  appSwitchIntervalMs: number
): void {
  INTERVENTION_DURATION_SEC = interventionDurationSec;
  APP_SWITCH_INTERVAL_MS = appSwitchIntervalMs;
  if (__DEV__) {
    console.log('[osConfig] Updated intervention preferences:', {
      interventionDurationSec,
      appSwitchIntervalMs,
      appSwitchIntervalMin: appSwitchIntervalMs / (60 * 1000),
    });
  }
}

