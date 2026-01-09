/**
 * System Event Handler
 * 
 * Receives mechanical events from native and classifies their semantic meaning.
 * This is the ONLY place where semantic decisions are made.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { loadTimerState, saveTimerState, TimerState, setInMemoryStateCache, setNextSessionOverride } from './stateManager';
import { launchSystemSurface } from './nativeBridge';
import { isMonitoredApp } from '../os/osConfig';
import { decideSystemSurfaceAction } from './decisionEngine';

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
  type: 'TIMER_EXPIRED' | 'FOREGROUND_CHANGED' | 'TIMER_SET' | 'USER_INTERACTION_FOREGROUND';
  packageName: string;
  timestamp: number;
  expiresAt?: number; // For TIMER_SET events
  timerType?: 'QUICK_TASK' | 'INTENTION'; // For TIMER_SET events (explicit type)
}): Promise<void> {
  const { type, packageName, timestamp } = event;
  
  console.log('[System Brain] ========================================');
  console.log('[System Brain] Event received:', type);  // ✅ Step 1: Log event type
  console.log('[System Brain] Processing event:', { type, packageName, timestamp });
  console.log('[System Brain] Event time:', new Date(timestamp).toISOString());
  
  // Load semantic state (event-driven, must restore state each time)
  const state = await loadTimerState();
  
  // Update in-memory cache for UI coordination
  setInMemoryStateCache(state);
  
  // Mark that we're processing in headless task context
  // This prevents BreakLoop package from corrupting lastMeaningfulApp
  state.isHeadlessTaskProcessing = true;
  
  try {
    if (type === 'TIMER_EXPIRED') {
      await handleTimerExpiration(packageName, timestamp, state);
    } else if (type === 'FOREGROUND_CHANGED') {
      await handleForegroundChange(packageName, timestamp, state);
    } else if (type === 'TIMER_SET') {
      console.log('[System Brain] 🔔 TIMER_SET routed to handleTimerSet');  // ✅ Step 1: Confirm routing
      await handleTimerSet(packageName, event.expiresAt!, timestamp, event.timerType!, state);
    } else if (type === 'USER_INTERACTION_FOREGROUND') {
      await handleUserInteraction(packageName, timestamp, state);
    }
  } finally {
    // Clear flag before saving (state should never persist with this flag true)
    state.isHeadlessTaskProcessing = false;
    
    // Save updated semantic state
    await saveTimerState(state);
    
    console.log('[System Brain] Event processing complete');
    console.log('[System Brain] ========================================');
  }
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
  
  // Check intention timer first (higher priority in expiration handling)
  if (intentionTimer && timestamp >= intentionTimer.expiresAt) {
    timerType = 'INTENTION';
    console.log('[System Brain] ✓ Classified as Intention Timer expiration');
    console.log('[System Brain] Intention timer details:', {
      expiresAt: intentionTimer.expiresAt,
      expiresAtTime: new Date(intentionTimer.expiresAt).toISOString(),
      expiredMs: timestamp - intentionTimer.expiresAt,
    });
    // Remove per-app suppressor
    delete state.intentionTimers[packageName];
    console.log('[System Brain] Intention timer removed from state');
  } else if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
    timerType = 'QUICK_TASK';
    console.log('[System Brain] ✓ Classified as Quick Task expiration');
    console.log('[System Brain] Quick Task timer details:', {
      expiresAt: quickTaskTimer.expiresAt,
      expiresAtTime: new Date(quickTaskTimer.expiresAt).toISOString(),
      expiredMs: timestamp - quickTaskTimer.expiresAt,
    });
    delete state.quickTaskTimers[packageName];
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
    // User is still on the app when timer expired
    
    if (timerType === 'QUICK_TASK') {
      // QUICK TASK EXPIRATION: Revoke permission, await user interaction
      console.log('[QuickTask] TIMER_EXPIRED for:', packageName);
      console.log('[QuickTask] Current foreground app:', currentForegroundApp);
      
      const expiredWhileForeground = currentForegroundApp === packageName;
      
      if (expiredWhileForeground) {
        // Set session override for UI to observe
        setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');
        state.lastSemanticChangeTs = Date.now();
        
        console.log('[SystemBrain] Quick Task expired in foreground:', {
          app: packageName,
          nextSessionOverride: 'POST_QUICK_TASK_CHOICE',
          lastSemanticChangeTs: state.lastSemanticChangeTs,
          note: 'SystemSurface will observe and dispatch REPLACE_SESSION',
        });
        
        // Keep legacy flag for migration safety (will be cleared by UI)
        state.expiredQuickTasks[packageName] = {
          expiredAt: timestamp,
          expiredWhileForeground: true,
        };
      } else {
        // Background expiration - no blocking
        state.expiredQuickTasks[packageName] = {
          expiredAt: timestamp,
          expiredWhileForeground: false,
        };
        
        console.log('[QuickTask] Permission revoked — waiting for user interaction', {
          expiredWhileForeground: false,
          note: 'Will clear flag and allow Quick Task dialog on next app entry',
        });
      }
      
      // ❌ DO NOT call launchSystemSurface() here
      // ❌ DO NOT emit events
      // ✅ Wait for USER_INTERACTION_FOREGROUND event
    } else {
      // INTENTION TIMER EXPIRATION: Mark expired, decision made at UI-safe boundary
      console.log('[System Brain] 🔔 Intention timer expired (foreground)');
      console.log('[System Brain] State updated - decision will be made at next UI-safe boundary');
      
      // ❌ DO NOT call launchSystemSurface() here
      // ❌ Timer expiration is NOT a safe UI lifecycle boundary
      // ✅ Timer already deleted earlier in this function
      // ✅ Decision will be made when user interaction occurs
    }
  } else {
    // User switched to another app → silent cleanup only
    if (timerType === 'QUICK_TASK') {
      console.log('[QuickTask] User already left app - no enforcement needed');
      console.log('[QuickTask] Current foreground app:', currentForegroundApp);
    } else {
      console.log('[System Brain] ✓ User switched apps - silent cleanup only (no intervention)');
      console.log('[System Brain] Current foreground app:', currentForegroundApp);
    }
  }
  console.log('[System Brain] ========================================');
}

/**
 * Handle user interaction in foreground app (MECHANICAL event from native).
 * 
 * Native emits this event for every user interaction (scroll, tap, content change).
 * System Brain decides whether enforcement is needed based on semantic state.
 * 
 * This event represents a UI-safe boundary for launching Activities.
 * 
 * @param packageName - App package name
 * @param timestamp - Current timestamp
 * @param state - Semantic state
 */
async function handleUserInteraction(
  packageName: string,
  timestamp: number,
  state: TimerState
): Promise<void> {
  console.log('[System Brain] USER_INTERACTION_FOREGROUND:', packageName);
  
  // Check if this app is monitored
  if (!isMonitoredApp(packageName)) {
    console.log('[System Brain] App is not monitored, ignoring interaction:', packageName);
    return;
  }
  
  // No blocking state guard needed - session-based blocking is handled by SystemSurface
  
  // ============================================================================
  // Call Decision Engine (UI-safe boundary)
  // ============================================================================
  console.log('[System Brain] UI-safe boundary - calling decision engine');
  
  const decision = await decideSystemSurfaceAction(
    { type: 'USER_INTERACTION_FOREGROUND', packageName, timestamp },
    state
  );
  
  if (decision.type === 'LAUNCH') {
    console.log('[System Brain] Decision: LAUNCH SystemSurface', {
      app: decision.app,
      wakeReason: decision.wakeReason,
    });
    await launchSystemSurface(decision.app, decision.wakeReason);
  } else {
    console.log('[System Brain] Decision: NONE - no launch needed');
  }
}

/**
 * Handle timer set (MECHANICAL event from native).
 * 
 * Native reports: "A timer was stored for app X with expiration Y and type Z"
 * System Brain uses explicit timer type to store in correct semantic state.
 * 
 * Invariant:
 * System Brain must be able to reconstruct all active timers
 * solely from persisted state at any event boundary.
 * 
 * @param packageName - App package name
 * @param expiresAt - Timer expiration timestamp
 * @param timestamp - Current timestamp
 * @param timerType - Explicit timer type (QUICK_TASK or INTENTION)
 * @param state - Semantic state
 */
async function handleTimerSet(
  packageName: string,
  expiresAt: number,
  timestamp: number,
  timerType: 'QUICK_TASK' | 'INTENTION',
  state: TimerState
): Promise<void> {
  const durationMs = expiresAt - timestamp;
  const durationSec = Math.round(durationMs / 1000);
  
  console.log('[System Brain] ========================================');
  console.log('[System Brain] 🔔 TIMER_SET event received');
  console.log('[System Brain] Timer type:', timerType);  // ✅ Log explicit type
  console.log('[System Brain] Timer set for:', packageName);
  console.log('[System Brain] Timer details:', {
    durationMs,
    durationSec,
    expiresAt,
    expiresAtTime: new Date(expiresAt).toISOString(),
  });
  
  // ✅ Explicit type classification (no duration inference)
  if (timerType === 'QUICK_TASK') {
    // Clear any expired Quick Task flag for this app
    // User explicitly requested Quick Task, so any previous expiration is irrelevant
    if (state.expiredQuickTasks[packageName]) {
      console.log('[System Brain] Clearing expired Quick Task flag — user explicitly requested Quick Task', {
        packageName,
        previousExpiredAt: state.expiredQuickTasks[packageName].expiredAt,
      });
      delete state.expiredQuickTasks[packageName];
    }
    
    // Store Quick Task timer and track usage
    state.quickTaskTimers[packageName] = { expiresAt };
    console.log('[System Brain] ✓ Quick Task timer stored');
    
    // Record usage (this consumes quota)
    recordQuickTaskUsage(packageName, timestamp, state);
    
    // ✅ Step 2: Verify persistence with detailed logging
    console.log('[System Brain] ✅ Quick Task timer persisted:', {
      packageName,
      expiresAt,
      expiresAtTime: new Date(expiresAt).toISOString(),
      durationSec,
      note: 'Timer will be available in state on next event',
    });
  } else if (timerType === 'INTENTION') {
    // Clear any expired Quick Task flag - user chose to set intention
    if (state.expiredQuickTasks[packageName]) {
      console.log('[System Brain] Clearing expired Quick Task flag — user set intention timer', {
        packageName,
      });
      delete state.expiredQuickTasks[packageName];
    }
    
    // Store per-app intention timer (NO usage tracking)
    state.intentionTimers[packageName] = { expiresAt };
    console.log('[System Brain] ✓ Intention timer stored (per-app suppressor)');
    console.log('[System Brain] ✅ Intention timer recorded in persisted state');
  }
  
  console.log('[System Brain] ========================================');
}

/**
 * Check if an app is infrastructure in the current context.
 * 
 * Infrastructure apps are transient overlays that don't represent
 * meaningful user navigation away from the current app.
 * 
 * IMPORTANT: BreakLoop is infrastructure ONLY during headless task processing.
 * When user opens Main App/Settings, it's a real foreground app.
 * 
 * Examples:
 * - com.android.systemui: Notification shade, quick settings, volume slider (always)
 * - android: Generic Android system package (always)
 * - com.anonymous.breakloopnative: Only during headless task processing
 * 
 * @param packageName - Package name to check
 * @param context - Processing context (optional)
 * @returns true if app is infrastructure in this context
 */
function isSystemInfrastructureApp(
  packageName: string | null,
  context?: { isHeadlessTaskProcessing?: boolean }
): boolean {
  if (!packageName) return true;
  
  // System UI overlays (always infrastructure)
  if (packageName === 'com.android.systemui') return true;
  if (packageName === 'android') return true;
  
  // BreakLoop is infrastructure ONLY during headless task processing
  // This prevents RN headless task side-effects from corrupting lastMeaningfulApp
  // When user opens Main App/Settings, this should return false
  if (
    packageName === 'com.anonymous.breakloopnative' &&
    context?.isHeadlessTaskProcessing === true
  ) {
    return true;
  }
  
  return false;
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
  
  // Update last meaningful app (skip system infrastructure)
  const previousApp = state.lastMeaningfulApp;
  
  if (!isSystemInfrastructureApp(packageName, { isHeadlessTaskProcessing: state.isHeadlessTaskProcessing })) {
    state.lastMeaningfulApp = packageName;
    console.log('[System Brain] Foreground app updated:', {
      previous: previousApp,
      current: packageName,
    });
    
    // Emit UNDERLYING_APP_CHANGED event to SystemSurface if app changed
    if (previousApp !== packageName) {
      console.log('[System Brain] Underlying app changed, emitting event:', {
        previous: previousApp,
        current: packageName,
      });
      
      DeviceEventEmitter.emit('UNDERLYING_APP_CHANGED', {
        packageName: packageName,
      });
    }
  } else {
    console.log('[System Brain] System infrastructure detected, lastMeaningfulApp unchanged:', {
      systemApp: packageName,
      lastMeaningfulApp: state.lastMeaningfulApp,
      context: state.isHeadlessTaskProcessing ? 'headless task processing' : 'system UI',
    });
  }
  
  // SEMANTIC INVALIDATION: Clear expired Quick Task flags for apps user is not currently in
  // An expiredQuickTask is only valid while the user remains in that same app.
  // When foreground app changes, invalidate expired flags for ALL other apps.
  for (const app in state.expiredQuickTasks) {
    if (
      state.expiredQuickTasks[app].expiredWhileForeground &&
      app !== packageName  // User is NOT in this app anymore
    ) {
      console.log(
        '[SystemBrain] Invalidating expiredQuickTask due to app leave',
        { expiredApp: app, currentApp: packageName }
      );
      delete state.expiredQuickTasks[app];
    }
  }
  
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
  
  // Duplicate launch guard REMOVED - isSystemSurfaceActive is the ONLY gate
  // The decision engine's lifecycle guard prevents multiple launches
  
  // NEW: Clean up stale intention timer for this app BEFORE evaluation
  // Prevents false-positive interventions from old timers
  const existingIntentionTimer = state.intentionTimers[packageName];
  if (existingIntentionTimer) {
    const expiredMs = timestamp - existingIntentionTimer.expiresAt;
    const STALE_THRESHOLD_MS = 60 * 1000; // 1 minute
    
    if (expiredMs > STALE_THRESHOLD_MS) {
      console.log('[System Brain] ⚠️ Cleaning up stale intention timer:', {
        packageName,
        expiredMinutesAgo: Math.floor(expiredMs / (60 * 1000)),
        note: 'Timer expired long ago, removing before evaluation',
      });
      delete state.intentionTimers[packageName];
    }
  }
  
  // NEW: Clear background-expired Quick Task flag BEFORE OS Trigger Brain
  // CRITICAL: This function ONLY clears background-expired flags, never launches intervention
  // Intervention enforcement happens ONLY in handleUserInteraction() to prevent duplicate launches
  const expired = state.expiredQuickTasks[packageName];
  if (expired && !expired.expiredWhileForeground) {
    // Quick Task expired in background → Clear flag and continue to OS Trigger Brain normally
    console.log('[System Brain] Quick Task expired in background - clearing flag, continuing to OS Trigger Brain');
    delete state.expiredQuickTasks[packageName];
  }
  // NOTE: If expired.expiredWhileForeground === true, the flag remains.
  // Intervention will be enforced on the next USER_INTERACTION_FOREGROUND event.
  // This prevents duplicate launches from FOREGROUND_CHANGED + USER_INTERACTION_FOREGROUND.
  
  // Log comprehensive timer information for monitored app (informational only)
  const quickTaskTimer = state.quickTaskTimers[packageName];
  const intentionTimer = state.intentionTimers[packageName];
  
  const tQuickTaskRemaining = quickTaskTimer && timestamp < quickTaskTimer.expiresAt
    ? `${Math.round((quickTaskTimer.expiresAt - timestamp) / 1000)} seconds`
    : 'none (not active)';
  
  const tIntentionRemaining = intentionTimer && timestamp < intentionTimer.expiresAt
    ? `${Math.round((intentionTimer.expiresAt - timestamp) / 1000)} seconds`
    : 'none (not active)';
  
  console.log('[System Brain] 📊 MONITORED APP OPENED - Timer Status:', {
    monitoredApp: packageName,
    t_quickTask_remaining: tQuickTaskRemaining,
    t_intention_remaining: tIntentionRemaining,
  });
  
  // No blocking state guard needed - session-based blocking is handled by SystemSurface
  
  // ============================================================================
  // Call Decision Engine (UI-safe boundary)
  // ============================================================================
  console.log('[System Brain] UI-safe boundary - calling decision engine');
  
  const decision = await decideSystemSurfaceAction(
    { type: 'FOREGROUND_CHANGED', packageName, timestamp },
    state
  );
  
  if (decision.type === 'LAUNCH') {
    console.log('[System Brain] Decision: LAUNCH SystemSurface', {
      app: decision.app,
      wakeReason: decision.wakeReason,
    });
    await launchSystemSurface(decision.app, decision.wakeReason);
  } else {
    console.log('[System Brain] Decision: NONE - no launch needed');
  }
}
