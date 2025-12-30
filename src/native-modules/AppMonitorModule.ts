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
 * Installed app information
 */
export interface InstalledApp {
  /** Package name of the app (e.g., "com.instagram.android") */
  packageName: string;
  /** Display name of the app (e.g., "Instagram") */
  appName: string;
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

  /**
   * Open the Usage Access settings screen where the user can grant PACKAGE_USAGE_STATS permission
   * 
   * This opens the system settings screen that lists all apps with Usage Access permission.
   * The user must manually enable "BreakLoop" in this list.
   * 
   * @returns Promise resolving to true if settings screen was opened successfully
   * @throws Error if settings screen cannot be opened
   */
  openUsageAccessSettings(): Promise<boolean>;

  /**
   * Get list of all installed apps on the device
   * 
   * Returns user-installable apps (excludes system apps) with package names and display names.
   * Apps are sorted alphabetically by display name.
   * 
   * @returns Promise resolving to array of installed app objects
   * @throws Error if app list cannot be retrieved
   */
  getInstalledApps(): Promise<InstalledApp[]>;
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

