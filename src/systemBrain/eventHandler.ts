/**
 * System Event Handler
 * 
 * Receives mechanical events from native and classifies their semantic meaning.
 * This is the ONLY place where semantic decisions are made.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { loadTimerState, saveTimerState, TimerState, setInMemoryStateCache, setNextSessionOverride, getNextSessionOverride, isSystemInitiatedForegroundChange } from './stateManager';
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
    
    // ⚠️ CRITICAL: Valid expiration only if phase is ACTIVE
    // Phase check prevents handling stale timers from dialog phase
    const phase = state.quickTaskPhaseByApp[packageName];
    if (phase !== 'ACTIVE') {
      // Stale timer - ignore expiration
      console.warn('[QuickTask] Ignoring timer expiration - phase is not ACTIVE:', {
        app: packageName,
        currentPhase: phase,
        note: 'Timer expired but phase indicates dialog or no Quick Task active',
      });
      // Always delete timer (even if phase was wrong)
      delete state.quickTaskTimers[packageName];
      timerType = 'UNKNOWN'; // Mark as unknown so we skip further processing
    } else {
      // Valid expiration of active Quick Task usage (Phase B)
      // Timer exists AND phase is ACTIVE → legitimate expiration
      delete state.quickTaskTimers[packageName];
    }
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
  
  // TIME-OF-TRUTH CAPTURE: Read foreground app at TIMER_EXPIRED time
  // This is the single source of truth - NEVER re-evaluate this later
  const foregroundAtExpiration = state.currentForegroundApp || state.lastMeaningfulApp;
  
  console.log('[SystemBrain] TIMER_EXPIRED captured foreground', {
    packageName,
    foregroundAtExpiration,
    note: 'This is the time-of-truth - will NOT be re-evaluated',
  });
  
  console.log('[System Brain] Checking foreground app:', {
    expiredApp: packageName,
    foregroundAtExpiration,
    timerType,
    shouldTriggerIntervention: foregroundAtExpiration === packageName,
  });
  
  if (foregroundAtExpiration === packageName) {
    // User was on the app at expiration time
    
    if (timerType === 'QUICK_TASK') {
      // QUICK TASK EXPIRATION: Revoke permission, await user interaction
      console.log('[QuickTask] TIMER_EXPIRED for:', packageName);
      console.log('[QuickTask] Foreground app at expiration:', foregroundAtExpiration);
      
      // CRITICAL: Capture phase BEFORE clearing (needed for POST_QUICK_TASK_CHOICE guard)
      const phaseBeforeExpiration = state.quickTaskPhaseByApp[packageName];
      
      // Clear phase (transition ACTIVE → null)
      delete state.quickTaskPhaseByApp[packageName];
      console.log('[QuickTask] Phase cleared (ACTIVE → null)');
      
      // Capture immutable fact: user was in this app when timer expired
      const expiredWhileForeground = foregroundAtExpiration === packageName;
      
      if (expiredWhileForeground) {
        // CRITICAL: Only set POST_QUICK_TASK_CHOICE if Quick Task was ACTIVE
        // This prevents premature transitions on app entry or during DECISION phase
        if (phaseBeforeExpiration === 'ACTIVE') {
          // Set session override for UI to observe
          setNextSessionOverride(packageName, 'POST_QUICK_TASK_CHOICE');
          state.lastSemanticChangeTs = Date.now();
          
          console.log('[SystemBrain] Quick Task expired in foreground:', {
            app: packageName,
            phase: 'ACTIVE',
            foregroundAtExpiration,
            nextSessionOverride: 'POST_QUICK_TASK_CHOICE',
            lastSemanticChangeTs: state.lastSemanticChangeTs,
            note: 'SystemSurface will observe and dispatch REPLACE_SESSION',
          });
          
          // Persist immutable fact with captured foreground app
          state.expiredQuickTasks[packageName] = {
            expiredAt: timestamp,
            expiredWhileForeground: true,
            foregroundAppAtExpiration: foregroundAtExpiration,
          };
        } else {
          console.warn('[QuickTask] Ignoring POST_QUICK_TASK_CHOICE — not in ACTIVE phase', {
            phase: phaseBeforeExpiration,
            app: packageName,
            note: 'POST_QUICK_TASK_CHOICE requires phase = ACTIVE (user must have started Quick Task)',
          });
          
          // Still record expiration, but without POST_QUICK_TASK_CHOICE
          state.expiredQuickTasks[packageName] = {
            expiredAt: timestamp,
            expiredWhileForeground: true,
            foregroundAppAtExpiration: foregroundAtExpiration,
          };
        }
      } else {
        // Background expiration - just clear phase, no blocking
        state.expiredQuickTasks[packageName] = {
          expiredAt: timestamp,
          expiredWhileForeground: false,
          foregroundAppAtExpiration: foregroundAtExpiration,
        };
        
        console.log('[QuickTask] Permission revoked — waiting for user interaction', {
          expiredWhileForeground: false,
          foregroundAtExpiration,
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
      console.log('[QuickTask] Foreground app at expiration:', foregroundAtExpiration);
    } else {
      console.log('[System Brain] ✓ User switched apps - silent cleanup only (no intervention)');
      console.log('[System Brain] Foreground app at expiration:', foregroundAtExpiration);
    }
  }
  console.log('[System Brain] ========================================');
}

/**
 * Handle user interaction in foreground app (MECHANICAL event from native).
 * 
 * PHASE 4.1: State tracking only - NO entry decisions
 * 
 * Native emits this event for every user interaction (scroll, tap, content change).
 * Entry decisions are made by Native via QUICK_TASK_DECISION events.
 * 
 * This handler is kept for:
 * - State tracking
 * - Future non-entry-decision logic
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
  
  // ============================================================================
  // PHASE 4.1: State tracking only - Native makes entry decisions
  // ============================================================================
  console.log('[System Brain] USER_INTERACTION_FOREGROUND (state tracking only - Phase 4.1)');
  console.log('[System Brain] Entry decisions handled by Native via QUICK_TASK_DECISION events');
  
  // ❌ DO NOT call decideSystemSurfaceAction() - deprecated in Phase 4.1
  // ❌ DO NOT evaluate Quick Task availability
  // ❌ DO NOT launch SystemSurface from this handler
  // ✅ Native emits QUICK_TASK_DECISION events separately
  
  // Future: Add non-entry-decision logic here if needed
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
    
    // Store Quick Task timer (mechanical operation)
    state.quickTaskTimers[packageName] = { expiresAt };
    console.log('[System Brain] ✓ Quick Task timer stored');
    
    // ❌ REMOVED: recordQuickTaskUsage() - quota now decremented at DECISION→ACTIVE transition
    // Quota is consumed when user clicks "Quick Task" button (in transitionQuickTaskToActive),
    // not when timer is stored in native
    
    // ✅ Step 2: Verify persistence with detailed logging
    console.log('[System Brain] ✅ Quick Task timer persisted:', {
      packageName,
      expiresAt,
      expiresAtTime: new Date(expiresAt).toISOString(),
      durationSec,
      note: 'Timer will be available in state on next event. Quota already decremented at DECISION→ACTIVE.',
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
  
  // Check if this foreground change is system-initiated (within time window)
  // This allows multiple duplicate events to all see the marker
  const isSystemInitiated = isSystemInitiatedForegroundChange();
  
  // Check if current foreground app is infrastructure
  // Infrastructure apps (BreakLoop overlay, system UI) don't represent user navigation
  const isInfrastructureApp = isSystemInfrastructureApp(packageName, {
    isHeadlessTaskProcessing: state.isHeadlessTaskProcessing
  });
  
  // CRITICAL: Update currentForegroundApp FIRST (for time-of-truth capture)
  // This must happen BEFORE any other logic or decision evaluation
  const previousApp = state.lastMeaningfulApp;
  
  if (!isSystemInfrastructureApp(packageName, { isHeadlessTaskProcessing: state.isHeadlessTaskProcessing })) {
    // Update BOTH currentForegroundApp and lastMeaningfulApp
    state.currentForegroundApp = packageName;
    state.lastMeaningfulApp = packageName;
    
    console.log('[System Brain] Foreground app updated:', {
      previous: previousApp,
      current: packageName,
      note: 'currentForegroundApp captured for time-of-truth',
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
    console.log('[System Brain] System infrastructure detected, foreground tracking unchanged:', {
      systemApp: packageName,
      lastMeaningfulApp: state.lastMeaningfulApp,
      currentForegroundApp: state.currentForegroundApp,
      context: state.isHeadlessTaskProcessing ? 'headless task processing' : 'system UI',
    });
  }
  
  // SEMANTIC INVALIDATION: Clear expired Quick Task flags for apps user is not currently in
  // IMPORTANT: Preserve flags when:
  // 1. Foreground change is system-initiated (blocking screen backgrounding)
  // 2. Current foreground app is infrastructure (BreakLoop overlay, system UI)
  // An expiredQuickTask is only valid while the user remains in that same app,
  // UNLESS the foreground change was caused by the system or is to infrastructure.
  for (const app in state.expiredQuickTasks) {
    if (
      state.expiredQuickTasks[app].expiredWhileForeground &&
      app !== packageName &&  // User is NOT in this app anymore
      !isSystemInitiated &&  // Don't invalidate if system backgrounded the app
      !isInfrastructureApp  // Don't invalidate if foreground is infrastructure
    ) {
      console.log(
        '[SystemBrain] Invalidating expiredQuickTask (user left for real app)',
        { expiredApp: app, currentApp: packageName }
      );
      delete state.expiredQuickTasks[app];
    } else if (isSystemInitiated) {
      console.log(
        '[SystemBrain] Preserving expiredQuickTask (system-initiated foreground change)',
        { expiredApp: app, currentApp: packageName }
      );
    } else if (isInfrastructureApp) {
      console.log(
        '[SystemBrain] Preserving expiredQuickTask (BreakLoop infrastructure)',
        { expiredApp: app, currentApp: packageName }
      );
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
  // PHASE 4.1: FOREGROUND_CHANGED no longer triggers Quick Task entry decisions
  // ============================================================================
  // Native now emits separate QUICK_TASK_DECISION events for monitored apps
  // This handler is kept for:
  // - State tracking (currentForegroundApp, lastMeaningfulApp)
  // - Non-Quick-Task logic (if any)
  // 
  // DEPRECATED: Decision engine call for monitored apps
  // Native makes entry decisions, JS reacts to QUICK_TASK_DECISION events
  
  console.log('[System Brain] FOREGROUND_CHANGED (mechanical event only - Phase 4.1)');
  console.log('[System Brain] Entry decisions now handled by Native via QUICK_TASK_DECISION events');
  console.log('[System Brain] This event is for state tracking only');
  
  // ❌ DO NOT call decideSystemSurfaceAction() for monitored apps
  // ❌ DO NOT launch SystemSurface from this handler
  // ✅ Native emits QUICK_TASK_DECISION events separately
}

/**
 * Handle Quick Task decision from Native (COMMAND HANDLER)
 * 
 * PHASE 4.1: Entry decision authority
 * 
 * INVARIANT: Native's decision is FINAL and UNCONDITIONAL.
 * JS must NOT re-evaluate, suppress, or override this decision.
 * 
 * Native has already checked:
 * - Timer existence
 * - Quota availability
 * - SystemSurface lifecycle
 * 
 * JS only checks t_intention for NO_QUICK_TASK_AVAILABLE case.
 * 
 * @param event - Quick Task decision event from Native
 */
export async function handleQuickTaskDecision(event: {
  packageName: string;
  decision: 'SHOW_QUICK_TASK_DIALOG' | 'NO_QUICK_TASK_AVAILABLE';
  timestamp: number;
}): Promise<void> {
  const { packageName, decision, timestamp } = event;
  
  console.log('[System Brain] ========================================');
  console.log('[System Brain] QUICK TASK DECISION (COMMAND FROM NATIVE)');
  console.log('[System Brain] App:', packageName);
  console.log('[System Brain] Decision:', decision);
  console.log('[System Brain] Timestamp:', new Date(timestamp).toISOString());
  console.log('[System Brain] ========================================');
  
  // Load state
  const state = await loadTimerState();
  setInMemoryStateCache(state);
  
  if (decision === 'SHOW_QUICK_TASK_DIALOG') {
    // ✅ UNCONDITIONAL: Native authorized Quick Task dialog
    console.log('[System Brain] ✅ EXECUTING NATIVE COMMAND: Show Quick Task dialog');
    console.log('[System Brain] NO re-evaluation, NO suppression, NO fallback');
    
    // Set phase = DECISION
    state.quickTaskPhaseByApp[packageName] = 'DECISION';
    await saveTimerState(state);
    
    // Notify Native that SystemSurface is launching
    try {
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
        await NativeModules.AppMonitorModule.setSystemSurfaceActive(true);
      }
    } catch (e) {
      console.warn('[System Brain] Failed to notify Native of SystemSurface launch:', e);
    }
    
    // Launch SystemSurface with Quick Task dialog (UNCONDITIONAL)
    await launchSystemSurface(packageName, 'SHOW_QUICK_TASK_DIALOG');
    
  } else if (decision === 'NO_QUICK_TASK_AVAILABLE') {
    // Native says Quick Task not available
    // ONLY check t_intention (minimal suppression check)
    console.log('[System Brain] Native declined Quick Task');
    console.log('[System Brain] Checking t_intention suppression...');
    
    const intentionTimer = state.intentionTimers[packageName];
    if (intentionTimer && timestamp < intentionTimer.expiresAt) {
      const remainingSec = Math.round((intentionTimer.expiresAt - timestamp) / 1000);
      console.log('[System Brain] ✓ t_intention active - suppressing ALL UI');
      console.log('[System Brain] Remaining:', remainingSec, 'seconds');
      return; // Suppress everything
    }
    
    // No t_intention - start Intervention immediately
    console.log('[System Brain] ✓ No t_intention - starting Intervention');
    
    // Notify Native that SystemSurface is launching
    try {
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
        await NativeModules.AppMonitorModule.setSystemSurfaceActive(true);
      }
    } catch (e) {
      console.warn('[System Brain] Failed to notify Native of SystemSurface launch:', e);
    }
    
    await launchSystemSurface(packageName, 'START_INTERVENTION_FLOW');
  }
  
  console.log('[System Brain] ========================================');
}

/**
 * Handle Quick Task commands from Native
 * PHASE 4.2: JS obeys Native commands, never decides
 * 
 * Native owns the Quick Task state machine and emits commands.
 * JS is a passive UI renderer that executes commands.
 */
export async function handleQuickTaskCommand(event: {
  command: string;
  app: string;
  timestamp: number;
}): Promise<void> {
  const { command, app, timestamp } = event;
  
  console.log('[System Brain] ========================================');
  console.log('[System Brain] 📨 QUICK_TASK_COMMAND received');
  console.log('[System Brain] Command:', command);
  console.log('[System Brain] App:', app);
  console.log('[System Brain] Timestamp:', new Date(timestamp).toISOString());

  switch (command) {
    case 'START_QUICK_TASK_ACTIVE':
      // Native started ACTIVE phase - close SystemSurface, user continues using app
      // ACTIVE phase is native-only, silent enforcement
      // UI will only reappear on expiration (POST_QUICK_TASK_CHOICE)
      console.log('[System Brain] ✅ EXECUTING: Start Quick Task ACTIVE phase (silent)');
      console.log('[System Brain] Native timer started, closing SystemSurface');
      console.log('[System Brain] User continues using app, Native enforces timer');
      // SystemSurface will close via session end (no new session created)
      break;

    case 'SHOW_POST_QUICK_TASK_CHOICE':
      // Native says timer expired in foreground, show choice screen
      console.log('[System Brain] ✅ EXECUTING: Show POST_QUICK_TASK_CHOICE screen');
      await launchSystemSurface(app, 'POST_QUICK_TASK_CHOICE');
      break;

    case 'FINISH_SYSTEM_SURFACE':
      // Native says close SystemSurface
      console.log('[System Brain] ✅ EXECUTING: Finish SystemSurface');
      // SystemSurface will finish via session end
      break;

    case 'NO_QUICK_TASK_AVAILABLE':
      // Native says no Quick Task available, start Intervention
      console.log('[System Brain] ✅ EXECUTING: Start Intervention (no Quick Task)');
      await launchSystemSurface(app, 'START_INTERVENTION_FLOW');
      break;

    case 'SHOW_QUICK_TASK_DIALOG':
      // Native says show Quick Task dialog
      console.log('[System Brain] ✅ EXECUTING: Show Quick Task dialog');
      await launchSystemSurface(app, 'SHOW_QUICK_TASK_DIALOG');
      break;

    default:
      console.warn('[System Brain] ⚠️ Unknown Quick Task command:', command);
  }
  
  console.log('[System Brain] ========================================');
}

/**
 * Handle quota updates from Native
 * PHASE 4.2: Native decrements, JS displays
 */
export async function handleQuotaUpdate(event: {
  quota: number;
  timestamp: number;
}): Promise<void> {
  console.log('[System Brain] ========================================');
  console.log('[System Brain] 📊 QUOTA_UPDATE received from Native');
  console.log('[System Brain] New quota:', event.quota);
  
  // Update local state for display only
  const state = await loadTimerState();
  state.n_quickTask = event.quota;
  await saveTimerState(state);
  
  console.log('[System Brain] ✅ Quota updated in JS state (display only)');
  console.log('[System Brain] ========================================');
}
