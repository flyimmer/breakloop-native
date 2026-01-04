/**
 * OS Trigger Brain (Contract v1.1)
 * 
 * Tracks foreground app changes and records exit timestamps.
 * Implements app switch interval logic to prevent intervention spam.
 * Implements intention timer semantics per OS Trigger Contract.
 * 
 * Key Contract Rules:
 * - t_appSwitchInterval determines when a new conscious decision is required
 * - t_intention (intention timer) remains valid across brief exits
 * - Intention timers are overwritten ONLY when new intervention is triggered
 * - Expired intention triggers intervention (immediately if foreground, or on next entry)
 * 
 * SEMANTIC LAUNCHER FILTERING:
 * The native layer reports ALL foreground changes (including launchers).
 * This layer filters launchers semantically because:
 * - Launchers don't represent user intent to "use an app"
 * - On OEM devices, launchers briefly regain focus during transitions
 * - App switch interval should only count time between meaningful apps
 * - Easier to maintain launcher list in JS than in multiple native platforms
 */

import { 
  getAppSwitchIntervalMs, 
  isMonitoredApp, 
  getInterventionDurationSec, 
  getMonitoredAppsList,
  getQuickTaskDurationMs,
  getQuickTaskUsesPerWindow,
  getQuickTaskWindowMs
} from './osConfig';

// ============================================================================
// Launcher Filtering
// ============================================================================

/**
 * Known launcher package names.
 * Launchers are NOT treated as "meaningful apps" for intervention logic.
 * 
 * WHY FILTER LAUNCHERS?
 * - On OEM devices (Huawei/Honor, Xiaomi, Samsung), launchers briefly regain
 *   focus during app transitions, creating false "app switch" events.
 * - Launchers don't represent user intent to engage with content.
 * - App switch interval should measure time between actual apps, not launcher bounces.
 * 
 * Example without filtering:
 *   Instagram → Launcher (100ms) → YouTube
 *   = Two app switches, two interventions
 * 
 * With filtering:
 *   Instagram → [Launcher ignored] → YouTube
 *   = One app switch from Instagram to YouTube
 */
const LAUNCHER_PACKAGES = new Set([
  'com.android.launcher',           // AOSP launcher
  'com.android.launcher3',          // Pixel launcher
  'com.google.android.launcher',    // Google launcher
  'com.hihonor.android.launcher',   // Honor launcher
  'com.huawei.android.launcher',    // Huawei launcher
  'com.miui.home',                  // Xiaomi MIUI launcher
  'com.samsung.android.app.launcher', // Samsung One UI launcher
  'com.oppo.launcher',              // OPPO ColorOS launcher
  'com.vivo.launcher',              // Vivo launcher
  'com.oneplus.launcher',           // OnePlus launcher
  'com.teslacoilsw.launcher',       // Nova Launcher
  'com.microsoft.launcher',         // Microsoft Launcher
  'com.actionlauncher.playstore',   // Action Launcher
]);

/**
 * Check if a package is a launcher.
 * 
 * @param packageName - Package name to check
 * @returns True if this is a known launcher
 */
function isLauncher(packageName: string): boolean {
  return LAUNCHER_PACKAGES.has(packageName);
}

// ============================================================================
// Internal State
// ============================================================================

/**
 * Last foreground app (raw, includes launchers).
 * Tracks what native layer reports, used for exit timestamp inference.
 */
let lastForegroundApp: string | null = null;

/**
 * Last MEANINGFUL app (excludes launchers).
 * Used for app switch interval logic and intervention decisions.
 * This represents the last app the user actually engaged with.
 */
let lastMeaningfulApp: string | null = null;

/**
 * Exit timestamps for ALL apps (including launchers).
 * Maps packageName -> last exit timestamp.
 */
const lastExitTimestamps: Map<string, number> = new Map();

/**
 * Exit timestamps for MEANINGFUL apps only (excludes launchers).
 * Used for app switch interval calculations.
 * Maps packageName -> last meaningful exit timestamp.
 */
const lastMeaningfulExitTimestamps: Map<string, number> = new Map();

/**
 * Per-app intention timers (t_intention).
 * Maps packageName -> { expiresAt: timestamp }
 * 
 * Contract rules:
 * - Timers persist across app exits
 * - Timers are overwritten ONLY when new intervention is triggered
 * - Expired timers trigger intervention (immediately if foreground, on next entry otherwise)
 */
const intentionTimers: Map<string, { expiresAt: number }> = new Map();

/**
 * Track interventions in progress per app.
 * Prevents repeated intervention triggers for the same app until intervention completes.
 */
const interventionsInProgress: Set<string> = new Set();

/**
 * Quick Task usage history GLOBAL across all apps.
 * Array of timestamps when Quick Task was used (any app).
 * Used to enforce the "N uses per 15-minute window" limit GLOBALLY.
 * 
 * IMPORTANT: This is NOT per-app. Using Quick Task on Instagram
 * consumes the same quota as using it on TikTok.
 * Example: If limit is 2 uses per 15min, user can use Quick Task
 * twice total across ALL monitored apps, not 2 times per app.
 */
const quickTaskUsageHistory: number[] = [];

/**
 * Active Quick Task timers per app.
 * Maps packageName -> { expiresAt: timestamp }
 * When a Quick Task timer is active, the app can be used without intervention.
 */
const quickTaskTimers: Map<string, { expiresAt: number }> = new Map();

/**
 * Dispatch function for triggering interventions in React layer.
 * Set by setInterventionDispatcher() from App.tsx.
 */
let interventionDispatcher: ((action: any) => void) | null = null;

/**
 * Calculate remaining Quick Task uses GLOBALLY in the current 15-minute window.
 * Filters out timestamps older than 15 minutes.
 * 
 * IMPORTANT: This is GLOBAL across all apps, not per-app.
 * Using Quick Task on Instagram consumes the same quota as TikTok.
 * 
 * @param packageName - App package name (for logging only)
 * @param currentTimestamp - Current timestamp
 * @returns Number of Quick Task uses remaining GLOBALLY
 */
export function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
  const windowMs = getQuickTaskWindowMs();
  const maxUses = getQuickTaskUsesPerWindow();
  
  // Filter out timestamps older than 15 minutes from GLOBAL history
  const recentUsages = quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update global history with filtered timestamps
  if (recentUsages.length !== quickTaskUsageHistory.length) {
    quickTaskUsageHistory.length = 0;
    quickTaskUsageHistory.push(...recentUsages);
  }
  
  // Handle unlimited case (-1 represents unlimited for testing)
  if (maxUses === -1) {
    if (__DEV__) {
      console.log('[OS Trigger Brain] Quick Task availability check (GLOBAL):', {
        packageName,
        maxUses: 'Unlimited',
        recentUsagesGlobal: recentUsages.length,
        remaining: 'Unlimited',
        windowMinutes: windowMs / (60 * 1000),
        note: 'Usage is GLOBAL across all apps - UNLIMITED MODE (testing)',
      });
    }
    // Return a very large number to represent unlimited
    return Number.MAX_SAFE_INTEGER;
  }
  
  // Calculate remaining uses GLOBALLY
  const remaining = Math.max(0, maxUses - recentUsages.length);
  
  if (__DEV__) {
    console.log('[OS Trigger Brain] Quick Task availability check (GLOBAL):', {
      packageName,
      maxUses,
      recentUsagesGlobal: recentUsages.length,
      remaining,
      windowMinutes: windowMs / (60 * 1000),
      note: 'Usage is GLOBAL across all apps',
    });
  }
  
  return remaining;
}

/**
 * Record a Quick Task usage GLOBALLY.
 * Adds current timestamp to GLOBAL usage history.
 * 
 * IMPORTANT: This is GLOBAL, not per-app.
 * 
 * @param packageName - App package name (for logging only)
 * @param timestamp - Current timestamp
 */
function recordQuickTaskUsage(packageName: string, timestamp: number): void {
  quickTaskUsageHistory.push(timestamp);
  
  console.log('[OS Trigger Brain] Quick Task usage recorded (GLOBAL)', {
    packageName,
    timestamp,
    totalUsagesGlobal: quickTaskUsageHistory.length,
    note: 'Usage is GLOBAL across all apps',
  });
}

/**
 * Start intervention flow for a monitored app.
 * Handles cross-app interference prevention and dispatches BEGIN_INTERVENTION.
 * 
 * This function is called when the decision tree determines intervention should start.
 * It deletes t_intention as per spec: "intervention flow starts → t_intention deleted"
 * 
 * @param packageName - App package name requiring intervention
 * @param timestamp - Current timestamp
 */
function startInterventionFlow(packageName: string, timestamp: number): void {
  console.log('[OS Trigger Brain] ========================================');
  console.log('[OS Trigger Brain] Starting intervention flow for:', packageName);
  console.log('[OS Trigger Brain] Timestamp:', new Date(timestamp).toISOString());

  if (!interventionDispatcher) {
    console.warn('[OS Trigger Brain] No intervention dispatcher set - cannot trigger');
    console.log('[OS Trigger Brain] ========================================');
    return;
  }

  // CRITICAL CHECK: If there's already an intervention in progress for a DIFFERENT app,
  // DO NOT trigger a new intervention. This prevents cross-app interference.
  // Each app should have its own independent intervention flow.
  if (interventionsInProgress.size > 0) {
    const oldApps = Array.from(interventionsInProgress);
    const isDifferentApp = !oldApps.includes(packageName);
    
    if (isDifferentApp) {
      console.log('[OS Trigger Brain] ⚠️  Intervention already in progress for different app — BLOCKING new intervention', {
        requestedApp: packageName,
        appsInProgress: oldApps,
        reason: 'Prevent cross-app interference',
        note: 'Intervention will trigger when user returns to this app',
      });
      console.log('[OS Trigger Brain] ========================================');
      return;
    }
    
    // Same app - clear and restart (this shouldn't happen normally, but handle it)
    interventionsInProgress.clear();
    console.log('[OS Trigger Brain] Clearing previous intervention for same app', {
      app: packageName,
    });
  }

  // Mark intervention as in-progress for this app
  interventionsInProgress.add(packageName);

  // Delete t_intention (per spec: "intervention flow starts → t_intention deleted")
  intentionTimers.delete(packageName);
  console.log('[OS Trigger Brain] t_intention deleted (intervention starting)');

  console.log('[OS Trigger Brain] BEGIN_INTERVENTION dispatched', {
    packageName,
    timestamp,
    time: new Date(timestamp).toISOString(),
  });

  interventionDispatcher({
    type: 'BEGIN_INTERVENTION',
    app: packageName,
    breathingDuration: getInterventionDurationSec(),
  });
  
  console.log('[OS Trigger Brain] ========================================');
}

/**
 * Show Quick Task dialog for a monitored app.
 * 
 * @param packageName - App package name
 * @param remaining - Number of Quick Task uses remaining
 */
function showQuickTaskDialog(packageName: string, remaining: number): void {
  console.log('[OS Trigger Brain] ========================================');
  console.log('[OS Trigger Brain] Showing Quick Task dialog for:', packageName);
  console.log('[OS Trigger Brain] Quick Task uses remaining (global):', remaining);

  if (!interventionDispatcher) {
    console.warn('[OS Trigger Brain] No intervention dispatcher set - cannot show dialog');
    console.log('[OS Trigger Brain] ========================================');
    return;
  }

  // NOTE: We do NOT set interventionsInProgress flag here
  // Quick Task is separate from intervention
  interventionDispatcher({
    type: 'SHOW_QUICK_TASK',
    app: packageName,
    remaining: remaining,
  });
  
  console.log('[OS Trigger Brain] ========================================');
}

/**
 * Evaluate trigger logic using nested decision tree (OS Trigger Contract v1.1).
 * 
 * ARCHITECTURE: Implements NESTED priority logic per spec:
 * 1. Check t_intention (per-app)
 *    - If valid: suppress everything
 * 2. If t_intention = 0: Check n_quickTask (global)
 *    - If n_quickTask != 0: Check t_quickTask (per-app)
 *      - If t_quickTask != 0: suppress everything
 *      - If t_quickTask = 0: show Quick Task dialog
 *    - If n_quickTask = 0: start intervention flow
 * 
 * This function is called ONLY when t_appSwitchInterval has NOT elapsed.
 * When t_appSwitchInterval elapsed, intervention starts directly (bypassing this logic).
 * 
 * @param packageName - App package name
 * @param timestamp - Current timestamp
 */
function evaluateTriggerLogic(packageName: string, timestamp: number): void {
  console.log('[OS Trigger Brain] ========================================');
  console.log('[OS Trigger Brain] Evaluating nested trigger logic for:', packageName);
  console.log('[OS Trigger Brain] Timestamp:', new Date(timestamp).toISOString());

  // ============================================================================
  // Step 1: Check t_intention (per-app)
  // ============================================================================
  if (hasValidIntentionTimer(packageName, timestamp)) {
    const timer = intentionTimers.get(packageName);
    const remainingSec = timer ? Math.round((timer.expiresAt - timestamp) / 1000) : 0;
    console.log('[OS Trigger Brain] ✓ t_intention VALID (per-app)');
    console.log('[OS Trigger Brain] → SUPPRESS EVERYTHING');
    console.log('[OS Trigger Brain] → Remaining:', `${remainingSec}s`);
    console.log('[OS Trigger Brain] ========================================');
    return; // Suppress
  }
  console.log('[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)');

  // ============================================================================
  // Step 2: t_intention = 0 → Check n_quickTask (global)
  // ============================================================================
  const quickTaskRemaining = getQuickTaskRemaining(packageName, timestamp);
  
  if (quickTaskRemaining > 0) {
    console.log('[OS Trigger Brain] ✓ n_quickTask != 0 (uses remaining: ' + quickTaskRemaining + ')');
    
    // ============================================================================
    // Step 3: n_quickTask != 0 → Check t_quickTask (per-app)
    // ============================================================================
    if (hasActiveQuickTaskTimer(packageName, timestamp)) {
      const timer = quickTaskTimers.get(packageName);
      const remainingSec = timer ? Math.round((timer.expiresAt - timestamp) / 1000) : 0;
      console.log('[OS Trigger Brain] ✓ t_quickTask ACTIVE (per-app)');
      console.log('[OS Trigger Brain] → SUPPRESS EVERYTHING');
      console.log('[OS Trigger Brain] → Remaining:', `${remainingSec}s`);
      console.log('[OS Trigger Brain] ========================================');
      return; // Suppress
    }
    
    console.log('[OS Trigger Brain] ✗ t_quickTask = 0 (no active timer)');
    console.log('[OS Trigger Brain] → SHOW QUICK TASK DIALOG');
    console.log('[OS Trigger Brain] ========================================');
    showQuickTaskDialog(packageName, quickTaskRemaining);
    return;
  }
  
  // ============================================================================
  // Step 4: n_quickTask = 0 → Start intervention flow
  // ============================================================================
  console.log('[OS Trigger Brain] ✗ n_quickTask = 0 (no uses remaining)');
  console.log('[OS Trigger Brain] → START INTERVENTION FLOW');
  console.log('[OS Trigger Brain] ========================================');
  startInterventionFlow(packageName, timestamp);
}

/**
 * Set the intervention dispatcher function.
 * This connects the OS Trigger Brain to the React intervention state machine.
 * 
 * MUST be called from App.tsx on mount to wire up the intervention system.
 * 
 * @param dispatcher - Function to dispatch intervention actions
 */
export function setInterventionDispatcher(dispatcher: (action: any) => void): void {
  interventionDispatcher = dispatcher;
  console.log('[OS Trigger Brain] Intervention dispatcher connected');
}

/**
 * Dispatch SHOW_EXPIRED action to show Quick Task expired screen.
 * This bypasses the priority chain and shows ONLY the expired screen.
 * 
 * Called when native layer detects Quick Task timer expiration.
 * 
 * @param packageName - App package name whose Quick Task expired
 */
export function dispatchQuickTaskExpired(packageName: string): void {
  if (!interventionDispatcher) {
    console.error('[OS Trigger Brain] Cannot dispatch SHOW_EXPIRED - dispatcher not connected');
    return;
  }
  
  console.log('[OS Trigger Brain] Dispatching SHOW_EXPIRED for app:', packageName);
  interventionDispatcher({
    type: 'SHOW_EXPIRED',
    app: packageName,
  });
}

/**
 * Mark intervention as completed for an app.
 * Clears the in-progress flag so future expirations can trigger new interventions.
 * 
 * Called by intervention flow when user completes or dismisses the intervention.
 * 
 * @param packageName - App package name
 */
/**
 * Mark intervention as started for a package.
 * Called when user chooses "Continue" from Quick Task dialog to start intervention.
 */
export function onInterventionStarted(packageName: string): void {
  // Clear any existing interventions (only one at a time)
  if (interventionsInProgress.size > 0) {
    const oldApps = Array.from(interventionsInProgress);
    interventionsInProgress.clear();
    console.log('[OS Trigger Brain] Clearing previous intervention(s) for new intervention', {
      oldApps,
      newApp: packageName,
    });
  }

  interventionsInProgress.add(packageName);
  
  // Reset intention timer for this app (will be set again after intervention completes)
  intentionTimers.delete(packageName);
  
  console.log('[OS Trigger Brain] Intervention started, set in-progress flag', {
    packageName,
  });
}

export function onInterventionCompleted(packageName: string): void {
  interventionsInProgress.delete(packageName);
  console.log('[OS Trigger Brain] Intervention completed, cleared in-progress flag', {
    packageName,
  });
}

// ============================================================================
// DEV-ONLY TESTING HOOKS
// ============================================================================

/**
 * [DEV ONLY] Manually complete an intervention for testing.
 * Simulates the intervention flow calling onInterventionCompleted().
 * 
 * This function does NOTHING in production builds.
 * 
 * @param packageName - App package name
 */
export function completeInterventionDEV(packageName: string): void {
  if (__DEV__) {
    interventionsInProgress.delete(packageName);
    console.log('[OS Trigger Brain][DEV] Intervention completed for', {
      packageName,
      note: 'Manual completion via DEV hook',
    });
  }
}

/**
 * [DEV ONLY] Get list of apps currently with interventions in progress.
 * Useful for debugging and testing.
 * 
 * @returns Array of package names with active interventions
 */
export function getInterventionsInProgressDEV(): string[] {
  if (__DEV__) {
    return Array.from(interventionsInProgress);
  }
  return [];
}

/**
 * Handles foreground app change events from the OS.
 * Records exit timestamps and updates tracking state.
 * Implements semantic launcher filtering at the business logic layer.
 * 
 * @param app - App info containing packageName and timestamp
 */
export function handleForegroundAppChange(app: { packageName: string; timestamp: number }): void {
  const { packageName, timestamp } = app;

  // ============================================================================
  // Step 1: Record raw exit (for all apps, including launchers)
  // ============================================================================
  
  if (lastForegroundApp !== null && lastForegroundApp !== packageName) {
    lastExitTimestamps.set(lastForegroundApp, timestamp);
    console.log('[OS Trigger Brain] App exited foreground:', {
      packageName: lastForegroundApp,
      exitTimestamp: timestamp,
      exitTime: new Date(timestamp).toISOString(),
    });
  }

  // ============================================================================
  // Step 2: Semantic launcher filtering
  // ============================================================================
  
  const isLauncherEvent = isLauncher(packageName);
  
  if (isLauncherEvent) {
    // Launcher detected - log but don't treat as meaningful app
    if (__DEV__) {
      console.log('[OS Trigger Brain] Launcher event ignored for semantics:', {
        packageName,
        timestamp,
      });
    }
    
    // Update raw tracking (for exit inference) but NOT meaningful app tracking
    lastForegroundApp = packageName;
    
    // Do NOT update lastMeaningfulApp
    // Do NOT update lastMeaningfulExitTimestamps
    // Do NOT run intervention logic
    return;
  }

  // ============================================================================
  // Step 3: Handle meaningful app entry
  // ============================================================================
  
  // Record exit of last meaningful app (if transitioning between meaningful apps)
  if (lastMeaningfulApp !== null && lastMeaningfulApp !== packageName) {
    lastMeaningfulExitTimestamps.set(lastMeaningfulApp, timestamp);
    console.log('[OS Trigger Brain] Meaningful app exited:', {
      packageName: lastMeaningfulApp,
      exitTimestamp: timestamp,
      exitTime: new Date(timestamp).toISOString(),
    });
  }

  // Log the new meaningful app entering foreground (only on actual change)
  if (lastForegroundApp !== packageName) {
    console.log('[OS Trigger Brain] App entered foreground:', {
      packageName,
      timestamp,
      enterTime: new Date(timestamp).toISOString(),
    });
  }

  // ============================================================================
  // Step 4: Monitored app intervention logic
  // ============================================================================
  
  // Check if this is a monitored app
  const isMonitored = isMonitoredApp(packageName);
  
  if (!isMonitored) {
    // Not a monitored app - skip intervention logic
    if (lastMeaningfulApp !== packageName) {
      console.log('[OS Trigger Brain] App is NOT monitored, skipping intervention:', {
        packageName,
        monitoredAppsCount: getMonitoredAppsList().length,
        monitoredApps: getMonitoredAppsList(),
      });
    }
    // Update tracking but don't trigger intervention
    lastForegroundApp = packageName;
    if (packageName !== 'com.anonymous.breakloopnative') {
      lastMeaningfulApp = packageName;
    }
    return;
  }
  
  if (isMonitored) {
    // Log entry only when app actually changes
    if (lastMeaningfulApp !== packageName) {
      console.log('[OS Trigger Brain] Monitored app entered foreground:', {
        packageName,
        timestamp,
        time: new Date(timestamp).toISOString(),
      });
    }

    // ============================================================================
    // PRIORITY 0: Clean up expired Quick Task timer (if any)
    // ============================================================================
    const quickTaskTimer = quickTaskTimers.get(packageName);
    if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
      quickTaskTimers.delete(packageName);
      
      // Also clear from native layer
      try {
        const { NativeModules, Platform } = require('react-native');
        if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
          NativeModules.AppMonitorModule.clearQuickTaskTimer(packageName);
        }
      } catch (e) {
        // Ignore errors - native layer will handle its own expiration
      }
      
      console.log('[OS Trigger Brain] Quick Task timer expired and removed', {
        packageName,
        expiresAt: quickTaskTimer.expiresAt,
      });
    }

    // ============================================================================
    // PRIORITY 0: Clean up expired intention timer (if any)
    // ============================================================================
    const intentionTimer = intentionTimers.get(packageName);
    if (intentionTimer && timestamp > intentionTimer.expiresAt) {
      const expiredSec = Math.round((timestamp - intentionTimer.expiresAt) / 1000);
      console.log('[OS Trigger Brain] Intention timer expired (will be deleted)', {
        packageName,
        expiresAt: intentionTimer.expiresAt,
        expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
        expiredMs: timestamp - intentionTimer.expiresAt,
        expiredSec: `${expiredSec}s ago`,
      });
      intentionTimers.delete(packageName);
    }

    // ============================================================================
    // Skip logic for heartbeat events (same app, no actual switch)
    // ============================================================================
    if (lastMeaningfulApp === packageName) {
      // This is a heartbeat event for the same app - skip all logic
      lastForegroundApp = packageName;
      return;
    }

    // ============================================================================
    // PRIORITY 1: Check t_appSwitchInterval (HIGHEST PRIORITY per spec)
    // ============================================================================
    // Per spec: "t_appSwitchInterval has a higher priority than t_intention"
    // When t_appSwitchInterval elapsed → intervention MUST start (regardless of t_intention)
    
    const lastExitTimestamp = lastMeaningfulExitTimestamps.get(packageName);
    const intervalMs = getAppSwitchIntervalMs();

    let appSwitchIntervalElapsed = false;
    if (lastExitTimestamp === undefined) {
      // First entry ever - treat as elapsed
      appSwitchIntervalElapsed = true;
      console.log('[OS Trigger Brain] First entry for this app (no previous exit)');
    } else {
      const timeSinceExit = timestamp - lastExitTimestamp;
      appSwitchIntervalElapsed = timeSinceExit >= intervalMs;
      
      const intervalSec = Math.round(intervalMs / 1000);
      const timeSinceExitSec = Math.round(timeSinceExit / 1000);
      
      if (appSwitchIntervalElapsed) {
        console.log('[OS Trigger Brain] ✓ t_appSwitchInterval ELAPSED (HIGHEST PRIORITY)', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          timeSinceExitSec: `${timeSinceExitSec}s`,
          intervalMs,
          intervalSec: `${intervalSec}s`,
          lastExitTimestamp,
          currentTimestamp: timestamp,
        });
      } else {
        console.log('[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          timeSinceExitSec: `${timeSinceExitSec}s`,
          intervalMs,
          intervalSec: `${intervalSec}s`,
          note: 'Will apply nested logic',
        });
      }
    }

    if (appSwitchIntervalElapsed) {
      // t_appSwitchInterval elapsed → Start intervention directly
      // Per spec: "intervention should start. Since intervention flow will restart, 
      // the t_intention for this app shall be deleted"
      console.log('[OS Trigger Brain] → START INTERVENTION (app switch interval elapsed)');
      startInterventionFlow(packageName, timestamp);
      
      // Update tracking
      lastForegroundApp = packageName;
      lastMeaningfulApp = packageName;
      return;
    }

    // ============================================================================
    // PRIORITY 2: t_appSwitchInterval NOT elapsed → Apply nested logic
    // ============================================================================
    // Nested decision tree:
    // 1. Check t_intention
    // 2. If t_intention = 0: Check n_quickTask
    //    - If n_quickTask != 0: Check t_quickTask
    //      - If t_quickTask != 0: suppress
    //      - If t_quickTask = 0: show Quick Task dialog
    //    - If n_quickTask = 0: start intervention
    
    evaluateTriggerLogic(packageName, timestamp);
    
    // Update tracking
    lastForegroundApp = packageName;
    lastMeaningfulApp = packageName;
  } else {
    // Non-monitored app in foreground - but we still need to check ALL monitored app timers
    // because per spec: "t_intention counts down independently of which app is in foreground"
    for (const [monitoredPkg, timer] of intentionTimers.entries()) {
      if (timestamp > timer.expiresAt) {
        console.log('[OS Trigger Brain] Monitored app timer expired (not in foreground) — intervention on next entry', {
          packageName: monitoredPkg,
          currentForegroundApp: packageName,
          expiresAt: timer.expiresAt,
          expiresAtTime: new Date(timer.expiresAt).toISOString(),
          currentTimestamp: timestamp,
          currentTime: new Date(timestamp).toISOString(),
          expiredMs: timestamp - timer.expiresAt,
        });
        // Timer expired while user was in different app
        // Intervention will trigger when they re-open the monitored app
      }
    }
  }

  // Update tracking (both raw and meaningful)
  lastForegroundApp = packageName;
  lastMeaningfulApp = packageName;
}

/**
 * Get the last exit timestamp for a specific app (for debugging/testing).
 */
export function getLastExitTimestamp(packageName: string): number | undefined {
  return lastExitTimestamps.get(packageName);
}

/**
 * Get the current foreground app (raw, for debugging/testing).
 */
export function getCurrentForegroundApp(): string | null {
  return lastForegroundApp;
}

/**
 * Get the current meaningful app (excludes launchers, for debugging/testing).
 */
export function getCurrentMeaningfulApp(): string | null {
  return lastMeaningfulApp;
}

/**
 * Set intention timer for an app (called after user completes intervention).
 * 
 * @param packageName - App package name
 * @param durationMs - Duration in milliseconds (t_intention)
 * @param currentTimestamp - Current timestamp
 */
export function setIntentionTimer(packageName: string, durationMs: number, currentTimestamp: number): void {
  const expiresAt = currentTimestamp + durationMs;
  const durationSec = Math.round(durationMs / 1000);
  intentionTimers.set(packageName, { expiresAt });
  
  console.log('[OS Trigger Brain] Intention timer set', {
    packageName,
    durationMs,
    durationSec: `${durationSec}s`,
    expiresAt,
    expiresAtTime: new Date(expiresAt).toISOString(),
  });
}

/**
 * Get intention timer for an app (for debugging/testing).
 */
export function getIntentionTimer(packageName: string): { expiresAt: number } | undefined {
  return intentionTimers.get(packageName);
}

/**
 * Check if an app has a valid (not expired) intention timer.
 * Used by priority chain to determine if intervention should be suppressed.
 * 
 * @param packageName - App package name
 * @param timestamp - Current timestamp
 * @returns true if intention timer exists and hasn't expired
 */
function hasValidIntentionTimer(packageName: string, timestamp: number): boolean {
  const timer = intentionTimers.get(packageName);
  if (!timer) {
    return false;
  }
  return timestamp < timer.expiresAt;
}

/**
 * Set Quick Task timer for an app (called when user activates Quick Task).
 * 
 * This function:
 * 1. Sets the timer in JavaScript memory (for JS-side checks)
 * 2. Calls native module to store timer (for native-side checks)
 * 
 * The native layer needs the timer so it can skip launching InterventionActivity
 * when the user returns to the monitored app during the Quick Task window.
 * 
 * @param packageName - App package name
 * @param durationMs - Duration in milliseconds (t_quickTask)
 * @param currentTimestamp - Current timestamp
 */
export function setQuickTaskTimer(packageName: string, durationMs: number, currentTimestamp: number): void {
  // Check if timer already exists and is still valid
  const existingTimer = quickTaskTimers.get(packageName);
  if (existingTimer && currentTimestamp < existingTimer.expiresAt) {
    const remainingSec = Math.round((existingTimer.expiresAt - currentTimestamp) / 1000);
    console.log('[OS Trigger Brain] Quick Task timer already active, skipping', {
      packageName,
      existingExpiresAt: existingTimer.expiresAt,
      remainingSec: `${remainingSec}s remaining`,
    });
    return; // Don't set a new timer or record usage
  }
  
  const expiresAt = currentTimestamp + durationMs;
  const durationMin = Math.round(durationMs / (60 * 1000));
  quickTaskTimers.set(packageName, { expiresAt });
  
  // Record usage
  recordQuickTaskUsage(packageName, currentTimestamp);
  
  // Store timer in native layer so ForegroundDetectionService can check it
  // This prevents InterventionActivity from being launched during Quick Task
  try {
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
      NativeModules.AppMonitorModule.storeQuickTaskTimer(packageName, expiresAt);
      console.log('[OS Trigger Brain] Quick Task timer stored in native layer');
    }
  } catch (e) {
    console.warn('[OS Trigger Brain] Failed to store Quick Task timer in native layer:', e);
  }
  
  console.log('[OS Trigger Brain] Quick Task timer set', {
    packageName,
    durationMs,
    durationMin: `${durationMin}min`,
    expiresAt,
    expiresAtTime: new Date(expiresAt).toISOString(),
  });
}

/**
 * Get Quick Task timer for an app (for debugging/testing).
 */
export function getQuickTaskTimer(packageName: string): { expiresAt: number } | undefined {
  return quickTaskTimers.get(packageName);
}

/**
 * Check if a specific app has an active Quick Task timer (per-app check).
 * Used by priority chain to determine if intervention should be suppressed for this app.
 * 
 * NOTE: Quick Task timers are PER-APP, not global.
 * Each app has its own independent Quick Task timer.
 * Only n_quickTask (usage count) is global.
 * 
 * @param packageName - App package name to check
 * @param timestamp - Current timestamp
 * @returns true if this specific app has an active Quick Task timer
 */
function hasActiveQuickTaskTimer(packageName: string, timestamp: number): boolean {
  const timer = quickTaskTimers.get(packageName);
  if (!timer) {
    return false;
  }
  return timestamp < timer.expiresAt;
}

/**
 * Check if any Quick Task timer has expired.
 * Should be called periodically to detect expiration and show QuickTaskExpired screen.
 * 
 * @param currentTimestamp - Current timestamp
 * @returns Package name of app whose Quick Task expired, or null if none expired
 */
export function checkQuickTaskExpiration(currentTimestamp: number): string | null {
  for (const [packageName, timer] of quickTaskTimers.entries()) {
    if (currentTimestamp >= timer.expiresAt) {
      // Quick Task expired!
      console.log('[OS Trigger Brain] Quick Task timer expired!', {
        packageName,
        expiresAt: timer.expiresAt,
        expiresAtTime: new Date(timer.expiresAt).toISOString(),
        currentTime: new Date(currentTimestamp).toISOString(),
      });
      
      // Remove the expired timer from JS memory
      quickTaskTimers.delete(packageName);
      
      // Also clear from native layer
      try {
        const { NativeModules, Platform } = require('react-native');
        if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
          NativeModules.AppMonitorModule.clearQuickTaskTimer(packageName);
          console.log('[OS Trigger Brain] Quick Task timer cleared from native layer');
        }
      } catch (e) {
        console.warn('[OS Trigger Brain] Failed to clear Quick Task timer from native layer:', e);
      }
      
      return packageName;
    }
  }
  
  return null;
}

/**
 * Check if intention timer has expired for the current foreground app.
 * Should be called periodically (e.g., every 10 seconds) to detect in-app expiration.
 * 
 * @param currentTimestamp - Current timestamp
 */
export function checkForegroundIntentionExpiration(currentTimestamp: number): void {
  // Check ALL monitored apps with active intention timers
  // IMPORTANT: Only trigger intervention for the CURRENT foreground app
  // For background apps, just delete the expired timer - intervention will trigger on next entry
  
  // Debug: Always log that the check is running
  if (__DEV__ && intentionTimers.size > 0) {
    console.log('[OS Trigger Brain] Periodic timer check running', {
      currentTimestamp,
      currentTime: new Date(currentTimestamp).toISOString(),
      activeTimers: intentionTimers.size,
      currentForegroundApp: lastMeaningfulApp,
    });
  }
  
  for (const [packageName, timer] of intentionTimers.entries()) {
    if (!isMonitoredApp(packageName)) {
      continue;
    }
    
    // Debug: Log each timer being checked
    if (__DEV__) {
      const remainingMs = timer.expiresAt - currentTimestamp;
      const remainingSec = Math.round(remainingMs / 1000);
      console.log('[OS Trigger Brain] Checking timer for', {
        packageName,
        expiresAt: timer.expiresAt,
        expiresAtTime: new Date(timer.expiresAt).toISOString(),
        currentTimestamp,
        currentTime: new Date(currentTimestamp).toISOString(),
        remainingMs,
        remainingSec: `${remainingSec}s`,
        expired: currentTimestamp > timer.expiresAt,
        isForeground: packageName === lastMeaningfulApp,
      });
    }
    
    if (currentTimestamp > timer.expiresAt) {
      const expiredMs = currentTimestamp - timer.expiresAt;
      const expiredSec = Math.round(expiredMs / 1000);
      
      // CRITICAL FIX: Only trigger intervention if this is the CURRENT foreground app
      // For background apps, just delete the timer - intervention will trigger on next entry
      const isForeground = packageName === lastMeaningfulApp;
      
      if (isForeground) {
        console.log('[OS Trigger Brain] Intention timer expired for FOREGROUND app — re-evaluating logic', {
          packageName,
          expiresAt: timer.expiresAt,
          expiresAtTime: new Date(timer.expiresAt).toISOString(),
          currentTimestamp,
          currentTime: new Date(currentTimestamp).toISOString(),
          expiredMs,
          expiredSec: `${expiredSec}s`,
        });
        
        // Clear the expired timer
        intentionTimers.delete(packageName);
        
        // Re-evaluate using nested logic (not direct intervention)
        // This respects the priority chain: t_intention expired → check n_quickTask, etc.
        evaluateTriggerLogic(packageName, currentTimestamp);
      } else {
        console.log('[OS Trigger Brain] Intention timer expired for BACKGROUND app — deleting timer', {
          packageName,
          currentForegroundApp: lastMeaningfulApp,
          expiresAt: timer.expiresAt,
          expiresAtTime: new Date(timer.expiresAt).toISOString(),
          currentTimestamp,
          currentTime: new Date(currentTimestamp).toISOString(),
          expiredMs,
          expiredSec: `${expiredSec}s`,
          note: 'Timer deleted - intervention will trigger when user returns to this app',
        });
        
        // DELETE the expired timer for background app
        // When user returns to this app, handleForegroundAppChange() will see:
        // 1. No intention timer exists
        // 2. App switch interval has elapsed (because timer was set long ago)
        // 3. Will trigger new intervention at that time
        intentionTimers.delete(packageName);
        
        // DO NOT trigger intervention - wait for user to return to this app
      }
    }
  }
}

/**
 * Check if intention timer has expired for background apps.
 * Called periodically to detect expiration when app is not in foreground.
 * 
 * @param currentTimestamp - Current timestamp
 */
export function checkBackgroundIntentionExpiration(currentTimestamp: number): void {
  for (const [packageName, timer] of intentionTimers.entries()) {
    // Only check apps that are NOT the current meaningful app (meaningful app expiration is checked separately)
    if (packageName !== lastMeaningfulApp && currentTimestamp > timer.expiresAt) {
      console.log('[OS Trigger Brain] Background intention timer expired — intervention on next entry', {
        packageName,
        expiresAt: timer.expiresAt,
        currentTimestamp,
        expiredMs: currentTimestamp - timer.expiresAt,
      });
      // Note: Intervention will trigger when app enters foreground
      // Timer is NOT cleared - it will be detected on next entry
    }
  }
}

/**
 * Reset all tracking state (for testing/debugging).
 */
export function resetTrackingState(): void {
  lastForegroundApp = null;
  lastMeaningfulApp = null;
  lastExitTimestamps.clear();
  lastMeaningfulExitTimestamps.clear();
  intentionTimers.clear();
  interventionsInProgress.clear();
  quickTaskTimers.clear();
  // NOTE: Do NOT clear quickTaskUsageHistory!
  // Usage quota is time-based (15-minute rolling window) and should persist
  // until timestamps naturally expire. Clearing it would incorrectly reset
  // the usage count and allow users to bypass the quota limit.
  console.log('[OS Trigger Brain] Tracking state reset (timers cleared, usage history preserved)');
}

