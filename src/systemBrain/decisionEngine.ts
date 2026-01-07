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

import { TimerState } from './stateManager';
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
  console.log('[Decision Engine] Evaluating OS Trigger Brain for:', app);
  
  // Priority #1: Check t_intention (per-app suppressor)
  const intentionTimer = state.intentionTimers[app];
  if (intentionTimer && timestamp < intentionTimer.expiresAt) {
    console.log('[Decision Engine] ✓ t_intention ACTIVE - suppressing intervention', {
      app,
      expiresAt: intentionTimer.expiresAt,
      expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
    });
    return 'SUPPRESS';
  }
  
  // Priority #2: Check t_quickTask (per-app timer)
  const quickTaskTimer = state.quickTaskTimers[app];
  if (quickTaskTimer && timestamp < quickTaskTimer.expiresAt) {
    console.log('[Decision Engine] ✓ t_quickTask ACTIVE - suppressing intervention', {
      app,
      expiresAt: quickTaskTimer.expiresAt,
      expiresAtTime: new Date(quickTaskTimer.expiresAt).toISOString(),
    });
    return 'SUPPRESS';
  }
  
  // Priority #3: Check n_quickTask (global usage count)
  const quickTaskRemaining = await getQuickTaskRemaining(timestamp, state);
  if (quickTaskRemaining > 0) {
    console.log('[Decision Engine] ✓ n_quickTask > 0 - decision: QUICK_TASK', {
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
  
  console.log('[Decision Engine] ========================================');
  console.log('[Decision Engine] Making decision for event:', {
    type: event.type,
    app,
    timestamp,
    time: new Date(timestamp).toISOString(),
  });
  
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
    console.warn('[SystemSurfaceInvariant] BLOCKED launch', {
      app,
      wakeReason: 'N/A (blocked before decision)',
      reason: 'surface already active',
      note: 'Only ONE SystemSurface may be active at a time',
    });
    return { type: 'NONE' };
  }
  
  // ============================================================================
  // Priority #1: Check expired Quick Task (foreground expiration)
  // ============================================================================
  const expired = state.expiredQuickTasks[app];
  if (expired && expired.expiredWhileForeground) {
    console.log('[Decision Engine] 🚨 PRIORITY #1: Expired Quick Task (foreground) - forcing intervention');
    console.log('[Decision Engine] Quick Task expired while user was IN the app');
    
    // Clear the flag (consumed)
    delete state.expiredQuickTasks[app];
    
    // Set lifecycle guard
    isSystemSurfaceActive = true;
    console.log('[SystemSurfaceInvariant] LAUNCH', { app, wakeReason: 'START_INTERVENTION_FLOW' });
    
    return {
      type: 'LAUNCH',
      app,
      wakeReason: 'START_INTERVENTION_FLOW',
    };
  }
  
  // ============================================================================
  // Priority #2: Check expired Quick Task (background expiration)
  // ============================================================================
  if (expired && !expired.expiredWhileForeground) {
    console.log('[Decision Engine] ℹ️ PRIORITY #2: Expired Quick Task (background) - clearing flag');
    console.log('[Decision Engine] Quick Task expired while user was in DIFFERENT app');
    console.log('[Decision Engine] Clearing flag and continuing to OS Trigger Brain');
    
    // Clear the flag and continue to OS Trigger Brain
    delete state.expiredQuickTasks[app];
  }
  
  // ============================================================================
  // Priority #3: Evaluate OS Trigger Brain
  // ============================================================================
  const osDecision = await evaluateOSTriggerBrain(app, timestamp, state);
  
  if (osDecision === 'SUPPRESS') {
    console.log('[Decision Engine] ✓ OS Trigger Brain: SUPPRESS - no launch needed');
    console.log('[Decision Engine] Decision: NONE');
    console.log('[Decision Engine] ========================================');
    return { type: 'NONE' };
  }
  
  if (osDecision === 'QUICK_TASK') {
    console.log('[Decision Engine] ✓ OS Trigger Brain: QUICK_TASK - launching Quick Task dialog');
    
    // Set lifecycle guard
    isSystemSurfaceActive = true;
    console.log('[SystemSurfaceInvariant] LAUNCH', { app, wakeReason: 'SHOW_QUICK_TASK_DIALOG' });
    console.log('[Decision Engine] ========================================');
    
    return {
      type: 'LAUNCH',
      app,
      wakeReason: 'SHOW_QUICK_TASK_DIALOG',
    };
  }
  
  if (osDecision === 'INTERVENTION') {
    console.log('[Decision Engine] ✓ OS Trigger Brain: INTERVENTION - launching intervention flow');
    
    // Set lifecycle guard
    isSystemSurfaceActive = true;
    console.log('[SystemSurfaceInvariant] LAUNCH', { app, wakeReason: 'START_INTERVENTION_FLOW' });
    console.log('[Decision Engine] ========================================');
    
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
  console.log('[Decision Engine] Decision: NONE (fallback)');
  console.log('[Decision Engine] ========================================');
  return { type: 'NONE' };
}
