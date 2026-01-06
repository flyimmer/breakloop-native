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
 * Active Quick Task timers per app.
 * Maps packageName -> { expiresAt: timestamp, timeoutId: NodeJS.Timeout | null }
 * When a Quick Task timer is active, the app can be used without intervention.
 * 
 * The timeoutId is used to schedule expiration callbacks that trigger
 * intervention if the user is still on the app when the timer expires.
 */
const quickTaskTimers: Map<string, { expiresAt: number; timeoutId: NodeJS.Timeout | null }> = new Map();

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
  console.log('[OS Trigger Brain] Intervention dispatcher connected (DEPRECATED)');
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
  console.log('[OS Trigger Brain] System Session dispatcher connected');
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
  console.log('[OS Trigger Brain] Intervention state getter connected');
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
    // Record launcher event time for transition detection
    lastLauncherEventTime = timestamp;
    
    // Launcher detected - log but don't treat as meaningful app
    if (__DEV__) {
      console.log('[OS Trigger Brain] Launcher event:', {
        packageName,
        timestamp,
      });
    }
    
    // Debug log for BreakLoop infrastructure filtering
    if (packageName === 'com.anonymous.breakloopnative') {
      console.log('[OS Trigger Brain] BreakLoop infrastructure detected, lastMeaningfulApp unchanged:', lastMeaningfulApp);
    }
    
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
    console.log('[OS Trigger Brain] Launcher was transition (not destination):', {
      fromApp: lastMeaningfulApp,
      toApp: packageName,
      timeSinceLauncher,
      threshold: LAUNCHER_TRANSITION_THRESHOLD_MS,
    });
  }
  
  // Reset launcher time
  lastLauncherEventTime = 0;
  
  // ============================================================================
  // Step 4: Handle meaningful app entry
  // ============================================================================
  
  // Log the new meaningful app entering foreground (only on actual change)
  if (lastForegroundApp !== packageName) {
    console.log('[OS Trigger Brain] App entered foreground:', {
      packageName,
      timestamp,
      enterTime: new Date(timestamp).toISOString(),
    });
  }

  // ============================================================================
  // Step 5: Monitored app intervention logic
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
      // Clear timeout if it hasn't fired yet
      if (quickTaskTimer.timeoutId) {
        clearTimeout(quickTaskTimer.timeoutId);
      }
      
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
    // PRIORITY 0: Check if intention timer expired (but don't delete yet)
    // ============================================================================
    const intentionTimer = intentionTimers.get(packageName);
    const intentionJustExpired = intentionTimer && timestamp > intentionTimer.expiresAt;
    
    if (intentionJustExpired) {
      const expiredSec = Math.round((timestamp - intentionTimer.expiresAt) / 1000);
      console.log('[OS Trigger Brain] Intention timer expired (will be deleted)', {
        packageName,
        expiresAt: intentionTimer.expiresAt,
        expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
        expiredMs: timestamp - intentionTimer.expiresAt,
        expiredSec: `${expiredSec}s ago`,
      });
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
      if (__DEV__) {
        console.log('[OS Trigger Brain] Duplicate event filtered (same meaningful app):', {
          packageName,
          lastMeaningfulApp,
        });
      }
      lastForegroundApp = packageName;
      return;
    }
    
    if (lastMeaningfulApp === packageName && intentionJustExpired) {
      console.log('[OS Trigger Brain] Heartbeat event BUT intention timer just expired - will re-evaluate logic');
    }
    
    if (lastMeaningfulApp === packageName && force) {
      console.log('[OS Trigger Brain] Duplicate event BUT force === true (SystemSurface bootstrap) - will re-evaluate logic');
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
  
  // Clear existing timeout if any (cleanup from old implementation)
  if (existingTimer?.timeoutId) {
    clearTimeout(existingTimer.timeoutId);
  }
  
  const expiresAt = currentTimestamp + durationMs;
  const durationMin = Math.round(durationMs / (60 * 1000));
  
  // ❌ REMOVED: setTimeout is in ephemeral UI context
  // Native will emit MECHANICAL event when timer expires
  // System Brain will classify and decide semantic response
  
  // Store timer WITHOUT callback - System Brain will handle expiration
  quickTaskTimers.set(packageName, { expiresAt, timeoutId: null });
  
  // Usage recording removed - System Brain records usage via TIMER_SET event
  
  // Store timer in native layer - native will emit mechanical event on expiration
  // Native emits: { type: "TIMER_EXPIRED", packageName, timestamp }
  // System Brain classifies: Quick Task vs Intention vs Unknown
  try {
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
      NativeModules.AppMonitorModule.storeQuickTaskTimer(packageName, expiresAt);
      console.log('[OS Trigger Brain] Quick Task timer stored in native (mechanical expiration will be emitted)');
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
    note: 'Native will emit mechanical event, System Brain will classify',
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

  // Check if timer is still valid
  const isValid = timestamp < timer.expiresAt;
  
  if (!isValid && timer.timeoutId) {
    // Timer expired but timeout hasn't fired yet - clear it
    clearTimeout(timer.timeoutId);
    quickTaskTimers.delete(packageName);
  }
  
  return isValid;
}

/**
 * Clean up expired Quick Task timers (SILENT operation).
 * 
 * IMPORTANT: Expiration is SILENT - no UI shown, no session created.
 * Expired timers are simply removed from memory.
 * Normal intervention rules resume on next app trigger.
 * 
 * This function should be called during normal trigger evaluation
 * (e.g., when checking if an app should trigger intervention).
 * 
 * @param currentTimestamp - Current timestamp
 */
export function cleanupExpiredQuickTaskTimers(currentTimestamp: number): void {
  for (const [packageName, timer] of quickTaskTimers.entries()) {
    if (currentTimestamp >= timer.expiresAt) {
      console.log('[OS Trigger Brain] Quick Task timer expired (cleanup during trigger evaluation):', {
        packageName,
        expiresAt: timer.expiresAt,
        note: 'Expired while in background - cleanup only',
      });
      
      // Clear timeout if it hasn't fired yet
      if (timer.timeoutId) {
        clearTimeout(timer.timeoutId);
      }
      
      // Remove the expired timer from JS memory
      quickTaskTimers.delete(packageName);
      
      // Also clear from native layer
      try {
        const { NativeModules, Platform } = require('react-native');
        if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
          NativeModules.AppMonitorModule.clearQuickTaskTimer(packageName);
        }
      } catch (e) {
        console.warn('[OS Trigger Brain] Failed to clear Quick Task timer from native layer:', e);
      }
    }
  }
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
        
        // Phase 2: evaluateTriggerLogic() removed
        // System Brain handles all trigger logic evaluation.
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
 * Clear intention timer for a specific app.
 * Used when Quick Task expires to reset t_intention per spec.
 * 
 * @param packageName - App package name
 */
export function clearIntentionTimer(packageName: string): void {
  intentionTimers.delete(packageName);
  console.log('[OS Trigger Brain] Intention timer cleared for app:', packageName);
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
  quickTaskTimers.clear();
  // NOTE: Do NOT clear quickTaskUsageHistory!
  // Usage quota is time-based (15-minute rolling window) and should persist
  // until timestamps naturally expire. Clearing it would incorrectly reset
  // the usage count and allow users to bypass the quota limit.
  console.log('[OS Trigger Brain] Tracking state reset (timers cleared, usage history preserved)');
}

