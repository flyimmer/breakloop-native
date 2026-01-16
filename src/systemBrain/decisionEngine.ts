/**
 * System Brain Decision Engine
 * 
 * Architectural Invariant:
 * This is the ONLY place where SystemSurface launch decisions are made.
 * No other module may call launchSystemSurface() directly.
 * 
 * Timer Persistence Invariant:
 * System Brain must be able to reconstruct all active timers
 * solely from persisted state at any event boundary.
 * 
 * Lifecycle Invariant:
 * If a flag describes "what is happening now", it must never be persisted.
 * 
 * Purpose:
 * - Unify Quick Task expiration logic and OS Trigger Brain logic
 * - Ensure exactly ONE decision per event
 * - Eliminate race conditions between multiple launch points
 * - Enforce single SystemSurface instance (lifecycle guard)
 * 
 * Decision Priority Chain:
 * 1. Expired Quick Task (foreground) → Force intervention
 * 2. Expired Quick Task (background) → Clear flag, continue to OS Trigger Brain
 * 3. OS Trigger Brain evaluation → Quick Task dialog OR Intervention OR Suppress
 * 4. Default → Do nothing
 */

import { TimerState, setSystemSurfaceActive } from './stateManager';
import { WakeReason } from './nativeBridge';

/**
 * Lifecycle guard: Is SystemSurface currently active?
 * 
 * CRITICAL: This is IN-MEMORY ONLY and must NEVER be persisted.
 * It resets automatically on app reload/crash.
 * 
 * If a flag describes "what is happening now", it must never be persisted.
 */
let isSystemSurfaceActive = false;

/**
 * Clear SystemSurface active flag (in-memory only).
 * 
 * Called by SystemSessionProvider when finish is confirmed.
 * This does NOT persist anything - it only clears the in-memory guard.
 */
export function clearSystemSurfaceActive(): void {
  isSystemSurfaceActive = false;
  console.log('[SystemSurfaceInvariant] Active flag cleared (in-memory)');
}

/**
 * DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
 * 
 * Quick Task suppression: Is Quick Task blocked for current app entry?
 * 
 * PHASE 4.1 MIGRATION:
 * - Native now decides Quick Task entry (SHOW_QUICK_TASK_DIALOG or NO_QUICK_TASK_AVAILABLE)
 * - JS no longer runs OS Trigger Brain for Quick Task entry
 * - This suppression logic is no longer needed
 * 
 * Keeping for POST_QUICK_TASK_CHOICE flow only (will be migrated in Phase 4.2)
 */
let suppressQuickTaskForApp: string | null = null;

/**
 * DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
 * 
 * Clear Quick Task suppression flag (in-memory only).
 * 
 * This function is kept for POST_QUICK_TASK_CHOICE flow compatibility.
 * Will be removed in Phase 4.2 when full Quick Task state machine moves to Native.
 */
export function clearQuickTaskSuppression(): void {
  suppressQuickTaskForApp = null;
  console.log('[Decision Engine] Quick Task suppression cleared (DEPRECATED - Phase 4.1)');
}

/**
 * Decision result type.
 * Either no action needed, or launch SystemSurface with specific wake reason.
 */
export type Decision =
  | { type: 'NONE' }
  | { type: 'LAUNCH'; app: string; wakeReason: WakeReason };

/**
 * OS Trigger Brain evaluation result.
 */
type OSTriggerResult = 'QUICK_TASK' | 'INTERVENTION' | 'SUPPRESS';

/**
 * Load Quick Task configuration from user settings.
 * 
 * Returns the configured number of Quick Task uses per 15-minute window.
 * This is the user's n_quickTask setting from Settings screen.
 */
async function loadQuickTaskConfig(): Promise<{ maxUses: number; windowMs: number }> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const configJson = await AsyncStorage.getItem('quick_task_settings_v1');
    if (configJson) {
      const config = JSON.parse(configJson);
      const maxUses = config.usesPerWindow ?? 1; // Default to 1 if not set
      
      console.log('[Decision Engine] Quick Task config loaded:', {
        maxUses,
        source: 'quick_task_settings_v1',
      });
      
      return {
        maxUses,
        windowMs: 15 * 60 * 1000, // 15 minutes
      };
    }
  } catch (e) {
    console.warn('[Decision Engine] Failed to load Quick Task config:', e);
  }
  
  // Fallback defaults
  console.log('[Decision Engine] Using default Quick Task config');
  return {
    maxUses: 1,
    windowMs: 15 * 60 * 1000,
  };
}

/**
 * Calculate remaining Quick Task uses GLOBALLY.
 * 
 * Filters usage history to 15-minute window and calculates remaining quota.
 * Reads maxUses from user's configured settings (n_quickTask).
 * 
 * @param currentTimestamp - Current timestamp
 * @param state - Semantic state (read-only, does NOT mutate)
 * @returns Number of Quick Task uses remaining
 */
async function getQuickTaskRemaining(currentTimestamp: number, state: TimerState): Promise<number> {
  // Load user's configured max uses (n_quickTask from Settings)
  const config = await loadQuickTaskConfig();
  const { maxUses, windowMs } = config;
  
  // Filter out timestamps older than 15 minutes from history
  const recentUsages = state.quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Calculate remaining uses based on user's configured limit
  const remaining = Math.max(0, maxUses - recentUsages.length);
  
  console.log('[Decision Engine] Quick Task availability check (GLOBAL):', {
    maxUses: `${maxUses} (from user settings)`,
    recentUsagesGlobal: recentUsages.length,
    remaining,
    windowMinutes: windowMs / (60 * 1000),
  });
  
  return remaining;
}

/**
 * Sync Quick Task quota to Native layer
 * 
 * PHASE 4.1: Entry decision authority
 * 
 * Called whenever quota might have changed:
 * - On app startup (System Brain initialization)
 * - After Quick Task usage (quota decremented)
 * - When settings change (if user adjusts maxUses)
 * 
 * IMPORTANT: Native cache is runtime-only, NOT a second source of truth
 * JS remains the authoritative source for quota values
 * 
 * @param state - Semantic state (for reading usage history)
 */
export async function syncQuotaToNative(state: TimerState): Promise<void> {
  try {
    const config = await loadQuickTaskConfig();
    const { maxUses, windowMs } = config;
    const currentTimestamp = Date.now();
    
    // Calculate current quota
    const recentUsages = state.quickTaskUsageHistory.filter(
      ts => currentTimestamp - ts < windowMs
    );
    const remaining = Math.max(0, maxUses - recentUsages.length);
    
    // Push to Native
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
      await NativeModules.AppMonitorModule.updateQuickTaskQuota(remaining);
      console.log('[Decision Engine] ✅ Synced quota to Native:', {
        remaining,
        maxUses,
        recentUsages: recentUsages.length,
        note: 'Native cache updated for entry decisions',
      });
    }
  } catch (e) {
    console.warn('[Decision Engine] ⚠️ Failed to sync quota to Native:', e);
  }
}

/**
 * Evaluate OS Trigger Brain priority chain.
 * 
 * This function implements the LOCKED priority order:
 * 1. t_intention VALID (per-app) → SUPPRESS
 * 2. t_quickTask ACTIVE (per-app) → SUPPRESS
 * 3. n_quickTask > 0 (global) → QUICK_TASK
 * 4. Else → INTERVENTION
 * 
 * @param app - App package name
 * @param timestamp - Current timestamp
 * @param state - Semantic state
 * @returns OS Trigger Brain decision
 */
async function evaluateOSTriggerBrain(
  app: string,
  timestamp: number,
  state: TimerState
): Promise<OSTriggerResult> {
  // Priority #1: Check t_intention (per-app suppressor)
  const intentionTimer = state.intentionTimers[app];
  if (intentionTimer && timestamp < intentionTimer.expiresAt) {
    return 'SUPPRESS';
  }
  
  // Priority #2: Check t_quickTask (per-app timer)
  const quickTaskTimer = state.quickTaskTimers[app];
  if (quickTaskTimer && timestamp < quickTaskTimer.expiresAt) {
    // Also verify phase is ACTIVE (not stale dialog)
    const phase = state.quickTaskPhaseByApp[app];
    if (phase === 'ACTIVE') {
      console.log('[Decision Engine] ✓ t_quickTask ACTIVE - suppressing intervention', {
        app,
        phase,
        expiresAt: quickTaskTimer.expiresAt,
        expiresAtTime: new Date(quickTaskTimer.expiresAt).toISOString(),
      });
      return 'SUPPRESS';
    } else {
      // Stale timer - clean it up
      console.warn('[Decision Engine] Stale Quick Task timer detected:', {
        app,
        phase,
        note: 'Timer exists but phase is not ACTIVE - cleaning up',
      });
      delete state.quickTaskTimers[app];
      // Fall through to check quota (Priority #3)
    }
  }
  
  // Priority #3: Check n_quickTask (global usage count)
  // DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
  // Native emits SHOW_QUICK_TASK_DIALOG or NO_QUICK_TASK_AVAILABLE
  // This code path is NO LONGER USED for Quick Task entry decisions
  const quickTaskRemaining = await getQuickTaskRemaining(timestamp, state);
  if (quickTaskRemaining > 0) {
    console.log('[Decision Engine] ✓ n_quickTask > 0 - decision: QUICK_TASK (DEPRECATED - should not reach here in Phase 4.1)', {
      remaining: quickTaskRemaining,
    });
    return 'QUICK_TASK';
  }
  
  // Priority #4: Default to intervention
  console.log('[Decision Engine] ✗ n_quickTask = 0 - decision: INTERVENTION');
  return 'INTERVENTION';
}

/**
 * Decide whether to launch SystemSurface and with which wake reason.
 * 
 * This is the SINGLE AUTHORITY for all SystemSurface launch decisions.
 * 
 * Decision Priority Chain:
 * 1. Expired Quick Task (foreground) → Force intervention
 * 2. Expired Quick Task (background) → Clear flag, continue to OS Trigger Brain
 * 3. OS Trigger Brain evaluation → Quick Task dialog OR Intervention OR Suppress
 * 4. Default → Do nothing
 * 
 * IMPORTANT: This function may mutate state (clear expired flags).
 * 
 * @param event - Mechanical event from native
 * @param state - Semantic state (may be mutated to clear flags)
 * @returns Decision (NONE or LAUNCH with wake reason)
 */
export async function decideSystemSurfaceAction(
  event: { type: string; packageName: string; timestamp: number },
  state: TimerState
): Promise<Decision> {
  const { packageName: app, timestamp } = event;
  
  // ============================================================================
  // PHASE 4.1 GUARD: Reject foreground events (entry decisions made by Native)
  // ============================================================================
  if (event.type === 'FOREGROUND_CHANGED' || event.type === 'USER_INTERACTION_FOREGROUND') {
    console.error('[Decision Engine] ❌ CRITICAL: Should not be called for foreground events in Phase 4.1');
    console.error('[Decision Engine] Event type:', event.type);
    console.error('[Decision Engine] Native makes entry decisions via QUICK_TASK_DECISION events');
    console.error('[Decision Engine] This indicates a bug in Phase 4.1 migration');
    return { type: 'NONE' };
  }
  
  console.log('[Decision Engine] ========================================');
  console.log('[Decision Engine] Making decision for event:', {
    type: event.type,
    app,
    timestamp,
    time: new Date(timestamp).toISOString(),
  });
  
  // DEBUG: Log lifecycle guard state at entry
  console.log('[Decision Engine] Entry state:', {
    app,
    eventType: event.type,
    isSystemSurfaceActive,
    timestamp: event.timestamp,
  });
  
  // ============================================================================
  // Auto-Recovery: Clear stuck lifecycle flag
  // ============================================================================
  // CRITICAL: The flag should only be true DURING an active launch (milliseconds).
  // If we're at the start of a NEW decision and the flag is still true, it's stuck.
  // This handles cases where:
  // - Previous session didn't finish cleanly
  // - Module loaded after flag was already set
  // - Fast refresh kept the flag in memory
  if (isSystemSurfaceActive) {
    console.warn('[SystemSurfaceInvariant] ⚠️ Flag was stuck, auto-clearing', {
      app,
      eventType: event.type,
      timestamp: event.timestamp,
    });
    isSystemSurfaceActive = false;
    console.log('[SystemSurfaceInvariant] ✅ Stuck flag cleared, proceeding with decision');
  }
  
  // DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
  // Clear Quick Task suppression if user left the suppressed app
  if (suppressQuickTaskForApp && suppressQuickTaskForApp !== app) {
    console.log('[Decision Engine] User left suppressed app - clearing suppression (DEPRECATED - Phase 4.1)', {
      suppressedApp: suppressQuickTaskForApp,
      currentApp: app,
    });
    clearQuickTaskSuppression();
  }
  
  // ✅ Step 4: Validate state structure
  if (!state.quickTaskTimers) {
    console.error('[Decision Engine] ❌ quickTaskTimers missing from state - this should never happen!');
    console.error('[Decision Engine] State structure:', Object.keys(state));
  }
  if (!state.intentionTimers) {
    console.error('[Decision Engine] ❌ intentionTimers missing from state - this should never happen!');
    console.error('[Decision Engine] State structure:', Object.keys(state));
  }
  
  // ============================================================================
  // Priority #0: Lifecycle Guard - Prevent Multiple Launches
  // ============================================================================
  if (isSystemSurfaceActive) {
    console.warn(
      '[SystemSurfaceInvariant] Duplicate launch suppressed (expected behavior)',
      {
        app: event.packageName,
        eventType: event.type,
        timestamp: event.timestamp,
        time: new Date(event.timestamp).toISOString(),
        note: 'Near-simultaneous FOREGROUND_CHANGED and USER_INTERACTION_FOREGROUND events',
      }
    );
    
    return { type: 'NONE' };
  }
  
  // ============================================================================
  // Priority #1: Check expired Quick Task (foreground expiration)
  // ============================================================================
  const expired = state.expiredQuickTasks[app];
  if (expired && expired.expiredWhileForeground) {
    // Freshness validation: Is this flag stale?
    const now = timestamp;
    const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
    const age = now - expired.expiredAt;
    
    if (age > MAX_AGE_MS) {
      // Stale flag - clear it and continue to OS Trigger Brain
      console.warn('[Decision Engine] Stale expiredQuickTask flag detected - clearing', {
        app,
        expiredAt: new Date(expired.expiredAt).toISOString(),
        ageSeconds: Math.round(age / 1000),
        maxAgeMinutes: 10,
        reason: 'Flag older than 10 minutes - likely from previous app session',
      });
      delete state.expiredQuickTasks[app];
      // Fall through to Priority #2 (background expiration) and then OS Trigger Brain
    } else {
      // Fresh flag - show choice screen
      console.log('[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground) - showing choice screen');
      console.log('[Decision Engine] Quick Task expired while user was IN the app');
      console.log('[Decision Engine] Flag age:', { ageSeconds: Math.round(age / 1000) });
      console.log('[Decision Engine] Captured foreground at expiration:', {
        app,
        foregroundAppAtExpiration: expired.foregroundAppAtExpiration,
        note: 'Time-of-truth captured at TIMER_EXPIRED',
      });
      console.log('[Decision Engine] Flag will be cleared by user choice, not by system launch');
      
      // DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
      // Suppress Quick Task for this app entry
      suppressQuickTaskForApp = app;
      console.log('[Decision Engine] Quick Task suppressed for app entry (DEPRECATED - Phase 4.1):', app);
      
      // Notify native that SystemSurface is launching
      setSystemSurfaceActive(true);
      
      // Set lifecycle guard
      isSystemSurfaceActive = true;
      console.log('[SystemSurfaceInvariant] LAUNCH', { app, wakeReason: 'POST_QUICK_TASK_CHOICE' });
      
      return {
        type: 'LAUNCH',
        app,
        wakeReason: 'POST_QUICK_TASK_CHOICE',
      };
    }
  }
  
  // ============================================================================
  // Priority #2: Check expired Quick Task (background expiration)
  // ============================================================================
  if (expired && !expired.expiredWhileForeground) {
    // Clear the flag and continue to OS Trigger Brain
    delete state.expiredQuickTasks[app];
  }
  
  // ============================================================================
  // Priority #3: Evaluate OS Trigger Brain
  // ============================================================================
  const osDecision = await evaluateOSTriggerBrain(app, timestamp, state);
  
  if (osDecision === 'SUPPRESS') {
    // No need to notify native - SystemSurface is not launching
    return { type: 'NONE' };
  }
  
  if (osDecision === 'QUICK_TASK') {
    // DEPRECATED (Phase 4.1): Quick Task entry now decided by Native
    // This code path should NOT be reached in Phase 4.1
    // Native emits SHOW_QUICK_TASK_DIALOG directly, bypassing OS Trigger Brain
    console.warn('[Decision Engine] ⚠️ UNEXPECTED: OS Trigger Brain returned QUICK_TASK in Phase 4.1');
    console.warn('[Decision Engine] Native should have made entry decision already');
    console.warn('[Decision Engine] This indicates a bug in Phase 4.1 migration');
    
    // Check if Quick Task is suppressed for this app entry
    if (suppressQuickTaskForApp === app) {
      return { type: 'NONE' };
    }
    
    // Set phase = DECISION when showing dialog
    // Phase A: User sees dialog, no timer running yet
    state.quickTaskPhaseByApp[app] = 'DECISION';
    
    // Notify native that SystemSurface is launching
    setSystemSurfaceActive(true);
    
    // Set lifecycle guard
    isSystemSurfaceActive = true;
    
    return {
      type: 'LAUNCH',
      app,
      wakeReason: 'SHOW_QUICK_TASK_DIALOG',
    };
  }
  
  if (osDecision === 'INTERVENTION') {
    // Notify native that SystemSurface is launching
    setSystemSurfaceActive(true);
    
    // Set lifecycle guard
    isSystemSurfaceActive = true;
    
    return {
      type: 'LAUNCH',
      app,
      wakeReason: 'START_INTERVENTION_FLOW',
    };
  }
  
  // ============================================================================
  // Priority #4: Default (should never reach here)
  // ============================================================================
  console.warn('[Decision Engine] ⚠️ Unexpected: OS Trigger Brain returned unknown result');
  return { type: 'NONE' };
}
