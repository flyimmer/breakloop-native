/**
 * App Discovery Service
 * 
 * Orchestrates multi-source app discovery:
 * - Launcher: Fast seed (synchronous)
 * - UsageStats: Async backfill (may be slow)
 * - Accessibility: Runtime discovery (event-driven)
 * 
 * Discovery and metadata resolution are SEPARATE steps.
 * Every discovered app MUST have metadata resolved (icon + label).
 */

import {
  loadDiscoveredApps,
  mergeApps,
  saveDiscoveredApp,
  markUninstalled,
  getActiveApps,
  getUnresolvedApps,
  cleanupUninstalled,
  saveAppIcon,
  migrateIconStorage,
  forceReresolution,
  markForceReresolutionComplete,
  DiscoveredApp,
  DiscoverySource
} from '../storage/appDiscovery';
import {
  AppDiscoveryModule,
  appDiscoveryEmitter,
  DiscoveredAppInfo,
  AppMetadata
} from '../native-modules/AppDiscoveryModule';

type AppDiscoveryListener = (apps: DiscoveredApp[]) => void;

class AppDiscoveryService {
  private listeners: Set<AppDiscoveryListener> = new Set();
  private isInitialized = false;
  private accessibilityListener: any = null;

  /**
   * Initialize discovery service
   * 
   * 1. Load persisted apps
   * 2. Discover launcher apps (fast seed)
   * 3. Start async UsageStats discovery
   * 4. Listen for accessibility discoveries
   * 5. Resolve missing metadata
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[AppDiscovery] Already initialized');
      return;
    }

    console.log('[AppDiscovery] Initializing...');

    try {
      // 0. Run one-time migration (if needed)
      await migrateIconStorage();
      
      // 0.5. Force re-resolution for legacy apps (BEFORE resolution)
      await forceReresolution();
      
      // 1. Load persisted apps
      const cached = await loadDiscoveredApps();
      console.log(`[AppDiscovery] Loaded ${cached.length} cached apps`);

      // 2. Discover launcher apps (fast seed)
      const launcherApps = await AppDiscoveryModule.discoverLauncherApps();
      console.log(`[AppDiscovery] Found ${launcherApps.length} launcher apps`);
      await mergeApps(
        launcherApps.map(app => app.packageName),
        'launcher'
      );
      this.notifyListeners();

      // 3. Start async UsageStats discovery
      this.discoverUsageStatsAsync();

      // 4. Listen for accessibility discoveries
      this.listenForAccessibilityDiscoveries();

      // 5. Resolve missing metadata
      await this.resolveAllMetadata();
      
      // 6. Mark forced re-resolution complete (AFTER successful resolution)
      await markForceReresolutionComplete();

      this.isInitialized = true;
      console.log('[AppDiscovery] Initialization complete');
    } catch (error) {
      console.error('[AppDiscovery] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Discover apps via UsageStats (async backfill)
   * 
   * This may be slow - expected behavior.
   * Permission may not be granted yet - will retry later.
   */
  private async discoverUsageStatsAsync(): Promise<void> {
    try {
      const hasPermission = await AppDiscoveryModule.hasUsageStatsPermission();
      if (!hasPermission) {
        console.log('[AppDiscovery] UsageStats permission not granted, skipping discovery');
        return;
      }

      console.log('[AppDiscovery] Starting UsageStats discovery...');
      const usageApps = await AppDiscoveryModule.discoverUsageStatsApps(14);
      console.log(`[AppDiscovery] Found ${usageApps.length} apps from UsageStats`);

      await mergeApps(
        usageApps.map(app => app.packageName),
        'usage'
      );
      this.notifyListeners();

      // Resolve metadata for newly discovered apps
      await this.resolveAllMetadata();
    } catch (error: any) {
      if (error.code === 'NO_PERMISSION') {
        console.log('[AppDiscovery] UsageStats permission not granted, will retry later');
      } else {
        console.error('[AppDiscovery] UsageStats discovery failed:', error);
      }
    }
  }

  /**
   * Listen for accessibility-based app discoveries
   * 
   * Apps are discovered as they're opened (runtime discovery).
   */
  private listenForAccessibilityDiscoveries(): void {
    if (this.accessibilityListener) {
      return; // Already listening
    }

    this.accessibilityListener = appDiscoveryEmitter.addListener(
      'onAppDiscovered',
      async (event: DiscoveredAppInfo) => {
        console.log(`[AppDiscovery] App discovered via accessibility: ${event.packageName}`);
        
        await mergeApps([event.packageName], 'accessibility');
        await this.resolveMetadata(event.packageName);
        this.notifyListeners();
      }
    );

    console.log('[AppDiscovery] Listening for accessibility discoveries');
  }

  /**
   * Resolve metadata for all unresolved apps
   */
  async resolveAllMetadata(): Promise<void> {
    const unresolved = await getUnresolvedApps();
    console.log(`[AppDiscovery] Resolving metadata for ${unresolved.length} apps`);

    for (const app of unresolved) {
      await this.resolveMetadata(app.packageName);
    }
  }

  /**
   * Resolve metadata for a single app
   * 
   * MANDATORY step - every app must have icon + label.
   * Icons are saved to file system, only iconPath stored in metadata.
   */
  async resolveMetadata(packageName: string): Promise<void> {
    try {
      const metadata = await AppDiscoveryModule.resolveAppMetadata(packageName);

      if (metadata.uninstalled) {
        console.log(`[AppDiscovery] App uninstalled: ${packageName}`);
        await markUninstalled(packageName);
        this.notifyListeners();
        return;
      }

      if (metadata.resolved) {
        const apps = await loadDiscoveredApps();
        const app = apps.find(a => a.packageName === packageName);
        
        if (app) {
          // Save icon to file system (NEVER embed in metadata)
          let iconPath: string | null = null;
          if (metadata.icon) {
            iconPath = await saveAppIcon(packageName, metadata.icon);
          }
          
          // Save metadata with iconPath only
          await saveDiscoveredApp({
            ...app,
            label: metadata.label,
            iconPath: iconPath, // File path, NOT icon data
            metadataResolved: true,
            lastSeenAt: Date.now()
          });
          this.notifyListeners();
        }
      } else {
        // Temporary failure - will retry later
        console.log(`[AppDiscovery] Metadata resolution failed for ${packageName}: ${metadata.error}`);
      }
    } catch (error) {
      console.error(`[AppDiscovery] Failed to resolve metadata for ${packageName}:`, error);
    }
  }

  /**
   * Get active apps (not uninstalled, with resolved metadata)
   */
  async getActiveApps(): Promise<DiscoveredApp[]> {
    return await getActiveApps();
  }

  /**
   * Request UsageStats permission
   */
  async requestUsageStatsPermission(): Promise<boolean> {
    const hasPermission = await AppDiscoveryModule.hasUsageStatsPermission();
    if (!hasPermission) {
      await AppDiscoveryModule.openUsageStatsSettings();
      return false; // Permission not granted yet (user needs to enable in settings)
    }
    return true; // Permission already granted
  }

  /**
   * Subscribe to app list updates
   */
  subscribe(listener: AppDiscoveryListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    this.getActiveApps().then(apps => listener(apps));

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of app list changes
   */
  private async notifyListeners(): Promise<void> {
    const apps = await getActiveApps();
    this.listeners.forEach(listener => {
      try {
        listener(apps);
      } catch (error) {
        console.error('[AppDiscovery] Listener error:', error);
      }
    });
  }

  /**
   * Periodic reconciliation and cleanup
   * 
   * Should be called daily or on app start.
   */
  async reconcile(): Promise<void> {
    console.log('[AppDiscovery] Running reconciliation...');

    // Retry metadata resolution for unresolved apps
    await this.resolveAllMetadata();

    // Cleanup uninstalled apps (7 day grace period)
    await cleanupUninstalled();

    // Retry UsageStats discovery if permission was granted
    await this.discoverUsageStatsAsync();

    this.notifyListeners();
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.accessibilityListener) {
      this.accessibilityListener.remove();
      this.accessibilityListener = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const appDiscoveryService = new AppDiscoveryService();

// Auto-initialize on import (can be called manually if needed)
// appDiscoveryService.initialize().catch(console.error);
