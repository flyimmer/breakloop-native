/**
 * System Event Handler
 * 
 * Receives mechanical events from native and classifies their semantic meaning.
 * This is the ONLY place where semantic decisions are made.
 */

import { loadTimerState, saveTimerState, TimerState } from './stateManager';
import { evaluateTriggerLogic } from '../os/osTriggerBrain';
import { launchSystemSurface } from './nativeBridge';

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
  type: 'TIMER_EXPIRED' | 'FOREGROUND_CHANGED';
  packageName: string;
  timestamp: number;
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
  console.log('[System Brain] Timer expired for:', packageName);
  
  // SEMANTIC CLASSIFICATION: What kind of timer expired?
  const quickTaskTimer = state.quickTaskTimers[packageName];
  const intentionTimer = state.intentionTimers[packageName];
  
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
    
    launchSystemSurface({
      wakeReason: timerType === 'QUICK_TASK' ? 'QUICK_TASK_EXPIRED_FOREGROUND' : 'INTENTION_EXPIRED_FOREGROUND',
      triggeringApp: packageName,
    });
  } else {
    // User switched to another app → silent cleanup only
    console.log('[System Brain] ✓ User switched apps - silent cleanup only (no intervention)');
    console.log('[System Brain] Current foreground app:', currentForegroundApp);
  }
}

/**
 * Handle foreground app change (MECHANICAL event from native).
 * 
 * System Brain evaluates OS Trigger Brain logic.
 */
async function handleForegroundChange(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] Foreground changed to:', packageName);
  
  // Update last meaningful app
  const previousApp = state.lastMeaningfulApp;
  state.lastMeaningfulApp = packageName;
  
  console.log('[System Brain] Foreground app updated:', {
    previous: previousApp,
    current: packageName,
  });
  
  // Evaluate OS Trigger Brain logic (semantic decision)
  // Note: evaluateTriggerLogic will handle its own intervention launching
  evaluateTriggerLogic(packageName, timestamp);
}
