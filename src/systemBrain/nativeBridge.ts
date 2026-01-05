/**
 * Native Bridge for System Brain
 * 
 * Provides interface for System Brain to communicate with native layer.
 */

import { NativeModules, Platform } from 'react-native';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Launch SystemSurfaceActivity from System Brain.
 * 
 * This is the ONLY way System Brain can trigger UI.
 * System Brain decides WHEN and WHY, native handles HOW.
 */
export function launchSystemSurface(params: {
  wakeReason: string;
  triggeringApp: string;
}): void {
  if (!AppMonitorModule) {
    console.warn('[System Brain] Cannot launch SystemSurface - AppMonitorModule not available');
    return;
  }
  
  console.log('[System Brain] Requesting SystemSurface launch:', params);
  
  AppMonitorModule.launchSystemSurface(params.wakeReason, params.triggeringApp);
}
