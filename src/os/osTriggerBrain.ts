/**
 * OS Trigger Brain (Contract V1 - Updated)
 * 
 * Tracks foreground app changes and implements intervention trigger logic.
 * Implements intention timer and Quick Task semantics per OS Trigger Contract V1.
 * 
 * Key Contract Rules:
 * - t_intention (intention timer) suppresses intervention when valid
 * - t_quickTask (Quick Task timer) suppresses intervention when active
 * - n_quickTask (global usage count) determines Quick Task availability
 * - Intention timers are deleted when intervention starts/restarts
 * - Expired intention triggers intervention (immediately if foreground, or on next entry)
 * 
 * SEMANTIC LAUNCHER FILTERING:
 * The native layer reports ALL foreground changes (including launchers).
 * This layer filters launchers semantically because:
 * - Launchers don't represent user intent to "use an app"
 * - On OEM devices, launchers briefly regain focus during transitions
 * - Easier to maintain launcher list in JS than in multiple native platforms
 */

import {
  isMonitoredApp
} from './osConfig';

// ============================================================================
// Launcher Filtering
// ============================================================================

/**
 * Launcher packages and BreakLoop itself.
 * These apps are NOT treated as "meaningful apps" for intervention logic.
 * 
 * WHY FILTER LAUNCHERS?
 * - On OEM devices (Huawei/Honor, Xiaomi, Samsung), launchers briefly regain
 *   focus during app transitions, creating false foreground events.
 * - Launchers don't represent user intent to engage with content.
 * - We only want to trigger interventions for actual app usage.
 * 
 * WHY FILTER BREAKLOOP ITSELF?
 * - BreakLoop is the intervention UI (breathing screen, root cause, etc.)
 * - When intervention starts, BreakLoop comes to foreground to show UI
 * - This should NOT be treated as "user switched away from monitored app"
 * - Without filtering, intervention would cancel itself when UI appears!
 * 
 * Example without filtering:
 *   Instagram → Launcher (100ms) → YouTube
 *   = Two foreground events, potential duplicate interventions
 * 
 * With filtering:
 *   Instagram → [Launcher ignored] → YouTube
 *   = Clean transition from Instagram to YouTube
 * 
 * Example without BreakLoop filtering:
 *   Instagram → BreakLoop (intervention UI) → Cancels Instagram intervention (WRONG!)
 * 
 * With BreakLoop filtering:
 *   Instagram → [BreakLoop ignored] → Intervention continues (CORRECT!)
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
  'com.anonymous.breakloopnative',  // BreakLoop itself (intervention UI)
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
 * Used for intervention decisions and heartbeat detection.
 * This represents the last app the user actually engaged with.
 */
let lastMeaningfulApp: string | null = null;

/**
 * Track launcher event timestamp for transition detection.
 * Used to distinguish between:
 * - Transient launcher (app switching): App A -> Launcher (50ms) -> App B
 * - Real launcher (home screen): App A -> Launcher (stays there)
 */
let lastLauncherEventTime: number = 0;
const LAUNCHER_TRANSITION_THRESHOLD_MS = 300;

/**
 * Exit timestamps for ALL apps (including launchers).
 * Maps packageName -> last exit timestamp.
 * Used for debugging and tracking purposes.
 */
const lastExitTimestamps: Map<string, number> = new Map();

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
 * Quick Task usage tracking removed from SystemSurface context.
 * Usage is now tracked ONLY in System Brain's persisted state.
 * SystemSurface no longer makes availability decisions.
 */

/**
 * Quick Task timer storage REMOVED.
 * 
 * Timers are now stored ONLY in:
 * 1. Native layer (for mechanical expiration events)
 * 2. System Brain persisted state (for semantic decisions)
 * 
 * This ephemeral Map was causing "unknown timer" errors because
 * it was lost when UI context was destroyed.
 */

/**
 * Dispatch function for triggering interventions in React layer.
 * Set by setInterventionDispatcher() from App.tsx.
 * 
 * DEPRECATED: This will be replaced by SystemSession dispatcher.
 * For now, we keep it for backward compatibility during migration.
 */
let interventionDispatcher: ((action: any) => void) | null = null;

/**
 * System Session dispatcher - event-driven API (Rule 2)
 * Set by setSystemSessionDispatcher() from App.tsx.
 * This is the NEW way to trigger system flows.
 */
let systemSessionDispatcher: ((event: any) => void) | null = null;

/**
 * Current intervention state getter (set by React layer).
 * Allows OS Trigger Brain to check current intervention state.
 */
let interventionStateGetter: (() => { state: string; targetApp: string | null }) | null = null;

/**
 * Quick Task availability computation removed from SystemSurface context.
 * System Brain is the single source of truth for availability decisions.
 * 
 * REMOVED FUNCTIONS:
 * - getQuickTaskRemaining() - Availability computed only in System Brain
 * - recordQuickTaskUsage() - Usage recorded only in System Brain via TIMER_SET events
 * 
 * SystemSurface no longer makes semantic decisions about Quick Task availability.
 */

/**
 * startInterventionFlow() removed - System Brain handles intervention launching in Phase 2.
 * System Brain pre-decides UI flow and launches SystemSurface with explicit wake reason.
 */

/**
 * Show Quick Task dialog for a monitored app.
 * 
 * REFACTORED: Now uses SystemSession dispatcher (Rule 2)
 * 
 * @param packageName - App package name
 * @param remaining - Number of Quick Task uses remaining
 */
/**
 * showQuickTaskDialog() removed - System Brain makes this decision.
 * SystemSurface no longer dispatches START_QUICK_TASK based on availability checks.
 * System Brain's wake reason determines the session type.
 */

/**
 * evaluateTriggerLogic() removed - System Brain handles all decision logic in Phase 2.
 * SystemSurface no longer evaluates trigger logic or checks suppression.
 * System Brain pre-decides and passes explicit wake reason.
 */

/**
 * Set the intervention dispatcher function.
 * This connects the OS Trigger Brain to the React intervention state machine.
 * 
 * DEPRECATED: Use setSystemSessionDispatcher() instead (Rule 2)
 * Kept for backward compatibility during migration.
 * 
 * @param dispatcher - Function to dispatch intervention actions
 */
export function setInterventionDispatcher(dispatcher: (action: any) => void): void {
  interventionDispatcher = dispatcher;
}

/**
 * Set the system session dispatcher function (Rule 2)
 * This connects the OS Trigger Brain to the SystemSessionProvider.
 * 
 * MUST be called from App.tsx on mount to wire up the session system.
 * 
 * @param dispatcher - Function to dispatch SystemSession events
 */
export function setSystemSessionDispatcher(dispatcher: (event: any) => void): void {
  systemSessionDispatcher = dispatcher;
}

/**
 * Set the intervention state getter function.
 * Allows OS Trigger Brain to check current intervention state.
 * 
 * MUST be called from App.tsx to enable incomplete intervention detection.
 * 
 * @param getter - Function that returns current intervention state
 */
export function setInterventionStateGetter(getter: () => { state: string; targetApp: string | null }): void {
  interventionStateGetter = getter;
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

  interventionDispatcher({
    type: 'SHOW_EXPIRED',
    app: packageName,
  });
}



/**
 * Handles foreground app change events from the OS.
 * Records exit timestamps and updates tracking state.
 * Implements semantic launcher filtering at the business logic layer.
 * 
 * @param app - App info containing packageName and timestamp
 * @param options - Optional configuration
 * @param options.force - If true, bypasses duplicate event filtering (used during SystemSurface bootstrap)
 */
export function handleForegroundAppChange(
  app: { packageName: string; timestamp: number },
  options?: { force?: boolean }
): void {
  const { packageName, timestamp } = app;
  const force = options?.force ?? false;

  // ============================================================================
  // Step 1: Record raw exit (for all apps, including launchers)
  // ============================================================================

  if (lastForegroundApp !== null && lastForegroundApp !== packageName) {
    lastExitTimestamps.set(lastForegroundApp, timestamp);
  }

  // ============================================================================
  // Step 2: Semantic launcher filtering
  // ============================================================================

  const isLauncherEvent = isLauncher(packageName);

  if (isLauncherEvent) {
    // Record launcher event time for transition detection
    lastLauncherEventTime = timestamp;

    // Launcher detected - don't treat as meaningful app

    // Update raw tracking (for exit inference) but NOT meaningful app tracking
    lastForegroundApp = packageName;

    // Do NOT update lastMeaningfulApp
    // Do NOT update lastMeaningfulExitTimestamps
    // Do NOT run intervention logic
    return;
  }

  // ============================================================================
  // Step 3: Launcher transition detection
  // ============================================================================

  // Check if launcher was a transition (not a real home screen visit)
  const timeSinceLauncher = timestamp - lastLauncherEventTime;
  const isLauncherTransition = lastLauncherEventTime > 0 && timeSinceLauncher < LAUNCHER_TRANSITION_THRESHOLD_MS;

  if (isLauncherTransition) {
    // Launcher was a transition, not a destination
  }

  // Reset launcher time
  lastLauncherEventTime = 0;

  // ============================================================================
  // Step 4: Handle meaningful app entry
  // ============================================================================

  // Track the new meaningful app entering foreground

  // ============================================================================
  // Step 5: Monitored app intervention logic
  // ============================================================================

  // Check if this is a monitored app
  const isMonitored = isMonitoredApp(packageName);

  if (!isMonitored) {
    // Not a monitored app - skip intervention logic
    // Update tracking but don't trigger intervention
    lastForegroundApp = packageName;
    if (packageName !== 'com.anonymous.breakloopnative') {
      lastMeaningfulApp = packageName;
    }
    return;
  }

  if (isMonitored) {

    // ============================================================================
    // PRIORITY 0: Quick Task timer cleanup REMOVED
    // ============================================================================
    // Ephemeral storage removed - System Brain handles timer expiration via TIMER_EXPIRED events

    // ============================================================================
    // PRIORITY 0: Check if intention timer expired (but don't delete yet)
    // ============================================================================
    const intentionTimer = intentionTimers.get(packageName);
    const intentionJustExpired = intentionTimer && timestamp > intentionTimer.expiresAt;

    if (intentionJustExpired) {
      // Delete the expired timer
      intentionTimers.delete(packageName);
    }

    // ============================================================================
    // Skip logic for heartbeat events (same app, no actual switch)
    // EXCEPTION 1: If intention timer just expired, we MUST re-evaluate logic
    // EXCEPTION 2: If force === true (SystemSurface bootstrap), we MUST re-evaluate
    // ============================================================================
    if (lastMeaningfulApp === packageName && !intentionJustExpired && !force) {
      // This is a heartbeat event for the same app - skip all logic
      // UNLESS intention timer just expired OR force flag is set
      lastForegroundApp = packageName;
      return;
    }

    // ============================================================================
    // Phase 2: evaluateTriggerLogic() removed
    // ============================================================================
    // System Brain handles all trigger logic evaluation.
    // This file (osTriggerBrain.ts) is no longer used in SystemSurface context.
    // SystemSurface only consumes wake reasons from System Brain.

    // Update tracking
    lastForegroundApp = packageName;
    lastMeaningfulApp = packageName;
  } else {
    // Non-monitored app in foreground - but we still need to check ALL monitored app timers
    // because per spec: "t_intention counts down independently of which app is in foreground"
    for (const [monitoredPkg, timer] of intentionTimers.entries()) {
      if (timestamp > timer.expiresAt) {
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
  intentionTimers.set(packageName, { expiresAt });
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
  // DEPRECATED: Ephemeral storage removed
  // Timer is now managed exclusively by Native via QT_ACCEPT intent
  // This function is no longer needed
  // console.warn('[OS Trigger Brain] setQuickTaskTimer is deprecated - Native manages timers');
}

/**
 * Get Quick Task timer for an app (for debugging/testing).
 * 
 * ⚠️ DEPRECATED: Ephemeral storage removed.
 * Timer state now lives ONLY in System Brain persisted state.
 * This function returns undefined (timer info not available in UI context).
 */
export function getQuickTaskTimer(packageName: string): { expiresAt: number } | undefined {
  console.warn('[OS Trigger Brain] getQuickTaskTimer() is deprecated - timer state in System Brain only');
  return undefined;
}

/**
 * Check if a specific app has an active Quick Task timer (per-app check).
 * 
 * ⚠️ DEPRECATED: Ephemeral storage removed.
 * Timer state now lives ONLY in System Brain persisted state.
 * This function always returns false (timer info not available in UI context).
 * 
 * System Brain's decision engine now handles all timer checks.
 */
function hasActiveQuickTaskTimer(packageName: string, timestamp: number): boolean {
  // Ephemeral storage removed - System Brain owns timer state
  return false;
}

/**
 * Clean up expired Quick Task timers (SILENT operation).
 * 
 * ⚠️ DEPRECATED: Ephemeral storage removed.
 * Timer cleanup now handled by System Brain when processing TIMER_EXPIRED events.
 * This function is a no-op.
 */
export function cleanupExpiredQuickTaskTimers(currentTimestamp: number): void {
  // No-op: System Brain handles timer cleanup via TIMER_EXPIRED events
}

/**
 * @deprecated Use cleanupExpiredQuickTaskTimers() instead.
 * Quick Task expiration is now silent - no UI shown.
 */
export function checkQuickTaskExpiration(currentTimestamp: number): string | null {
  console.warn('[OS Trigger Brain] checkQuickTaskExpiration() is deprecated - use cleanupExpiredQuickTaskTimers()');
  cleanupExpiredQuickTaskTimers(currentTimestamp);
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

  for (const [packageName, timer] of intentionTimers.entries()) {
    if (!isMonitoredApp(packageName)) {
      continue;
    }

    if (currentTimestamp > timer.expiresAt) {
      // CRITICAL FIX: Only trigger intervention if this is the CURRENT foreground app
      // For background apps, just delete the timer - intervention will trigger on next entry
      const isForeground = packageName === lastMeaningfulApp;

      if (isForeground) {
        // Clear the expired timer
        intentionTimers.delete(packageName);

        // Phase 2: evaluateTriggerLogic() removed
        // System Brain handles all trigger logic evaluation.
      } else {
        // DELETE the expired timer for background app
        // When user returns to this app, handleForegroundAppChange() will see:
        // 1. No intention timer exists (expired)
        // 2. Will trigger new intervention at that time
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
      // Note: Intervention will trigger when app enters foreground
      // Timer is NOT cleared - it will be detected on next entry
    }
  }
}

/**
 * Clear intention timer for a specific app.
 * Used when Quick Task expires to reset t_intention per spec.
 * 
 * @param packageName - App package name
 */
export function clearIntentionTimer(packageName: string): void {
  intentionTimers.delete(packageName);
}

/**
 * Reset all tracking state (for testing/debugging).
 * NOTE: This is primarily for development/testing purposes.
 */
export function resetTrackingState(): void {
  lastForegroundApp = null;
  lastMeaningfulApp = null;
  lastExitTimestamps.clear();
  intentionTimers.clear();
  // quickTaskTimers.clear(); // REMOVED: Ephemeral storage no longer exists
  // NOTE: Do NOT clear quickTaskUsageHistory!
  // Usage quota is time-based (15-minute rolling window) and should persist
  // until timestamps naturally expire. Clearing it would incorrectly reset
  // the usage count and allow users to bypass the quota limit.
}

