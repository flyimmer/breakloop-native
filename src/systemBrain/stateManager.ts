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
      
      return {
        quickTaskTimers: state.quickTaskTimers || {},
        intentionTimers: state.intentionTimers || {},
        quickTaskUsageHistory: state.quickTaskUsageHistory || [],
        lastMeaningfulApp: state.lastMeaningfulApp || null,
        isHeadlessTaskProcessing: false,  // Always false when loading from storage
        expiredQuickTasks,  // Migrated format
      };
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
