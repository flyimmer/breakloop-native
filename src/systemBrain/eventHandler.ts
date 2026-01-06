/**
 * System Event Handler
 * 
 * Receives mechanical events from native and classifies their semantic meaning.
 * This is the ONLY place where semantic decisions are made.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTimerState, saveTimerState, TimerState } from './stateManager';
import { launchSystemSurface } from './nativeBridge';
import { isMonitoredApp } from '../os/osConfig';

/**
 * Load Quick Task configuration from user settings.
 * 
 * Returns the configured number of Quick Task uses per 15-minute window.
 * This is the user's n_quickTask setting from Settings screen.
 */
async function loadQuickTaskConfig(): Promise<{ maxUses: number; windowMs: number }> {
  try {
    // Load from the same storage key used by Settings screen
    const configJson = await AsyncStorage.getItem('quick_task_settings_v1');
    if (configJson) {
      const config = JSON.parse(configJson);
      const maxUses = config.usesPerWindow ?? 1; // Default to 1 if not set
      
      console.log('[System Brain] Quick Task config loaded:', {
        maxUses,
        source: 'quick_task_settings_v1',
      });
      
      return {
        maxUses,
        windowMs: 15 * 60 * 1000, // 15 minutes
      };
    }
  } catch (e) {
    console.warn('[System Brain] Failed to load Quick Task config:', e);
  }
  
  // Fallback defaults
  console.log('[System Brain] Using default Quick Task config');
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
 * CRITICAL: This function cleans up old entries from persisted state.
 * 
 * @param currentTimestamp - Current timestamp
 * @param state - Semantic state (will be mutated to clean old entries)
 * @returns Number of Quick Task uses remaining
 */
async function getQuickTaskRemaining(currentTimestamp: number, state: TimerState): Promise<number> {
  // Load user's configured max uses (n_quickTask from Settings)
  const config = await loadQuickTaskConfig();
  const { maxUses, windowMs } = config;
  
  // Filter out timestamps older than 15 minutes from PERSISTED history
  const recentUsages = state.quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update persisted history (cleanup old entries)
  if (recentUsages.length !== state.quickTaskUsageHistory.length) {
    const removed = state.quickTaskUsageHistory.length - recentUsages.length;
    state.quickTaskUsageHistory = recentUsages;
    console.log('[System Brain] Cleaned up old usage history entries:', {
      removed,
      remaining: recentUsages.length,
    });
  }
  
  // Calculate remaining uses based on user's configured limit
  const remaining = Math.max(0, maxUses - recentUsages.length);
  
  console.log('[System Brain] Quick Task availability check (GLOBAL):', {
    maxUses: `${maxUses} (from user settings)`,
    recentUsagesGlobal: recentUsages.length,
    remaining,
    windowMinutes: windowMs / (60 * 1000),
  });
  
  return remaining;
}

/**
 * Record a Quick Task usage GLOBALLY.
 * 
 * This is semantic logic: "user consumed one Quick Task use"
 * 
 * CRITICAL: Usage history is PERSISTED in state, not in-memory.
 * This ensures kill-safety and correct quota enforcement.
 * 
 * @param packageName - App package name (for logging only)
 * @param timestamp - Current timestamp
 * @param state - Semantic state (will be mutated)
 */
function recordQuickTaskUsage(packageName: string, timestamp: number, state: TimerState): void {
  // Add to persisted usage history
  state.quickTaskUsageHistory.push(timestamp);
  
  console.log('[System Brain] Quick Task usage recorded (GLOBAL, PERSISTED)', {
    packageName,
    timestamp,
    totalUsagesGlobal: state.quickTaskUsageHistory.length,
    note: 'Usage is GLOBAL across all apps and PERSISTED for kill-safety',
  });
}

/**
 * Handle a mechanical system event from native.
 * 
 * Native emits:
 * - { type: "TIMER_EXPIRED", packageName, timestamp }
 * - { type: "FOREGROUND_CHANGED", packageName, timestamp }
 * 
 * System Brain must:
 * 1. Load current semantic state (t_quickTask, t_intention, etc.)
 * 2. Classify what this event means semantically
 * 3. Decide whether to intervene
 * 4. Save updated state
 */
export async function handleSystemEvent(event: {
  type: 'TIMER_EXPIRED' | 'FOREGROUND_CHANGED' | 'TIMER_SET';
  packageName: string;
  timestamp: number;
  expiresAt?: number; // For TIMER_SET events
}): Promise<void> {
  const { type, packageName, timestamp } = event;
  
  console.log('[System Brain] ========================================');
  console.log('[System Brain] Processing event:', { type, packageName, timestamp });
  console.log('[System Brain] Event time:', new Date(timestamp).toISOString());
  
  // Load semantic state (event-driven, must restore state each time)
  const state = await loadTimerState();
  
  if (type === 'TIMER_EXPIRED') {
    await handleTimerExpiration(packageName, timestamp, state);
  } else if (type === 'FOREGROUND_CHANGED') {
    await handleForegroundChange(packageName, timestamp, state);
  } else if (type === 'TIMER_SET') {
    await handleTimerSet(packageName, event.expiresAt!, timestamp, state);
  }
  
  // Save updated semantic state
  await saveTimerState(state);
  
  console.log('[System Brain] Event processing complete');
  console.log('[System Brain] ========================================');
}

/**
 * Handle timer expiration (MECHANICAL event from native).
 * 
 * System Brain must classify:
 * - Is this a Quick Task timer expiration?
 * - Is this an Intention timer expiration?
 * - Is this something else?
 * 
 * Then decide:
 * - Should I launch SystemSurface for intervention?
 * - Should I stay silent?
 */
async function handleTimerExpiration(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] ========================================');
  console.log('[System Brain] 🔔 TIMER_EXPIRED event received');
  console.log('[System Brain] Timer expired for:', packageName);
  console.log('[System Brain] Timestamp:', timestamp, new Date(timestamp).toISOString());
  
  // SEMANTIC CLASSIFICATION: What kind of timer expired?
  const quickTaskTimer = state.quickTaskTimers[packageName];
  const intentionTimer = state.intentionTimers[packageName];
  
  console.log('[System Brain] Checking stored timers:', {
    hasQuickTaskTimer: !!quickTaskTimer,
    quickTaskExpiresAt: quickTaskTimer?.expiresAt,
    hasIntentionTimer: !!intentionTimer,
    intentionExpiresAt: intentionTimer?.expiresAt,
  });
  
  let timerType: 'QUICK_TASK' | 'INTENTION' | 'UNKNOWN' = 'UNKNOWN';
  
  if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
    timerType = 'QUICK_TASK';
    console.log('[System Brain] ✓ Classified as Quick Task expiration');
    console.log('[System Brain] Quick Task timer details:', {
      expiresAt: quickTaskTimer.expiresAt,
      expiresAtTime: new Date(quickTaskTimer.expiresAt).toISOString(),
      expiredMs: timestamp - quickTaskTimer.expiresAt,
    });
    delete state.quickTaskTimers[packageName];
  } else if (intentionTimer && timestamp >= intentionTimer.expiresAt) {
    timerType = 'INTENTION';
    console.log('[System Brain] ✓ Classified as Intention expiration');
    console.log('[System Brain] Intention timer details:', {
      expiresAt: intentionTimer.expiresAt,
      expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
      expiredMs: timestamp - intentionTimer.expiresAt,
    });
    delete state.intentionTimers[packageName];
  }
  
  if (timerType === 'UNKNOWN') {
    console.log('[System Brain] ⚠️ Timer expiration for unknown timer - ignoring');
    console.log('[System Brain] Current state:', {
      quickTaskTimers: Object.keys(state.quickTaskTimers),
      intentionTimers: Object.keys(state.intentionTimers),
    });
    console.log('[System Brain] ========================================');
    return;
  }
  
  // SEMANTIC DECISION: Should we intervene?
  // Check if user is still on the expired app
  const currentForegroundApp = state.lastMeaningfulApp;
  
  console.log('[System Brain] Checking foreground app:', {
    expiredApp: packageName,
    currentForegroundApp,
    timerType,
    shouldTriggerIntervention: currentForegroundApp === packageName,
  });
  
  if (currentForegroundApp === packageName) {
    // User is still on the app → launch SystemSurface for intervention
    console.log('[System Brain] 🚨 User still on expired app - launching intervention');
    console.log('[System Brain] This is SILENT expiration (no reminder screen)');
    
    // Phase 2: Launch with explicit wake reason (System Brain pre-decided)
    const wakeReason = timerType === 'QUICK_TASK' 
      ? 'QUICK_TASK_EXPIRED_FOREGROUND' 
      : 'INTENTION_EXPIRED_FOREGROUND';
    
    await launchSystemSurface(packageName, wakeReason as any);
  } else {
    // User switched to another app → silent cleanup only
    console.log('[System Brain] ✓ User switched apps - silent cleanup only (no intervention)');
    console.log('[System Brain] Current foreground app:', currentForegroundApp);
  }
  console.log('[System Brain] ========================================');
}

/**
 * Handle timer set (MECHANICAL event from native).
 * 
 * Native reports: "A timer was stored for app X with expiration Y"
 * System Brain makes semantic decision: "Record this as Quick Task usage"
 * 
 * @param packageName - App package name
 * @param expiresAt - Timer expiration timestamp
 * @param timestamp - Current timestamp
 * @param state - Semantic state
 */
async function handleTimerSet(
  packageName: string,
  expiresAt: number,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] ========================================');
  console.log('[System Brain] 🔔 TIMER_SET event received');
  console.log('[System Brain] Timer set for:', packageName);
  console.log('[System Brain] Timer details:', {
    expiresAt,
    expiresAtTime: new Date(expiresAt).toISOString(),
    durationMs: expiresAt - timestamp,
    durationSec: Math.round((expiresAt - timestamp) / 1000),
  });
  
  // SEMANTIC DECISION: Store timer in semantic state
  state.quickTaskTimers[packageName] = { expiresAt };
  console.log('[System Brain] ✓ Timer stored in semantic state');
  
  // SEMANTIC DECISION: Record usage (this consumes quota)
  recordQuickTaskUsage(packageName, timestamp, state);
  
  console.log('[System Brain] ✅ Quick Task timer recorded in persisted state');
  console.log('[System Brain] ========================================');
}

/**
 * Handle foreground app change (MECHANICAL event from native).
 * 
 * System Brain ONLY tracks state - ForegroundDetectionService handles intervention launching.
 */
async function handleForegroundChange(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] Foreground changed to:', packageName);
  
  // Always update last meaningful app
  const previousApp = state.lastMeaningfulApp;
  state.lastMeaningfulApp = packageName;
  
  console.log('[System Brain] Foreground app updated:', {
    previous: previousApp,
    current: packageName,
  });
  
  // 🔒 GUARD: only monitored apps are eligible for OS Trigger Brain evaluation
  console.log('[System Brain] Checking if app is monitored:', {
    packageName,
    isMonitoredAppFunction: typeof isMonitoredApp,
  });
  
  const monitored = isMonitoredApp(packageName);
  console.log('[System Brain] Monitored app check result:', {
    packageName,
    isMonitored: monitored,
  });
  
  if (!monitored) {
    console.log('[System Brain] App is not monitored, skipping:', packageName);
    return;
  }
  
  // Phase 2: Evaluate OS Trigger Brain and pre-decide UI flow
  console.log('[System Brain] Evaluating OS Trigger Brain for:', packageName);
  
  // Step 1: Check t_intention (per-app)
  const intentionTimer = state.intentionTimers[packageName];
  if (intentionTimer && timestamp < intentionTimer.expiresAt) {
    console.log('[System Brain] ✓ t_intention VALID - suppressing intervention');
    return;
  }
  
  // Step 2: Check t_quickTask (per-app)
  const quickTaskTimer = state.quickTaskTimers[packageName];
  if (quickTaskTimer && timestamp < quickTaskTimer.expiresAt) {
    console.log('[System Brain] ✓ t_quickTask ACTIVE - suppressing intervention');
    return;
  }
  
  // Step 3: Check n_quickTask (global) and decide
  const quickTaskRemaining = await getQuickTaskRemaining(timestamp, state);
  
  if (quickTaskRemaining > 0) {
    console.log('[System Brain] ✓ n_quickTask > 0 - launching with SHOW_QUICK_TASK_DIALOG');
    await launchSystemSurface(packageName, 'SHOW_QUICK_TASK_DIALOG');
  } else {
    console.log('[System Brain] ✗ n_quickTask = 0 - launching with START_INTERVENTION_FLOW');
    await launchSystemSurface(packageName, 'START_INTERVENTION_FLOW');
  }
}
