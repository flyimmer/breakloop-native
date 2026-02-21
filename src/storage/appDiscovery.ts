/**
 * App Discovery Storage Layer
 * 
 * Manages persistence of discovered apps from multiple sources:
 * - Launcher (L): Fast seed from launcher intent query
 * - UsageStats (U): Async backfill from usage history
 * - Accessibility (A): Runtime discovery as apps are opened
 * 
 * Final list = UNION(L, U, A)
 * 
 * ARCHITECTURE INVARIANT:
 * Icons are NEVER embedded in metadata objects.
 * Icons are stored as PNG files in the file system.
 * Metadata contains only iconPath (file path to PNG).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { AppCategory } from '../../constants/appCategories';

const STORAGE_KEY = 'discovered_apps_v1';
const MIGRATION_KEY = 'icon_migration_v1_complete';
const FORCE_RERESOLUTION_KEY = 'force_reresolution_v1_complete';
const UNINSTALLED_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ICON_DIR = new Directory(Paths.document, 'app-icons');

/**
 * Normalize file URI to ensure it has the file:// prefix
 * Required for React Native <Image /> component on Android
 * 
 * @param uri - File URI from File.uri
 * @returns Normalized URI with file:// prefix
 */
function normalizeFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

export type DiscoverySource = 'launcher' | 'usage' | 'accessibility';

export interface DiscoveredApp {
  packageName: string;
  label: string | null;
  iconPath: string | null; // File path to icon PNG (NOT icon data)
  firstSeenAt: number;
  lastSeenAt: number;
  sources: DiscoverySource[];
  metadataResolved: boolean;
  uninstalled: boolean;
  uninstalledAt?: number; // Timestamp when marked as uninstalled
  /**
   * Resolved BreakLoop category.
   * Set once during metadata resolution (native category + static fallback).
   * Undefined for apps that haven't been through metadata resolution yet.
   */
  appCategory?: AppCategory;
}

/**
 * Get file path for app icon
 */
export function getIconPath(packageName: string): string {
  const file = new File(ICON_DIR, `${packageName}.png`);
  return normalizeFileUri(file.uri);
}

/**
 * Helper to check if icon file exists
 */
function iconFileExists(iconPath: string | null): boolean {
  if (!iconPath) return false;
  try {
    // Extract filename from path
    const filename = iconPath.split('/').pop();
    if (!filename) return false;

    const file = new File(ICON_DIR, filename);
    return file.exists;
  } catch {
    return false;
  }
}

/**
 * Ensure icon directory exists
 */
async function ensureIconDirectory(): Promise<void> {
  try {
    // Check if directory exists before creating
    if (!ICON_DIR.exists) {
      ICON_DIR.create();
      console.log('[AppDiscovery] Created icon directory:', ICON_DIR.uri);
    }
  } catch (error) {
    console.error('[AppDiscovery] Failed to create icon directory:', error);
    throw error;
  }
}

/**
 * Save app icon to file system
 * 
 * Converts base64 to PNG and saves to file system.
 * Creates directory if missing.
 * Handles overwrite safely (same package updated).
 * 
 * @param packageName - Package name of the app
 * @param iconBase64 - Base64-encoded icon data
 * @returns File path to saved icon, or null if save failed
 */
export async function saveAppIcon(packageName: string, iconBase64: string): Promise<string | null> {
  try {
    // Ensure directory exists
    await ensureIconDirectory();

    const file = new File(ICON_DIR, `${packageName}.png`);

    // Write base64 data directly with explicit encoding
    // This preserves binary integrity and prevents PNG corruption
    // Try new API first: file.write(iconBase64, { encoding: 'base64' })
    // If unsupported, fall back to: FileSystemLegacy.writeAsStringAsync()
    try {
      // Attempt to use new File API with base64 encoding
      file.write(iconBase64, { encoding: 'base64' });
    } catch (newApiError: any) {
      // Fall back to legacy API if new API doesn't support base64 encoding
      const iconPath = normalizeFileUri(file.uri);
      await FileSystemLegacy.writeAsStringAsync(iconPath, iconBase64, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
    }

    // Verify file exists after write
    if (!file.exists) {
      throw new Error('File write succeeded but file does not exist');
    }

    const normalizedUri = normalizeFileUri(file.uri);
    return normalizedUri;
  } catch (error) {
    console.error(`[AppDiscovery] Failed to save icon for ${packageName}:`, error);
    return null; // Don't crash, just return null
  }
}

/**
 * Load app icon from file system
 * 
 * @param packageName - Package name of the app
 * @returns File URI to icon, or null if not found
 */
export async function loadAppIcon(packageName: string): Promise<string | null> {
  try {
    await ensureIconDirectory(); // REFINEMENT 1: Always ensure directory

    const file = new File(ICON_DIR, `${packageName}.png`);

    // Check if file exists (property, not async)
    if (!file.exists) {
      return null;
    }

    // REFINEMENT 2: Return file URI directly for React Native <Image />
    // This is faster and uses less memory than base64 conversion
    // Normalize to ensure file:// prefix for Android compatibility
    return normalizeFileUri(file.uri);
  } catch (error) {
    console.error(`[AppDiscovery] Failed to load icon for ${packageName}:`, error);
    return null; // Don't crash, just return null
  }
}

/**
 * Remove app icon from file system
 * 
 * @param packageName - Package name of the app
 */
export async function removeAppIcon(packageName: string): Promise<void> {
  try {
    await ensureIconDirectory(); // REFINEMENT 1: Always ensure directory

    const file = new File(ICON_DIR, `${packageName}.png`);

    // Check if file exists before deleting (property, not async)
    if (file.exists) {
      file.delete();
      console.log(`[AppDiscovery] Removed icon for ${packageName}`);
    }
  } catch (error) {
    console.error(`[AppDiscovery] Failed to remove icon for ${packageName}:`, error);
    // Don't throw - cleanup failures shouldn't crash
  }
}

/**
 * Load all discovered apps from storage
 */
export async function loadDiscoveredApps(): Promise<DiscoveredApp[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    const apps = JSON.parse(data) as DiscoveredApp[];
    // Convert sources array back to array (JSON doesn't preserve Set)
    return apps.map(app => ({
      ...app,
      sources: app.sources || []
    }));
  } catch (error) {
    console.error('[AppDiscovery] Failed to load apps:', error);
    return [];
  }
}

/**
 * Save a single discovered app (upsert)
 */
export async function saveDiscoveredApp(app: DiscoveredApp): Promise<void> {
  try {
    const apps = await loadDiscoveredApps();
    const existingIndex = apps.findIndex(a => a.packageName === app.packageName);

    if (existingIndex >= 0) {
      // Merge with existing app
      const existing = apps[existingIndex];
      apps[existingIndex] = {
        ...existing,
        ...app,
        // Merge sources
        sources: [...new Set([...existing.sources, ...app.sources])],
        // Preserve firstSeenAt
        firstSeenAt: existing.firstSeenAt,
        // Update lastSeenAt
        lastSeenAt: Math.max(existing.lastSeenAt, app.lastSeenAt || Date.now())
      };
    } else {
      // New app
      apps.push({
        ...app,
        firstSeenAt: app.firstSeenAt || Date.now(),
        lastSeenAt: app.lastSeenAt || Date.now()
      });
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (error) {
    console.error('[AppDiscovery] Failed to save app:', error);
    throw error;
  }
}

/**
 * Merge apps from a discovery source
 */
export async function mergeApps(
  packageNames: string[],
  source: DiscoverySource
): Promise<void> {
  try {
    const apps = await loadDiscoveredApps();
    const now = Date.now();

    for (const packageName of packageNames) {
      const existingIndex = apps.findIndex(a => a.packageName === packageName);

      if (existingIndex >= 0) {
        // Update existing app
        const existing = apps[existingIndex];
        apps[existingIndex] = {
          ...existing,
          sources: [...new Set([...existing.sources, source])],
          lastSeenAt: Math.max(existing.lastSeenAt, now),
          // If app was marked uninstalled but we see it again, unmark it
          uninstalled: false,
          uninstalledAt: undefined
        };
      } else {
        // New app
        apps.push({
          packageName,
          label: null,
          iconPath: null,
          firstSeenAt: now,
          lastSeenAt: now,
          sources: [source],
          metadataResolved: false,
          uninstalled: false
        });
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (error) {
    console.error('[AppDiscovery] Failed to merge apps:', error);
    throw error;
  }
}

/**
 * Mark an app as uninstalled (soft delete)
 * Also removes icon file from file system
 */
export async function markUninstalled(packageName: string): Promise<void> {
  try {
    const apps = await loadDiscoveredApps();
    const appIndex = apps.findIndex(a => a.packageName === packageName);

    if (appIndex >= 0) {
      apps[appIndex] = {
        ...apps[appIndex],
        uninstalled: true,
        uninstalledAt: Date.now()
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));

      // Remove icon file
      await removeAppIcon(packageName);
    }
  } catch (error) {
    console.error('[AppDiscovery] Failed to mark uninstalled:', error);
    throw error;
  }
}

/**
 * Cleanup apps that were uninstalled beyond grace period
 * Also removes orphaned icon files
 */
export async function cleanupUninstalled(): Promise<void> {
  try {
    const apps = await loadDiscoveredApps();
    const now = Date.now();
    const removedApps: string[] = [];

    const activeApps = apps.filter(app => {
      if (!app.uninstalled) {
        return true; // Keep active apps
      }

      // Remove if uninstalled beyond grace period
      if (app.uninstalledAt && (now - app.uninstalledAt) > UNINSTALLED_GRACE_PERIOD_MS) {
        removedApps.push(app.packageName);
        return false; // Remove
      }

      return true; // Keep (still in grace period)
    });

    if (activeApps.length !== apps.length) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(activeApps));
      console.log(`[AppDiscovery] Cleaned up ${apps.length - activeApps.length} uninstalled apps`);

      // Remove icon files for removed apps
      for (const packageName of removedApps) {
        await removeAppIcon(packageName);
      }
    }
  } catch (error) {
    console.error('[AppDiscovery] Failed to cleanup uninstalled:', error);
    throw error;
  }
}

/**
 * Get active apps (not uninstalled, with resolved metadata)
 */
export async function getActiveApps(): Promise<DiscoveredApp[]> {
  const apps = await loadDiscoveredApps();
  return apps.filter(app => !app.uninstalled && app.metadataResolved);
}

/**
 * Get apps pending metadata resolution
 */
export async function getUnresolvedApps(): Promise<DiscoveredApp[]> {
  const apps = await loadDiscoveredApps();
  return apps.filter(app => !app.uninstalled && !app.metadataResolved);
}

/**
 * Migrate icon storage from old format to new format
 * 
 * Old format: icons embedded in metadata as base64 strings
 * New format: icons stored as PNG files, only iconPath in metadata
 * 
 * This migration runs once on app start.
 */
export async function migrateIconStorage(): Promise<void> {
  try {
    // Check if migration already completed
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated === 'true') {
      console.log('[AppDiscovery] Icon migration already completed');
      return;
    }

    console.log('[AppDiscovery] Starting icon migration...');

    // Load old format data
    const oldData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!oldData) {
      // No data to migrate
      await AsyncStorage.setItem(MIGRATION_KEY, 'true');
      console.log('[AppDiscovery] No data to migrate');
      return;
    }

    const oldApps = JSON.parse(oldData);
    let migratedCount = 0;

    // Migrate each app
    for (const app of oldApps) {
      // Check if app has old format icon field
      if (app.icon && typeof app.icon === 'string') {
        // Save icon to file system
        const iconPath = await saveAppIcon(app.packageName, app.icon);
        if (iconPath) {
          app.iconPath = iconPath;
          migratedCount++;
        }
        // Remove old icon field
        delete app.icon;
      }
    }

    // Save migrated data
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(oldApps));
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');

    console.log(`[AppDiscovery] Icon migration complete: ${migratedCount} icons migrated`);
  } catch (error) {
    console.error('[AppDiscovery] Icon migration failed:', error);
    // Don't throw - migration failure shouldn't crash the app
    // Will retry on next app start
  }
}

/**
 * Force re-resolution for legacy apps that have metadataResolved=true but no valid iconPath
 * 
 * This is a one-time migration that marks legacy apps as unresolved so they go through
 * metadata resolution again with the new file-based icon storage.
 */
export async function forceReresolution(): Promise<void> {
  try {
    const alreadyForced = await AsyncStorage.getItem(FORCE_RERESOLUTION_KEY);
    if (alreadyForced === 'true') {
      return;
    }

    const apps = await loadDiscoveredApps();

    // Only mark apps as unresolved if they have legacy state
    // (metadataResolved=true but no valid iconPath)
    const updatedApps = apps.map(app => {
      const needsReresolution =
        app.metadataResolved &&
        (!app.iconPath || !iconFileExists(app.iconPath));

      if (!needsReresolution) return app;

      return {
        ...app,
        metadataResolved: false,
        iconPath: null,
      };
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedApps));
  } catch (error) {
    console.error('[AppDiscovery] Forced re-resolution failed:', error);
  }
}

/**
 * Mark forced re-resolution as complete
 * 
 * This should be called AFTER successful metadata resolution to ensure
 * the flag is only set when migration + resolution both completed successfully.
 */
export async function markForceReresolutionComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(FORCE_RERESOLUTION_KEY, 'true');
  } catch (error) {
    console.error('[AppDiscovery] Failed to mark re-resolution complete:', error);
  }
}
