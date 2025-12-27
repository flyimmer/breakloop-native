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
 * KNOWN LIMITATION:
 * Android UsageStats may report the last used app when returning to home launcher,
 * causing spurious re-entry events. App exits are inferred reliably when another
 * app enters foreground, so interval logic remains functionally correct.
 */

import { getAppSwitchIntervalMs, isMonitoredApp } from './osConfig';

// ============================================================================
// Internal State
// ============================================================================

let lastForegroundApp: string | null = null;
const lastExitTimestamps: Map<string, number> = new Map();

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
 * Handles foreground app change events from the OS.
 * Records exit timestamps and updates tracking state.
 * 
 * @param app - App info containing packageName and timestamp
 */
export function handleForegroundAppChange(app: { packageName: string; timestamp: number }): void {
  const { packageName, timestamp } = app;

  // If there was a previous app, it has now exited
  // NOTE: Android UsageStats may report the last used app when returning to launcher.
  // App exits are inferred reliably when another app enters foreground.
  if (lastForegroundApp !== null && lastForegroundApp !== packageName) {
    lastExitTimestamps.set(lastForegroundApp, timestamp);
    console.log('[OS Trigger Brain] App exited foreground:', {
      packageName: lastForegroundApp,
      exitTimestamp: timestamp,
      exitTime: new Date(timestamp).toISOString(),
    });
  }

  // Log the new app entering foreground (only on actual change)
  if (lastForegroundApp !== packageName) {
    console.log('[OS Trigger Brain] App entered foreground:', {
      packageName,
      timestamp,
      enterTime: new Date(timestamp).toISOString(),
    });
  }

  // Check if this is a monitored app
  if (isMonitoredApp(packageName)) {
    // Log entry only when app actually changes
    if (lastForegroundApp !== packageName) {
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
      // TODO Step 5F: Trigger intervention (BEGIN_INTERVENTION)
      // Note: Will overwrite existing intention timer when intervention starts
      return;
    }

    // Only run app switch interval logic on actual entry (not heartbeat)
    if (lastForegroundApp === packageName) {
      // This is a heartbeat event for the same app - skip interval logic
      return;
    }

    // Check app switch interval logic (t_appSwitchInterval)
    const lastExitTimestamp = lastExitTimestamps.get(packageName);
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
        
        // TODO Step 5F: Trigger intervention (BEGIN_INTERVENTION)
        // Note: Intention timer will be set when user completes intervention flow
      }
    } else {
      // No previous exit recorded (first launch or never exited before)
      console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible', {
        packageName,
        reason: 'no_previous_exit',
        currentTimestamp: timestamp,
      });
      
      // TODO Step 5F: Trigger intervention (BEGIN_INTERVENTION)
      // Note: Intention timer will be set when user completes intervention flow
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

  // Update current foreground app
  lastForegroundApp = packageName;
}

/**
 * Get the last exit timestamp for a specific app (for debugging/testing).
 */
export function getLastExitTimestamp(packageName: string): number | undefined {
  return lastExitTimestamps.get(packageName);
}

/**
 * Get the current foreground app (for debugging/testing).
 */
export function getCurrentForegroundApp(): string | null {
  return lastForegroundApp;
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
  
  if (lastForegroundApp === null) {
    return;
  }

  // Only check if the foreground app is monitored
  if (!isMonitoredApp(lastForegroundApp)) {
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

  const timer = intentionTimers.get(lastForegroundApp);
  if (!timer) {
    return;
  }

  if (currentTimestamp > timer.expiresAt) {
    console.log('[OS Trigger Brain] Intention expired while app in foreground — intervention required', {
      packageName: lastForegroundApp,
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
    // Only check apps that are NOT in foreground (foreground expiration is checked separately)
    if (packageName !== lastForegroundApp && currentTimestamp > timer.expiresAt) {
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
  lastExitTimestamps.clear();
  intentionTimers.clear();
  console.log('[OS Trigger Brain] Tracking state reset');
}

