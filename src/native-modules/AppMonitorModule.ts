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
   * Check if the accessibility service (ForegroundDetectionService) is enabled
   * 
   * This checks if the user has enabled BreakLoop's accessibility service in Android Settings.
   * 
   * @returns Promise resolving to boolean indicating if service is enabled
   */
  isAccessibilityServiceEnabled(): Promise<boolean>;

  /**
   * Open the Accessibility Settings screen
   * 
   * Opens Android's Accessibility Settings where the user can enable BreakLoop's service.
   * 
   * @returns Promise resolving to true if settings screen was opened successfully
   */
  openAccessibilitySettings(): Promise<boolean>;

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
   * User intents for Quick Task state transitions (Phase 4.2)
   * These methods notify Native of user decisions, triggering state machine changes.
   */
  quickTaskAccept(packageName: string, durationMs: number): Promise<boolean>;
  quickTaskDecline(packageName: string): Promise<boolean>;
  quickTaskPostContinue(packageName: string): Promise<boolean>;
  quickTaskPostQuit(packageName: string): Promise<boolean>;

  /**
   * Notify native that SystemSurface is active or inactive (Phase 4.1)
   */
  setSystemSurfaceActive(active: boolean): Promise<boolean>;

  /**
   * Update Quick Task quota cache in Native (Phase 4.1)
   */
  updateQuickTaskQuota(quota: number): Promise<boolean>;

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
   * Cancel intervention and close SystemSurfaceActivity
   * 
   * Called when user presses back during intervention or switches away from monitored app.
   * Uses static reference to reliably finish SystemSurfaceActivity even when currentActivity is null.
   * 
   * This is a MECHANICAL ACTION - JavaScript decides WHEN to cancel (semantics).
   */
  cancelInterventionActivity(): void;

  /**
   * Finish SystemSurfaceActivity without launching home screen
   * 
   * Called when intervention completes with intention timer set (user wants to use the app).
   * The monitored app will naturally come to foreground after SystemSurfaceActivity finishes.
   * 
   * This is a MECHANICAL ACTION - JavaScript decides WHEN to finish (semantics).
   */
  finishSystemSurfaceActivity(): void;

  /**
   * Launch a specific app by package name
   * 
   * @param packageName - Package name to launch
   */
  launchApp(packageName: string): void;

  /**
   * Set wake suppression flag
   * 
   * Tells native: "Do not launch SystemSurfaceActivity before this timestamp"
   * 
   * SEMANTIC OWNERSHIP:
   * - JavaScript makes semantic decision (e.g., "user wants 1-min intention timer")
   * - JavaScript sets mechanical flag: "don't wake before X"
   * - Native reads mechanical flag, has ZERO semantic knowledge
   * - Native doesn't know WHY suppression exists (intention timer, quick task, etc.)
   * - Native only knows: "Don't wake before this timestamp"
   * 
   * This is a MECHANICAL flag set by JavaScript's SEMANTIC decision.
   * 
   * @param packageName - Package name (e.g., "com.instagram.android")
   * @param suppressUntil - Timestamp (milliseconds) - don't wake before this time
   */
  setSuppressSystemSurfaceUntil(packageName: string, suppressUntil: number): void;

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

  /**
   * Launch SystemSurfaceActivity from System Brain JS.
   * 
   * This allows the event-driven headless runtime to trigger UI when needed.
   * System Brain decides WHEN and WHY, native handles HOW.
   * 
   * @param wakeReason - Wake reason string (e.g., "QUICK_TASK_EXPIRED_FOREGROUND", "INTENTION_EXPIRED_FOREGROUND")
   * @param triggeringApp - Package name of the app that triggered the wake
   */
  launchSystemSurface(wakeReason: string, triggeringApp: string): void;

  /**
   * Get Intent extras from SystemSurfaceActivity.
   * 
   * Returns the wake reason and triggering app that were passed when launching SystemSurface.
   * Used during bootstrap to determine which flow to show.
   * 
   * @returns Promise resolving to { wakeReason: string, triggeringApp: string } or null
   */
  getSystemSurfaceIntentExtras(): Promise<{ wakeReason: string; triggeringApp: string } | null>;
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

