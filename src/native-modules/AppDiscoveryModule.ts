/**
 * AppDiscoveryModule TypeScript Interface
 * 
 * Native module for multi-source app discovery:
 * - Launcher: Fast seed from launcher intent query
 * - UsageStats: Async backfill from usage history
 * - Accessibility: Runtime discovery as apps are opened
 * 
 * Discovery and metadata resolution are SEPARATE steps.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

export type DiscoverySource = 'launcher' | 'usage' | 'accessibility';

/**
 * App discovered from a source (packageName only, metadata resolved separately)
 */
export interface DiscoveredAppInfo {
  packageName: string;
  source?: DiscoverySource;
}

/**
 * Resolved app metadata
 */
export interface AppMetadata {
  packageName: string;
  label: string;
  icon: string | null; // base64
  resolved: boolean;
  uninstalled?: boolean;
  error?: string;
}

/**
 * Native module interface
 */
interface IAppDiscoveryModule {
  /**
   * Discover apps via launcher intent query (fast seed)
   * 
   * Returns packageNames only - metadata resolved separately.
   * This is synchronous and fast.
   * 
   * @returns Promise resolving to array of package names
   */
  discoverLauncherApps(): Promise<DiscoveredAppInfo[]>;

  /**
   * Discover apps via UsageStats (async backfill)
   * 
   * Requires PACKAGE_USAGE_STATS permission.
   * This may be slow (async operation).
   * 
   * @param daysBack - Number of days to look back (default: 14)
   * @returns Promise resolving to array of package names
   * @throws Error if permission not granted
   */
  discoverUsageStatsApps(daysBack?: number): Promise<DiscoveredAppInfo[]>;

  /**
   * Check if UsageStats permission is granted
   * 
   * @returns Promise resolving to boolean
   */
  hasUsageStatsPermission(): Promise<boolean>;

  /**
   * Open UsageStats settings screen
   * 
   * Opens Android Settings where user can grant PACKAGE_USAGE_STATS permission.
   * 
   * @returns Promise resolving to true if settings opened successfully
   */
  openUsageStatsSettings(): Promise<boolean>;

  /**
   * Resolve app metadata (icon + label)
   * 
   * MANDATORY step for every discovered app.
   * This does NOT require QUERY_ALL_PACKAGES.
   * Works even if app has no launcher activity.
   * 
   * @param packageName - Package name to resolve
   * @returns Promise resolving to metadata (or uninstalled flag)
   */
  resolveAppMetadata(packageName: string): Promise<AppMetadata>;

  /**
   * Add listener for accessibility-based app discoveries
   * 
   * Event: 'onAppDiscovered'
   * Payload: { packageName: string, source: 'accessibility' }
   */
  addListener(event: 'onAppDiscovered', callback: (event: DiscoveredAppInfo) => void): void;
  removeListeners(count: number): void;
}

/**
 * Native module instance
 */
export const AppDiscoveryModule: IAppDiscoveryModule = NativeModules.AppDiscoveryModule;

/**
 * Event emitter for accessibility discoveries
 */
export const appDiscoveryEmitter = new NativeEventEmitter(AppDiscoveryModule);
