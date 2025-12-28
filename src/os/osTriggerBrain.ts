/**
 * OS Trigger Brain (Contract v1.1)
 * 
 * Tracks foreground app changes and records exit timestamps.
 * Implements app switch interval logic to prevent intervention spam.
 * Implements intention timer semantics per OS Trigger Contract.
 * 
 * Key Contract Rules:
 * - t_appSwitchInterval determines when a new conscious decision is required
 * - t_monitored (intention timer) remains valid across brief exits
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

import { getAppSwitchIntervalMs, isMonitoredApp } from './osConfig';

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
 * Per-app intention timers (t_monitored).
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
 * Trigger intervention for a monitored app (Step 5F).
 * Dispatches exactly ONE intervention and prevents repeated triggers.
 * 
 * @param packageName - App package name requiring intervention
 * @param timestamp - Current timestamp
 */
function triggerIntervention(packageName: string, timestamp: number): void {
  // Check if intervention already in progress for this app
  if (interventionsInProgress.has(packageName)) {
    // Silent - no log spam for repeated checks
    return;
  }

  // Mark intervention as in-progress
  interventionsInProgress.add(packageName);

  // Reset/overwrite intention timer for this app (will be set again after intervention completes)
  intentionTimers.delete(packageName);

  console.log('[OS Trigger Brain] BEGIN_INTERVENTION dispatched', {
    packageName,
    timestamp,
    time: new Date(timestamp).toISOString(),
  });

  // TODO Step 5G: Dispatch to intervention state machine
  // dispatchIntervention({ type: 'BEGIN_INTERVENTION', appPackageName: packageName });
}

/**
 * Mark intervention as completed for an app.
 * Clears the in-progress flag so future expirations can trigger new interventions.
 * 
 * Called by intervention flow when user completes or dismisses the intervention.
 * 
 * @param packageName - App package name
 */
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
  if (isMonitoredApp(packageName)) {
    // Log entry only when app actually changes
    if (lastMeaningfulApp !== packageName) {
      console.log('[OS Trigger Brain] Monitored app entered foreground:', {
        packageName,
        timestamp,
      });

      // FOR TESTING: Auto-set a 2-minute intention timer on first entry if none exists
      // TODO: Remove this when real intervention flow is wired
      if (!intentionTimers.has(packageName)) {
        const testDuration = 2 * 60 * 1000; // 2 minutes
        setIntentionTimer(packageName, testDuration, timestamp);
        console.log('[OS Trigger Brain] DEBUG: Auto-set test intention timer (2 min)');
      }
    }

    // ALWAYS check if intention timer has expired (even on heartbeat events)
    const intentionTimer = intentionTimers.get(packageName);
    if (intentionTimer && timestamp > intentionTimer.expiresAt) {
      const expiredSec = Math.round((timestamp - intentionTimer.expiresAt) / 1000);
      console.log('[OS Trigger Brain] Intention timer expired — intervention required', {
        packageName,
        expiresAt: intentionTimer.expiresAt,
        expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
        currentTimestamp: timestamp,
        currentTime: new Date(timestamp).toISOString(),
        expiredMs: timestamp - intentionTimer.expiresAt,
        expiredSec: `${expiredSec}s ago`,
      });
      
      // Trigger intervention (Step 5F)
      triggerIntervention(packageName, timestamp);
      
      // Update tracking and return
      lastForegroundApp = packageName;
      lastMeaningfulApp = packageName;
      return;
    }

    // Only run app switch interval logic on actual entry (not heartbeat)
    if (lastMeaningfulApp === packageName) {
      // This is a heartbeat event for the same app - skip interval logic
      lastForegroundApp = packageName;
      return;
    }

    // Check app switch interval logic (t_appSwitchInterval)
    // Use meaningful exit timestamps (excludes launcher bounces)
    const lastExitTimestamp = lastMeaningfulExitTimestamps.get(packageName);
    const intervalMs = getAppSwitchIntervalMs();

    if (lastExitTimestamp !== undefined) {
      // App was previously exited - check if enough time has passed
      const timeSinceExit = timestamp - lastExitTimestamp;

      if (timeSinceExit < intervalMs) {
        const intervalSec = Math.round(intervalMs / 1000);
        const timeSinceExitSec = Math.round(timeSinceExit / 1000);
        console.log('[OS Trigger Brain] Re-entry within app switch interval — no intervention', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          timeSinceExitSec: `${timeSinceExitSec}s`,
          intervalMs,
          intervalSec: `${intervalSec}s`,
          lastExitTimestamp,
          currentTimestamp: timestamp,
        });
        
        // Existing intention timer (if any) remains valid
        if (intentionTimer) {
          const remainingSec = Math.round((intentionTimer.expiresAt - timestamp) / 1000);
          console.log('[OS Trigger Brain] Existing intention timer remains valid', {
            packageName,
            expiresAt: intentionTimer.expiresAt,
            remainingMs: intentionTimer.expiresAt - timestamp,
            remainingSec: `${remainingSec}s`,
          });
        }
      } else {
        const intervalSec = Math.round(intervalMs / 1000);
        const timeSinceExitSec = Math.round(timeSinceExit / 1000);
        console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          timeSinceExitSec: `${timeSinceExitSec}s`,
          intervalMs,
          intervalSec: `${intervalSec}s`,
          lastExitTimestamp,
          currentTimestamp: timestamp,
        });
        
        // New intervention will overwrite existing intention timer
        if (intentionTimer) {
          console.log('[OS Trigger Brain] Existing intention timer will be overwritten by new intervention', {
            packageName,
            oldExpiresAt: intentionTimer.expiresAt,
          });
        }
        
        // Trigger intervention (Step 5F)
        triggerIntervention(packageName, timestamp);
      }
    } else {
      // No previous exit recorded (first launch or never exited before)
      console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible', {
        packageName,
        reason: 'no_previous_exit',
        currentTimestamp: timestamp,
      });
      
      // Trigger intervention (Step 5F)
      triggerIntervention(packageName, timestamp);
    }
  } else {
    // Non-monitored app in foreground - but we still need to check ALL monitored app timers
    // because per spec: "t_monitored counts down independently of which app is in foreground"
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
 * @param durationMs - Duration in milliseconds (t_monitored)
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
 * Check if intention timer has expired for the current foreground app.
 * Should be called periodically (e.g., every 10 seconds) to detect in-app expiration.
 * 
 * @param currentTimestamp - Current timestamp
 */
export function checkForegroundIntentionExpiration(currentTimestamp: number): void {
  // Silent check - only log if something important happens
  
  if (lastMeaningfulApp === null) {
    return;
  }

  // Only check if the foreground app is monitored
  if (!isMonitoredApp(lastMeaningfulApp)) {
    // Check ALL monitored apps with timers instead
    for (const [packageName, timer] of intentionTimers.entries()) {
      if (isMonitoredApp(packageName) && currentTimestamp > timer.expiresAt) {
        console.log('[OS Trigger Brain] Monitored app timer expired (not in foreground) — intervention on next entry', {
          packageName,
          expiresAt: timer.expiresAt,
          currentTimestamp,
          expiredMs: currentTimestamp - timer.expiresAt,
        });
      }
    }
    return;
  }

  const timer = intentionTimers.get(lastMeaningfulApp);
  if (!timer) {
    return;
  }

  if (currentTimestamp > timer.expiresAt) {
    console.log('[OS Trigger Brain] Intention expired while app in foreground — intervention required', {
      packageName: lastMeaningfulApp,
      expiresAt: timer.expiresAt,
      currentTimestamp,
      expiredMs: currentTimestamp - timer.expiresAt,
    });
    // TODO Step 5F: Trigger intervention (BEGIN_INTERVENTION)
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
  console.log('[OS Trigger Brain] Tracking state reset');
}

