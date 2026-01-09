/**
 * State Manager for System Brain
 * 
 * System Brain is event-driven, so it must persist and restore state
 * on each invocation. This module handles state persistence.
 * 
 * IMPORTANT: System Brain does NOT maintain in-memory state between events.
 * All state must be loaded from persistent storage on each event.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STATE_KEY = 'system_brain_state_v1';

/**
 * Timer state structure (semantic state owned by System Brain).
 */
export interface TimerState {
  quickTaskTimers: Record<string, { expiresAt: number }>;
  intentionTimers: Record<string, { expiresAt: number }>;
  quickTaskUsageHistory: number[];  // PERSISTED - critical for kill-safety
  lastMeaningfulApp: string | null;
  isHeadlessTaskProcessing: boolean;  // Track if we're in headless task context
  expiredQuickTasks: Record<string, {
    expiredAt: number;
    expiredWhileForeground: boolean;  // Track WHERE user was at expiration time
  }>;  // Apps where Quick Task permission has ended, awaiting user interaction
  lastSemanticChangeTs?: number;  // Monotonic timestamp for UI reactivity
}

/**
 * Load semantic state from persistent storage.
 * 
 * Called at the start of each event handler invocation.
 */
export async function loadTimerState(): Promise<TimerState> {
  try {
    const json = await AsyncStorage.getItem(STATE_KEY);
    if (json) {
      const state = JSON.parse(json);
      console.log('[System Brain] State loaded from storage:', {
        quickTaskTimers: Object.keys(state.quickTaskTimers || {}).length,
        intentionTimers: Object.keys(state.intentionTimers || {}).length,
        usageHistoryLength: (state.quickTaskUsageHistory || []).length,
        lastMeaningfulApp: state.lastMeaningfulApp,
      });
      
      // Migrate expiredQuickTasks from old array format to new Record format
      const rawExpired = state.expiredQuickTasks || state.pendingQuickTaskIntervention || [];
      let expiredQuickTasks: Record<string, { expiredAt: number; expiredWhileForeground: boolean }> = {};
      
      if (Array.isArray(rawExpired)) {
        // Old format: assume all expired while foreground (conservative approach)
        console.log('[System Brain] Migrating expiredQuickTasks from array to Record format');
        rawExpired.forEach((pkg: string) => {
          expiredQuickTasks[pkg] = {
            expiredAt: Date.now(),
            expiredWhileForeground: true,  // Conservative: force intervention for existing expired tasks
          };
        });
      } else {
        // New format: already a Record
        expiredQuickTasks = rawExpired;
      }
      
      const baseState: TimerState = {
        quickTaskTimers: state.quickTaskTimers || {},
        intentionTimers: state.intentionTimers || {},
        quickTaskUsageHistory: state.quickTaskUsageHistory || [],
        lastMeaningfulApp: state.lastMeaningfulApp || null,
        isHeadlessTaskProcessing: false,  // Always false when loading from storage
        expiredQuickTasks,  // Migrated format
      };
      
      // Migration: Delete any persisted blockingState from old code
      if (state.blockingState) {
        console.log('[System Brain] Migrating: removing persisted blockingState (lifecycle flag should never persist)');
      }
      
      // Merge with in-memory overrides (ensures deleted flags stay deleted)
      const mergedState = mergeWithInMemoryCache(baseState);
      
      return mergedState;
    }
  } catch (e) {
    console.warn('[System Brain] Failed to load state:', e);
  }
  
  // Return default state if load fails
  console.log('[System Brain] Using default state (no saved state found)');
  return {
    quickTaskTimers: {},
    intentionTimers: {},
    quickTaskUsageHistory: [],  // Empty array
    lastMeaningfulApp: null,
    isHeadlessTaskProcessing: false,  // Default to false
    expiredQuickTasks: {},  // Empty Record
  };
}

/**
 * Save semantic state to persistent storage.
 * 
 * Called at the end of each event handler invocation.
 */
export async function saveTimerState(state: TimerState): Promise<void> {
  try {
    const json = JSON.stringify(state);
    await AsyncStorage.setItem(STATE_KEY, json);
    console.log('[System Brain] State saved to storage:', {
      quickTaskTimers: Object.keys(state.quickTaskTimers).length,
      intentionTimers: Object.keys(state.intentionTimers).length,
      usageHistoryLength: state.quickTaskUsageHistory.length,
      lastMeaningfulApp: state.lastMeaningfulApp,
      expiredQuickTasks: state.expiredQuickTasks,
    });
  } catch (e) {
    console.warn('[System Brain] Failed to save state:', e);
  }
}

/**
 * In-memory state cache for UI coordination.
 * 
 * CRITICAL: This is ONLY for UI-driven state mutations during active sessions.
 * System Brain still loads state from AsyncStorage on each event.
 * 
 * This cache allows UI to synchronously clear flags when user makes decisions,
 * avoiding race conditions with AsyncStorage.
 * 
 * The next System Brain event will persist these changes via saveTimerState.
 */
let inMemoryStateCache: TimerState | null = null;

/**
 * Set in-memory state cache (called by System Brain after loading state).
 * 
 * This allows UI to read and modify state synchronously during active sessions.
 */
export function setInMemoryStateCache(state: TimerState): void {
  inMemoryStateCache = state;
}

/**
 * Get in-memory state cache (for UI coordination only).
 * 
 * IMPORTANT: This is NOT a substitute for System Brain's event-driven loading.
 * System Brain still loads from AsyncStorage on each event.
 */
export function getInMemoryStateCache(): TimerState | null {
  return inMemoryStateCache;
}

/**
 * Clear expired Quick Task flag synchronously in memory.
 * 
 * Called by UI when user makes explicit choice after Quick Task expiration.
 * Persistence happens later via System Brain's normal save cycle.
 * 
 * @param app - App package name
 */
export function clearExpiredQuickTaskInMemory(app: string): void {
  if (inMemoryStateCache?.expiredQuickTasks?.[app]) {
    delete inMemoryStateCache.expiredQuickTasks[app];
    console.log('[SystemBrain] Cleared expiredQuickTask in memory:', app);
    console.log('[SystemBrain] Will be persisted on next System Brain event');
  } else {
    console.log('[SystemBrain] No expiredQuickTask flag to clear for:', app);
  }
}

/**
 * Clear blocking state synchronously in memory.
 * 
 * DEPRECATED: blockingState has been removed.
 * This function now only clears expiredQuickTask flag for migration safety.
 * 
 * @param app - App package name
 */
export function clearBlockingState(app: string): void {
  // Clear expiredQuickTask flag (legacy cleanup)
  if (inMemoryStateCache?.expiredQuickTasks?.[app]) {
    delete inMemoryStateCache.expiredQuickTasks[app];
    console.log('[SystemBrain] 🔓 Cleared expiredQuickTask flag (in-memory):', app);
    console.log('[SystemBrain] Will be persisted on next System Brain event');
  } else {
    console.log('[SystemBrain] No expiredQuickTask flag to clear for:', app);
  }
}

/**
 * In-memory session override for UI coordination.
 * 
 * When System Brain determines a session should transition
 * (e.g., Quick Task expires → show choice screen), it sets this override.
 * SystemSurface observes this on natural React re-renders and reacts.
 * 
 * This is NOT persisted - it's ephemeral coordination state.
 */
export let nextSessionOverride: {
  app: string;
  kind: 'POST_QUICK_TASK_CHOICE' | 'INTERVENTION';
} | null = null;

/**
 * Set next session override (called by System Brain).
 */
export function setNextSessionOverride(app: string, kind: 'POST_QUICK_TASK_CHOICE' | 'INTERVENTION'): void {
  nextSessionOverride = { app, kind };
  console.log('[SystemBrain] Set nextSessionOverride:', nextSessionOverride);
}

/**
 * Clear next session override (called by SystemSurface after consuming).
 */
export function clearNextSessionOverride(): void {
  nextSessionOverride = null;
  console.log('[SystemBrain] Cleared nextSessionOverride');
}

/**
 * Get next session override (called by SystemSurface to observe).
 */
export function getNextSessionOverride(): typeof nextSessionOverride {
  return nextSessionOverride;
}

/**
 * Merge in-memory state mutations with persisted state.
 * 
 * In-memory cache is authoritative - if a flag is deleted in memory,
 * it stays deleted even if persistence still has it.
 * 
 * This ensures UI-driven mutations (like clearing expired Quick Task flags)
 * are not resurrected by stale persisted state.
 * 
 * @param persistedState - State loaded from AsyncStorage
 * @returns Merged state with in-memory overrides applied
 */
export function mergeWithInMemoryCache(persistedState: TimerState): TimerState {
  if (!inMemoryStateCache) {
    // No in-memory mutations - return persisted state as-is
    return persistedState;
  }
  
  // Dev assertion for debugging
  if (__DEV__ && inMemoryStateCache && !persistedState.expiredQuickTasks) {
    console.warn(
      '[SystemBrain] Merge running with empty persisted expiredQuickTasks but non-empty in-memory cache',
      inMemoryStateCache.expiredQuickTasks
    );
  }
  
  // Merge expiredQuickTasks: in-memory deletions override persistence
  const mergedExpiredQuickTasks = { ...persistedState.expiredQuickTasks };
  
  // For each app in persisted state, check if it was deleted in memory
  for (const app in persistedState.expiredQuickTasks) {
    if (!inMemoryStateCache.expiredQuickTasks[app]) {
      // Flag exists in persistence but NOT in memory → was deleted by UI
      delete mergedExpiredQuickTasks[app];
      console.log('[SystemBrain] Merge: Deleted stale expiredQuickTask flag:', app);
    }
  }
  
  // Add any new flags from memory (shouldn't happen, but be defensive)
  for (const app in inMemoryStateCache.expiredQuickTasks) {
    if (!mergedExpiredQuickTasks[app]) {
      mergedExpiredQuickTasks[app] = inMemoryStateCache.expiredQuickTasks[app];
      console.log('[SystemBrain] Merge: Added new expiredQuickTask flag from memory:', app);
    }
  }
  
  const mergedState = {
    ...persistedState,
    expiredQuickTasks: mergedExpiredQuickTasks,
  };
  
  console.log('[SystemBrain] Merged in-memory overrides into persisted state');
  
  return mergedState;
}