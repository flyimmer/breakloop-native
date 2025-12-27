/**
 * OS Trigger Brain (Contract v1.1)
 * 
 * Tracks foreground app changes and records exit timestamps.
 * Implements app switch interval logic to prevent intervention spam.
 * 
 * KNOWN LIMITATION:
 * Android UsageStats may report the last used app when returning to home launcher,
 * causing spurious re-entry events. App exits are inferred reliably when another
 * app enters foreground, so interval logic remains functionally correct.
 */

import { getAppSwitchIntervalMs, isMonitoredApp } from './osConfig';

// Internal state
let lastForegroundApp: string | null = null;
const lastExitTimestamps: Map<string, number> = new Map();

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

  // Log the new app entering foreground
  console.log('[OS Trigger Brain] App entered foreground:', {
    packageName,
    timestamp,
    enterTime: new Date(timestamp).toISOString(),
  });

  // Check if this is a monitored app
  if (isMonitoredApp(packageName)) {
    console.log('[OS Trigger Brain] Monitored app entered foreground:', {
      packageName,
      timestamp,
    });

    // Check app switch interval logic
    const lastExitTimestamp = lastExitTimestamps.get(packageName);
    const intervalMs = getAppSwitchIntervalMs();

    if (lastExitTimestamp !== undefined) {
      // App was previously exited - check if enough time has passed
      const timeSinceExit = timestamp - lastExitTimestamp;

      if (timeSinceExit < intervalMs) {
        console.log('[OS Trigger Brain] Re-entry within app switch interval — no intervention', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          intervalMs,
          lastExitTimestamp,
          currentTimestamp: timestamp,
        });
      } else {
        console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible', {
          packageName,
          timeSinceExitMs: timeSinceExit,
          intervalMs,
          lastExitTimestamp,
          currentTimestamp: timestamp,
        });
        // TODO Step 5B: Add intervention trigger logic here
      }
    } else {
      // No previous exit recorded (first launch or never exited before)
      console.log('[OS Trigger Brain] App switch interval elapsed — intervention eligible', {
        packageName,
        reason: 'no_previous_exit',
        currentTimestamp: timestamp,
      });
      // TODO Step 5B: Add intervention trigger logic here
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
 * Reset all tracking state (for testing/debugging).
 */
export function resetTrackingState(): void {
  lastForegroundApp = null;
  lastExitTimestamps.clear();
  console.log('[OS Trigger Brain] Tracking state reset');
}

