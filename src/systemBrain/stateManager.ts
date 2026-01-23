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
  quickTaskTimers: Record<string, { expiresAt: number }>; // DEPRECATED - Native authoritative
  intentionTimers: Record<string, { expiresAt: number }>;
  quickTaskUsageHistory: number[];  // DEPRECATED - Native authoritative
  quickTaskPhaseByApp: Record<string, 'DECISION' | 'ACTIVE'>;  // DEPRECATED - Native authoritative
  lastMeaningfulApp: string | null;
  currentForegroundApp?: string | null;
  isHeadlessTaskProcessing: boolean;
  expiredQuickTasks: Record<string, { // DEPRECATED - Native authoritative
    expiredAt: number;
    expiredWhileForeground: boolean;
    foregroundAppAtExpiration?: string | null;
  }>;
  lastSemanticChangeTs?: number;
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

      // ⚠️ CONSERVATIVE MIGRATION: Only infer ACTIVE from active timers. Never infer DECISION.
      let quickTaskPhaseByApp: Record<string, 'DECISION' | 'ACTIVE'> = {};

      if (!state.quickTaskPhaseByApp) {
        // Migration: Initialize quickTaskPhaseByApp if missing

        // CONSERVATIVE MIGRATION: Only infer ACTIVE from active (non-expired) timers
        // We can safely infer ACTIVE because:
        // 1. Timer exists → user clicked "Quick Task" button (completed DECISION → ACTIVE)
        // 2. Timer not expired → phase is still ACTIVE
        // 
        // We CANNOT infer DECISION because:
        // - We don't know if dialog was actually showing
        // - Dialog might have been dismissed
        // - User might have switched apps
        const currentTimestamp = Date.now();

        for (const app in state.quickTaskTimers) {
          const timer = state.quickTaskTimers[app];

          // Only infer ACTIVE if timer exists AND is not expired
          if (timer && currentTimestamp < timer.expiresAt) {
            quickTaskPhaseByApp[app] = 'ACTIVE';
          } else {
            // Timer expired or missing → do NOT infer phase
            // App will start fresh without a phase (correct behavior)
            console.log('[Migration] Skipping phase inference - timer expired or missing:', {
              app,
              hasTimer: !!timer,
              timerExpired: timer ? currentTimestamp >= timer.expiresAt : true,
              note: 'No phase inferred - app will start fresh',
            });
          }
        }

        // NOTE: If no timers exist, quickTaskPhaseByApp remains empty {}
        // This is correct - no phase means no Quick Task active
      } else {
        // Phase state already exists - use it
        quickTaskPhaseByApp = state.quickTaskPhaseByApp;
      }

      const baseState: TimerState = {
        quickTaskTimers: state.quickTaskTimers || {},
        intentionTimers: state.intentionTimers || {},
        quickTaskUsageHistory: state.quickTaskUsageHistory || [],
        quickTaskPhaseByApp,  // Migrated or existing phase state
        lastMeaningfulApp: state.lastMeaningfulApp || null,
        currentForegroundApp: state.currentForegroundApp || null,
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
    quickTaskPhaseByApp: {},  // Empty object - no phase means no Quick Task active
    lastMeaningfulApp: null,
    currentForegroundApp: null,
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
 * In-memory SystemSurface decision state.
 * 
 * CRITICAL: This is ephemeral lifecycle state and MUST NOT be persisted.
 * Persisting it will resurrect stale FINISH decisions and cause random closes.
 * 
 * This is pure runtime coordination, like bootstrapState.
 * 
 * Decision states:
 * - PENDING: No decision made yet (initial state)
 * - SHOW_SESSION: System Brain decided to show a session (dialog/intervention/etc)
 * - FINISH: System Brain decided no session is needed, SystemSurface should finish
 */
let systemSurfaceDecision: 'PENDING' | 'SHOW_SESSION' | 'FINISH' = 'PENDING';

/**
 * Get current SystemSurface decision.
 * 
 * @returns Current decision state
 */
export function getSystemSurfaceDecision(): 'PENDING' | 'SHOW_SESSION' | 'FINISH' {
  return systemSurfaceDecision;
}

/**
 * Set SystemSurface decision.
 * 
 * IMPORTANT: This is in-memory only and MUST NOT be persisted.
 * 
 * @param decision - New decision state
 */
export function setSystemSurfaceDecision(decision: 'PENDING' | 'SHOW_SESSION' | 'FINISH'): void {
  systemSurfaceDecision = decision;
  console.log('[SystemBrain] SystemSurface decision set:', decision);
}

/**
 * Notify native that SystemSurface is active or inactive.
 * 
 * PHASE 4.1: Lifecycle notification for entry decision guards.
 * 
 * Called when SystemSurface launches or finishes to update native guards.
 * This prevents duplicate entry decisions while UI is showing.
 * 
 * @param active - true if SystemSurface is launching, false if finishing
 */
export function setSystemSurfaceActive(active: boolean): void {
  try {
    const { NativeModules } = require('react-native');
    NativeModules.AppMonitorModule.setSystemSurfaceActive(active);
    console.log('[State Manager] Notified native: SystemSurface active =', active);
  } catch (error) {
    console.error('[State Manager] Failed to notify native:', error);
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
 * Track system-initiated foreground changes with time window.
 * This allows multiple duplicate events to all see the marker.
 * 
 * Android emits multiple FOREGROUND_CHANGED events for a single logical transition.
 * Using a time window ensures all events in the burst are treated as system-initiated.
 * 
 * This is NOT persisted - it's ephemeral coordination state.
 */
let systemInitiatedForegroundUntil = 0;

/**
 * Mark that foreground changes in the next 500ms are system-initiated.
 * Called by SystemSurface before backgrounding the app.
 */
export function markSystemInitiatedForegroundChange(): void {
  systemInitiatedForegroundUntil = Date.now() + 500;  // 500ms window
  console.log('[SystemBrain] Marked foreground changes as system-initiated for 500ms');
}

/**
 * Check if current foreground change is system-initiated.
 * Does NOT consume - allows multiple events to check within the time window.
 * Returns true if we're within the system-initiated time window.
 */
export function isSystemInitiatedForegroundChange(): boolean {
  const now = Date.now();
  const isSystemInitiated = now < systemInitiatedForegroundUntil;

  if (isSystemInitiated) {
    console.log('[SystemBrain] Foreground change is system-initiated (within window)');
  }

  // Auto-clear if expired
  if (now >= systemInitiatedForegroundUntil && systemInitiatedForegroundUntil > 0) {
    systemInitiatedForegroundUntil = 0;
    console.log('[SystemBrain] System-initiated window expired');
  }

  return isSystemInitiated;
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
    }
  }

  const mergedState = {
    ...persistedState,
    expiredQuickTasks: mergedExpiredQuickTasks,
  };

  return mergedState;
}