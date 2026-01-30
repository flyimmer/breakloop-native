/**
 * System Brain Native Bridge
 * 
 * Provides interface for System Brain JS to communicate with native layer.
 * System Brain is event-driven and headless, so it uses these functions
 * to trigger native actions (like launching SystemSurface).
 */

import { NativeModules, Platform } from 'react-native';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Wake reason types for SystemSurface launch.
 * These are explicit decisions made by System Brain.
 */
export type WakeReason =
  | 'SHOW_QUICK_TASK_DIALOG'        // System Brain decided: Show Quick Task dialog
  | 'START_INTERVENTION_FLOW'       // System Brain decided: Start Intervention flow
  | 'POST_QUICK_TASK_CHOICE'        // Quick Task expired in foreground, show choice screen
  | 'QUICK_TASK_EXPIRED_FOREGROUND' // Quick Task expired, show Intervention (legacy)
  | 'INTENTION_EXPIRED_FOREGROUND';  // Intention expired, show Intervention

/**
 * Launch SystemSurface with explicit wake reason.
 * 
 * System Brain pre-decides the UI flow and passes the decision via wake reason.
 * SystemSurface will render based on this decision without re-evaluation.
 * 
 * @param triggeringApp - Package name of the app that triggered the wake
 * @param wakeReason - Explicit wake reason (System Brain's decision)
 * @param extras - Optional extras (resumeMode)
 */
export async function launchSystemSurface(
  triggeringApp: string,
  wakeReason: WakeReason | string,
  extras?: { resumeMode?: string }
): Promise<void> {
  if (!AppMonitorModule) {
    return;
  }

  if (!AppMonitorModule.launchSystemSurface) {
    return;
  }

  try {
    // Native module expects (wakeReason, triggeringApp, extras?) order
    // Note: wakeReason might be a string from legacy calls, forcing type here
    // CRITICAL: Must pass 3 arguments to match Native Method Signature
    if (extras) {
      console.log(`[SS][OPEN] reason=${wakeReason} app=${triggeringApp} extras=${JSON.stringify(extras)}`);
      AppMonitorModule.launchSystemSurface(wakeReason, triggeringApp, extras);
    } else {
      console.log(`[SS][OPEN] reason=${wakeReason} app=${triggeringApp}`);
      AppMonitorModule.launchSystemSurface(wakeReason, triggeringApp, {});
    }
  } catch (error) {
    // Silent failure - SystemSurface launch is best-effort
    console.warn('[NativeBridge] Failed to launch surface', error);
  }
}

/**
 * V3: Set intervention preserved flag for an app
 */
export const setInterventionPreserved = (app: string, preserved: boolean) => {
  if (NativeModules.AppMonitorModule?.setInterventionPreserved) {
    NativeModules.AppMonitorModule.setInterventionPreserved(app, preserved);
  }
};

/**
 * Check if a package name is a monitored app.
 * 
 * This is a temporary helper until we centralize monitored app checks.
 * System Brain needs to know if an app is monitored to decide whether to intervene.
 * 
 * @param packageName - App package name to check
 * @returns true if app is monitored
 */
export async function isMonitoredApp(packageName: string): Promise<boolean> {
  if (!AppMonitorModule) {
    return false;
  }

  try {
    // This assumes AppMonitorModule has a method to check monitored apps
    // If not, we'll need to load from AsyncStorage
    return await AppMonitorModule.isMonitoredApp?.(packageName) ?? false;
  } catch (error) {
    console.error('[System Brain] Failed to check if app is monitored:', error);
    return false;
  }
}
