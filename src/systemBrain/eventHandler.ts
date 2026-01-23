/**
 * System Event Handler
 * 
 * Receives mechanical events from native and classifies their semantic meaning.
 * This is the ONLY place where semantic decisions are made.
 */

import { DeviceEventEmitter } from 'react-native';
import { isMonitoredApp } from '../os/osConfig';
import { launchSystemSurface } from './nativeBridge';
import { isSystemInitiatedForegroundChange, loadTimerState, saveTimerState, setInMemoryStateCache, TimerState } from './stateManager';

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
      await handleTimerSet(packageName, event.expiresAt!, timestamp, event.timerType!, state);
    } else if (type === 'USER_INTERACTION_FOREGROUND') {
      await handleUserInteraction(packageName, timestamp, state);
    }
  } finally {
    // Clear flag before saving (state should never persist with this flag true)
    state.isHeadlessTaskProcessing = false;

    // Save updated semantic state
    await saveTimerState(state);
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
  // SEMANTIC CLASSIFICATION: What kind of timer expired?
  const quickTaskTimer = state.quickTaskTimers[packageName];
  const intentionTimer = state.intentionTimers[packageName];

  let timerType: 'QUICK_TASK' | 'INTENTION' | 'UNKNOWN' = 'UNKNOWN';

  // Check intention timer first (higher priority in expiration handling)
  if (intentionTimer && timestamp >= intentionTimer.expiresAt) {
    timerType = 'INTENTION';
    // Remove per-app suppressor
    delete state.intentionTimers[packageName];
  } else if (quickTaskTimer && timestamp >= quickTaskTimer.expiresAt) {
    // QUICK TASK EXPIRATION: IGNORED IN JS (Native handles this)
    console.log('[QT][SB] Ignoring Quick Task expiration event - Native is authoritative');
    
    // Clean up our local state state anyway to keep it clean
    delete state.quickTaskTimers[packageName];
    timerType = 'UNKNOWN'; // Skip processing
  }

  if (timerType === 'UNKNOWN') {
    return;
  }

  // TIME-OF-TRUTH CAPTURE: Read foreground app at TIMER_EXPIRED time
  // This is the single source of truth - NEVER re-evaluate this later
  const foregroundAtExpiration = state.currentForegroundApp || state.lastMeaningfulApp;

  if (foregroundAtExpiration === packageName) {
    // User was on the app at expiration time

    if (timerType === 'QUICK_TASK') {
      // QUICK TASK EXPIRATION: IGNORED IN JS (Native handles this)
      console.log('[QT][SB] Ignoring Quick Task expiration event - Native is authoritative');
      return;
    }
    // INTENTION TIMER EXPIRATION: Mark expired, decision made at UI-safe boundary
    // ❌ DO NOT call launchSystemSurface() here
    // ❌ Timer expiration is NOT a safe UI lifecycle boundary
    // ✅ Timer already deleted earlier in this function
    // ✅ Decision will be made when user interaction occurs
  }
  // User switched to another app → silent cleanup only
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
  // Check if this app is monitored
  if (!isMonitoredApp(packageName)) {
    return;
  }

  // ============================================================================
  // PHASE 4.1: State tracking only - Native makes entry decisions
  // ============================================================================
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
  // ✅ Explicit type classification (no duration inference)
  if (timerType === 'QUICK_TASK') {
    // QUICK TASK TIMER: IGNORED IN JS (Native handles this)
    console.log('[QT][SB] Ignoring Quick Task timer set event - Native is authoritative');
  } else if (timerType === 'INTENTION') {
    // Clear any expired Quick Task flag - user chose to set intention
    if (state.expiredQuickTasks[packageName]) {
      delete state.expiredQuickTasks[packageName];
    }

    // Store per-app intention timer (NO usage tracking)
    state.intentionTimers[packageName] = { expiresAt };
  }
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

    // Emit UNDERLYING_APP_CHANGED event to SystemSurface if app changed
    if (previousApp !== packageName) {
      DeviceEventEmitter.emit('UNDERLYING_APP_CHANGED', {
        packageName: packageName,
      });
    }
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
      delete state.expiredQuickTasks[app];
    }
  }

  // 🔒 GUARD: only monitored apps are eligible for OS Trigger Brain evaluation
  const monitored = isMonitoredApp(packageName);

  if (!monitored) {
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
      delete state.intentionTimers[packageName];
    }
  }

  // NEW: Clear background-expired Quick Task flag BEFORE OS Trigger Brain
  // CRITICAL: This function ONLY clears background-expired flags, never launches intervention
  // Intervention enforcement happens ONLY in handleUserInteraction() to prevent duplicate launches
  const expired = state.expiredQuickTasks[packageName];
  if (expired && !expired.expiredWhileForeground) {
    // Quick Task expired in background → Clear flag and continue to OS Trigger Brain normally
    delete state.expiredQuickTasks[packageName];
  }
  // NOTE: If expired.expiredWhileForeground === true, the flag remains.
  // Intervention will be enforced on the next USER_INTERACTION_FOREGROUND event.
  // This prevents duplicate launches from FOREGROUND_CHANGED + USER_INTERACTION_FOREGROUND.

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
  const { command, app } = event;

  switch (command) {
    case 'START_QUICK_TASK_ACTIVE':
      // Native started ACTIVE phase - close SystemSurface, user continues using app
      // ACTIVE phase is native-only, silent enforcement
      // UI will only reappear on expiration (POST_QUICK_TASK_CHOICE)
      // SystemSurface will close via session end (no new session created)
      break;

    case 'SHOW_POST_QUICK_TASK_CHOICE':
      // Native says timer expired in foreground, show choice screen
      await launchSystemSurface(app, 'POST_QUICK_TASK_CHOICE');
      break;

    case 'FINISH_SYSTEM_SURFACE':
      // Native says close SystemSurface
      // Call native to finish the Activity (triggers onDestroy lifecycle)
      try {
        const { NativeModules, Platform } = require('react-native');
        if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
          NativeModules.AppMonitorModule.finishSystemSurfaceActivity();
        }
      } catch (e) {
        // Silent failure
      }
      break;

    case 'NO_QUICK_TASK_AVAILABLE':
      // Native says no Quick Task available, start Intervention
      await launchSystemSurface(app, 'START_INTERVENTION_FLOW');
      break;

    case 'SHOW_QUICK_TASK_DIALOG':
      // Native says show Quick Task dialog
      await launchSystemSurface(app, 'SHOW_QUICK_TASK_DIALOG');
      break;

    default:
      // Unknown command - silent failure
      break;
  }
}

/**
 * Handle quota updates from Native
 * PHASE 4.2: Native decrements, JS displays
 */
export async function handleQuotaUpdate(event: {
  quota: number;
  timestamp: number;
}): Promise<void> {
  // Quota is now native-authoritative (Phase 4.2)
  // JS no longer tracks quota for decision making
  try {
    const { NativeModules, Platform } = require('react-native');
    if (Platform.OS === 'android' && NativeModules.AppMonitorModule) {
       // Optional: Could update a local UI store here if needed
    }
  } catch (e) {
      // Silent failure
  }
}
