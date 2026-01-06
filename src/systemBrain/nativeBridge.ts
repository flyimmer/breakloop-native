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
  | 'QUICK_TASK_EXPIRED_FOREGROUND' // Quick Task expired, show Intervention
  | 'INTENTION_EXPIRED_FOREGROUND';  // Intention expired, show Intervention

/**
 * Launch SystemSurface with explicit wake reason.
 * 
 * System Brain pre-decides the UI flow and passes the decision via wake reason.
 * SystemSurface will render based on this decision without re-evaluation.
 * 
 * @param triggeringApp - Package name of the app that triggered the wake
 * @param wakeReason - Explicit wake reason (System Brain's decision)
 */
export async function launchSystemSurface(
  triggeringApp: string,
  wakeReason: WakeReason
): Promise<void> {
  console.log('[System Brain] launchSystemSurface called:', {
    triggeringApp,
    wakeReason,
    AppMonitorModuleExists: !!AppMonitorModule,
    AppMonitorModuleType: typeof AppMonitorModule,
    hasLaunchMethod: AppMonitorModule ? typeof AppMonitorModule.launchSystemSurface : 'N/A',
  });
  
  if (!AppMonitorModule) {
    console.error('[System Brain] ❌ AppMonitorModule is NULL - cannot launch SystemSurface');
    console.error('[System Brain] This means NativeModules are not available in Headless Task context');
    return;
  }
  
  if (!AppMonitorModule.launchSystemSurface) {
    console.error('[System Brain] ❌ launchSystemSurface method does not exist on AppMonitorModule');
    console.error('[System Brain] Available methods:', Object.keys(AppMonitorModule));
    return;
  }
  
  console.log('[System Brain] 🚀 Launching SystemSurface:', {
    triggeringApp,
    wakeReason,
    note: 'System Brain pre-decided UI flow',
  });
  
  try {
    // Native module expects (wakeReason, triggeringApp) order
    AppMonitorModule.launchSystemSurface(wakeReason, triggeringApp);
    console.log('[System Brain] ✅ launchSystemSurface call completed');
  } catch (error) {
    console.error('[System Brain] ❌ Failed to launch SystemSurface:', error);
    console.error('[System Brain] Error details:', JSON.stringify(error));
  }
}

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
