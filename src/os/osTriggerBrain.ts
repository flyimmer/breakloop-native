/**
 * OS Trigger Brain (Contract v1.1)
 * 
 * Tracks foreground app changes and records exit timestamps.
 * Step 5A: Tracking only - no intervention logic yet.
 */

import { isMonitoredApp } from './osConfig';

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
    // TODO Step 5B: Add intervention trigger logic here
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

