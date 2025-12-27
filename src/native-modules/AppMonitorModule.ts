/**
 * AppMonitorModule TypeScript Interface
 * 
 * Type definitions for the native Android app monitoring module.
 * 
 * Usage:
 * ```typescript
 * import { AppMonitorModule } from './native-modules/AppMonitorModule';
 * 
 * // Start monitoring
 * const result = await AppMonitorModule.startMonitoring();
 * console.log(result.message); // "App monitoring started"
 * 
 * // Stop monitoring
 * await AppMonitorModule.stopMonitoring();
 * 
 * // Check if monitoring
 * const isActive = await AppMonitorModule.isMonitoring();
 * ```
 */

import { NativeModules } from 'react-native';

/**
 * Foreground app event payload
 */
export interface ForegroundAppEvent {
  /** Package name of the app (e.g., "com.instagram.android") */
  packageName: string;
  /** Timestamp when app moved to foreground (milliseconds since epoch) */
  timestamp: number;
}

/**
 * Result returned from startMonitoring() and stopMonitoring()
 */
export interface MonitoringResult {
  success: boolean;
  message: string;
}

/**
 * Native module interface
 */
interface IAppMonitorModule {
  /**
   * Start the app monitoring service
   * 
   * Note: This does NOT check if PACKAGE_USAGE_STATS permission is granted.
   * The user must manually grant this permission via Settings > Apps > Special app access > Usage access.
   * 
   * @returns Promise resolving to { success: true, message: "..." }
   * @throws Error if service fails to start
   */
  startMonitoring(): Promise<MonitoringResult>;

  /**
   * Stop the app monitoring service
   * 
   * @returns Promise resolving to { success: true, message: "..." }
   * @throws Error if service fails to stop
   */
  stopMonitoring(): Promise<MonitoringResult>;

  /**
   * Check if the app monitoring service is currently running
   * 
   * @returns Promise resolving to boolean (true if monitoring is active)
   */
  isMonitoring(): Promise<boolean>;
}

/**
 * Native module instance
 * 
 * Access the module via:
 * ```typescript
 * import { AppMonitorModule } from './native-modules/AppMonitorModule';
 * ```
 */
export const AppMonitorModule: IAppMonitorModule = NativeModules.AppMonitorModule;

