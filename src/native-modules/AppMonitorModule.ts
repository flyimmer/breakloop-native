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
  /** Base64 encoded PNG icon (optional, may be null if icon retrieval fails) */
  icon?: string | null;
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
   * Returns user-installable apps (excludes system apps) with package names, display names, and icons.
   * Apps are sorted alphabetically by display name.
   * Icons are returned as base64-encoded PNG strings for use with React Native Image component.
   * 
   * @returns Promise resolving to array of installed app objects with optional icon field
   * @throws Error if app list cannot be retrieved
   */
  getInstalledApps(): Promise<InstalledApp[]>;

  /**
   * Update the monitored apps list in the native ForegroundDetectionService
   * This tells the accessibility service which apps should trigger interventions
   * 
   * @param packageNames - Array of package names to monitor (e.g., ['com.instagram.android', 'com.zhiliaoapp.musically'])
   * @returns Promise with success status and count of apps
   */
  setMonitoredApps(packageNames: string[]): Promise<{ success: boolean; count: number }>;

  /**
   * Store Quick Task timer in native layer
   * 
   * When called, the native ForegroundDetectionService will NOT launch InterventionActivity
   * for this app until the timer expires.
   * 
   * @param packageName - Package name of the app (e.g., "com.instagram.android")
   * @param expiresAt - Timestamp when timer expires (milliseconds since epoch)
   */
  storeQuickTaskTimer(packageName: string, expiresAt: number): void;

  /**
   * Clear Quick Task timer from native layer
   * 
   * @param packageName - Package name of the app
   */
  clearQuickTaskTimer(packageName: string): void;

  /**
   * Finish InterventionActivity and return to the monitored app
   * 
   * Called when user completes Quick Task or intervention.
   * The native code will launch the monitored app and move InterventionActivity to background.
   */
  finishInterventionActivity(): void;

  /**
   * Launch Android home screen and finish InterventionActivity
   */
  launchHomeScreen(): void;

  /**
   * Launch a specific app by package name
   * 
   * @param packageName - Package name to launch
   */
  launchApp(packageName: string): void;

  /**
   * Get the initial triggering app from InterventionActivity Intent.
   * Returns the package name of the app that triggered the intervention, or null.
   * 
   * @returns Promise resolving to package name or null
   */
  getInitialTriggeringApp(): Promise<string | null>;

  /**
   * Get the wake reason from InterventionActivity Intent.
   * 
   * CRITICAL: JavaScript MUST check this FIRST before running any logic.
   * 
   * Possible return values:
   * - "MONITORED_APP_FOREGROUND" - Normal monitored app detected, run priority chain
   * - "QUICK_TASK_EXPIRED" - Quick Task timer expired, show expired screen ONLY
   * - "INTENTION_EXPIRED" - Intention timer expired while app in foreground
   * - null - Not in InterventionActivity or no wake reason set
   * 
   * @returns Promise resolving to wake reason string or null
   */
  getWakeReason(): Promise<string | null>;
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

