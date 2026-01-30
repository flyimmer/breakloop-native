/**
 * SystemSurfaceRoot - Session-driven root for SystemSurfaceActivity
 * 
 * This component is the ONLY root rendered in SystemSurfaceActivity.
 * It renders different flows based on session.kind.
 * 
 * Key Rules (see ARCHITECTURE_v1_frozen.md):
 * - Rule 1: Alternative Activity visibility is conditional on foregroundApp
 * - Rule 3: Flows don't navigate to each other (session.kind controls rendering)
 * - Rule 4: Session is the ONLY authority for SystemSurface existence
 * 
 * CRITICAL INVARIANTS:
 * - NO tabs, NO settings, NO main app UI
 * - NO navigation-based branching
 * - session.kind is the ONLY selector
 * - When session === null, activity MUST finish immediately
 */

import { useIntervention } from '@/src/contexts/InterventionProvider';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { clearNextSessionOverride, getNextSessionOverride, getSystemSurfaceDecision, setSystemSurfaceActive } from '@/src/systemBrain/stateManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import AlternativeActivityFlow from '../flows/AlternativeActivityFlow';
import InterventionFlow from '../flows/InterventionFlow';
import QuickTaskFlow from '../flows/QuickTaskFlow';
import PostQuickTaskChoiceScreen from '../screens/conscious_process/PostQuickTaskChoiceScreen';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Check if a package name represents a non-behavioral foreground transition
 * 
 * SEMANTIC INTENT:
 * These packages do NOT represent user intent to leave the intervention.
 * They are system overlays, infrastructure, or transient UI layers that
 * temporarily gain foreground focus without the user "switching apps".
 * 
 * EXAMPLES OF NON-BEHAVIORAL TRANSITIONS:
 * - Notification shade pulled down (com.android.systemui)
 * - Quick settings opened (com.android.systemui)
 * - Incoming/outgoing phone calls (com.google.android.dialer, com.android.incallui)
 * - Permission dialogs (com.android.permissioncontroller)
 * - System navigation gestures (android)
 * - BreakLoop's own infrastructure (com.anonymous.breakloopnative)
 * 
 * This list is intentionally open-ended and semantic.
 * Future additions may include OEM variants (Samsung, Xiaomi, etc.)
 * or accessibility overlays that don't represent user intent.
 * 
 * @param packageName - The package name to check
 * @returns true if this is a non-behavioral transition (should NOT end session)
 */
function isBreakLoopInfrastructure(packageName: string | null): boolean {
  if (!packageName) return true; // null = not yet initialized

  // BreakLoop's own app package
  if (packageName === 'com.anonymous.breakloopnative') return true;

  // Android system navigation/gesture package
  // This appears briefly during React Navigation swipe gestures
  if (packageName === 'android') return true;

  // Android system UI / non-behavioral foreground layers
  // These do NOT represent user intent to leave the intervention
  // - Notification shade pulled down
  // - Quick settings opened
  // - Status bar interactions
  if (packageName === 'com.android.systemui') return true;

  // Phone call UI / non-behavioral interruptions
  // These do NOT represent user intent to leave the intervention
  // - Incoming phone calls
  // - Outgoing phone calls
  // - In-call UI
  // User expects to return to intervention after call ends
  if (packageName === 'com.google.android.dialer') return true;  // Google Dialer (Pixel, Android One)
  if (packageName === 'com.android.incallui') return true;       // AOSP In-Call UI
  if (packageName === 'com.android.dialer') return true;         // AOSP Dialer
  if (packageName === 'com.android.phone') return true;          // Android Phone app
  if (packageName === 'com.samsung.android.incallui') return true; // Samsung In-Call UI
  if (packageName === 'com.samsung.android.dialer') return true;   // Samsung Dialer

  return false;
}

/**
 * Check if package is a launcher/home screen app.
 */
function isLauncherApp(packageName: string | null): boolean {
  if (!packageName) return false;

  return (
    packageName.includes('launcher') ||
    packageName === 'com.android.launcher' ||
    packageName === 'com.hihonor.android.launcher' ||
    packageName.includes('.launcher.')
  );
}

/**
 * Finish SystemSurfaceActivity only (Android resumes previous app naturally)
 * 
 * Use this when:
 * - User sets intention timer (wants to use the monitored app)
 * - User starts alternative activity
 * - Quick Task activated (user returns to monitored app)
 * 
 * The monitored app or previous activity will naturally come to foreground via Android task stack.
 * NO explicit app launch needed.
 */
function finishSurfaceOnly() {
  if (Platform.OS === 'android' && AppMonitorModule) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Finishing SystemSurface only (Android resumes previous app)');
    }
    AppMonitorModule.finishSystemSurfaceActivity();
  }
}

/**
 * Finish SystemSurfaceActivity AND launch home screen
 * 
 * Use this when:
 * - User cancels intervention (back button, switches away)
 * - User completes full intervention with reflection
 * - Intervention explicitly decided to exit to home
 */
function finishAndLaunchHome() {
  if (Platform.OS === 'android' && AppMonitorModule) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Finishing SystemSurface and launching home screen');
    }
    AppMonitorModule.cancelInterventionActivity();
  }
}

/**
 * SystemSurfaceRoot Component
 * 
 * Renders system flows based on session.kind.
 * This is the root component for SystemSurfaceActivity.
 * 
 * BOOTSTRAP PHASE:
 * - While bootstrapState === 'BOOTSTRAPPING': Render nothing, wait for JS to decide
 * - Only when bootstrapState === 'READY': Enforce session lifecycle rules
 * 
 * Rendering Logic (after bootstrap):
 * - session === null → Finish activity immediately (Rule 4)
 * - session.kind === 'INTERVENTION' → Render InterventionFlow
 * - session.kind === 'QUICK_TASK' → Render QuickTaskFlow
 * - session.kind === 'ALTERNATIVE_ACTIVITY' → Render AlternativeActivityFlow (with visibility check)
 */
export default function SystemSurfaceRoot() {
  const { session, bootstrapState, foregroundApp, shouldLaunchHome, lastSemanticChangeTs, dispatchSystemEvent, safeEndSession, getTransientTargetApp, setTransientTargetApp } = useSystemSession();
  const { dispatchIntervention } = useIntervention();

  // Track underlying app (the app user is conceptually interacting with)
  const [underlyingApp, setUnderlyingApp] = useState<string | null>(null);

  // Track wake reason for special routing cases (POST_QUICK_TASK_CHOICE)
  const [wakeReason, setWakeReason] = useState<string | null>(null);

  // Track SystemSurface decision (in-memory only, reactive)
  const [systemSurfaceDecision, setSystemSurfaceDecisionState] = useState<'PENDING' | 'SHOW_SESSION' | 'FINISH'>('PENDING');

  // Read wake reason on mount (bootstrap phase) - MUST be before any early returns
  useEffect(() => {
    const readWakeReason = async () => {
      if (AppMonitorModule) {
        const extras = await AppMonitorModule.getSystemSurfaceIntentExtras();
        if (extras?.wakeReason) {
          setWakeReason(extras.wakeReason);
          if (__DEV__) {
            console.log('[SystemSurfaceRoot] Wake reason loaded:', extras.wakeReason);
          }
        }
      }
    };
    readWakeReason();
  }, []);

  /**
   * Track previous session kind to detect REPLACE_SESSION transitions
   * 
   * CRITICAL: This must be updated synchronously during render, NOT in useEffect.
   * The "user left app" check needs to read the previous value before it's updated.
   * 
   * REPLACE_SESSION (QUICK_TASK → INTERVENTION) is an internal state transition,
   * NOT user navigation. During this transition, foregroundApp may be stale
   * (showing launcher or previous app), which would falsely trigger "user left app".
   * 
   * Pattern: Store current value, then update ref at end of this block.
   * This ensures the "user left app" check sees the OLD value during this render.
   */
  const prevSessionKindRef = useRef<'INTERVENTION' | 'QUICK_TASK' | 'ALTERNATIVE_ACTIVITY' | 'POST_QUICK_TASK_CHOICE' | null>(null);
  const currentSessionKind = session?.kind ?? null;

  // Detect if this is a REPLACE_SESSION transition (QUICK_TASK → INTERVENTION)
  // This flag is computed with the PREVIOUS session kind (before ref update)
  const isReplaceSessionTransition =
    prevSessionKindRef.current === 'QUICK_TASK' &&
    currentSessionKind === 'INTERVENTION';

  // Update ref for next render (happens synchronously during this render)
  // This ensures the "user left app" check below sees the OLD value
  prevSessionKindRef.current = currentSessionKind;

  /**
   * BOOTSTRAP INITIALIZATION (Cold Start)
   * 
   * Phase 2 Bootstrap (System Brain pre-decided):
   * 1. Read wakeReason + triggeringApp from Intent extras
   * 2. Map wake reason → START_QUICK_TASK or START_INTERVENTION
   * 3. Dispatch exactly one session
   * 4. bootstrapState automatically transitions to READY via reducer
   * 
   * CRITICAL LIFECYCLE ASSUMPTION:
   * SystemSurfaceRoot bootstrap runs exactly once per Activity instance.
   * 
   * Architectural assumption:
   * - SystemSurfaceActivity is disposable and never reused.
   * - Each launch is a cold start with fresh intent extras.
   * - We do NOT support intent re-delivery or Activity reuse.
   * 
   * If this assumption changes in the future, bootstrap logic must be revisited.
   * 
   * This effect runs ONCE on mount (empty dependency array []).
   * This is safe because SystemSurfaceActivity is DISPOSABLE:
   * - Each launch creates a fresh Activity instance
   * - Activity finishes when session ends (never reused)
   * - Intent extras are read once and never change during Activity lifetime
   * - No intent re-delivery handling needed (Activity is single-use)
   * 
   * NO OS Trigger Brain evaluation in SystemSurface.
   * System Brain already made the decision - we just consume it.
   */


  // ... (inside component)

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  /**
   * Handle wake reason from intent extras
   * Shared logic for mount (cold start) and resume (warm start)
   */
  const handleWakeReason = async () => {
    try {
      // Read Intent extras from native
      if (!AppMonitorModule) {
        console.error('[SystemSurfaceRoot] ❌ AppMonitorModule not available');
        setSystemSurfaceActive(false);
        safeEndSession(true);
        return;
      }

      const extras = await AppMonitorModule.getSystemSurfaceIntentExtras();

      if (!extras || !extras.triggeringApp) {
        // If we are resumed via Recent Apps (no intent extras?), we might just want to show existing session?
        // But getSystemSurfaceIntentExtras usually returns current intent.
        // If it's valid, proceed.
        if (session) {
          // We have active session, keep it.
          return;
        }
        console.error('[SystemSurfaceRoot] ❌ No Intent extras - finishing activity', { extras });
        setSystemSurfaceActive(false);
        safeEndSession(true);
        return;
      }

      const { triggeringApp, wakeReason } = extras;
      setWakeReason(wakeReason);

      // ✅ CRITICAL: Check for session mismatch
      if (session && session.app !== triggeringApp) {
        console.warn('[SystemSurfaceRoot] Session mismatch, replacing session', {
          oldApp: session.app,
          newApp: triggeringApp,
          wakeReason,
        });

        dispatchSystemEvent({
          type: 'REPLACE_SESSION',
          newKind: wakeReason === 'SHOW_QUICK_TASK_DIALOG' ? 'QUICK_TASK' : 'INTERVENTION',
          app: triggeringApp,
        });
        return;
      }

      // Dispatch session based on wake reason
      if (wakeReason === 'SHOW_QUICK_TASK_DIALOG') {
        // ... (Quick task logic)
        dispatchSystemEvent({
          type: 'START_QUICK_TASK',
          app: triggeringApp,
        });
      } else if (wakeReason === 'START_INTERVENTION_FLOW') {
        dispatchSystemEvent({
          type: 'START_INTERVENTION',
          app: triggeringApp,
        });
      } else if (wakeReason === 'POST_QUICK_TASK_CHOICE') {
        dispatchSystemEvent({
          type: 'START_POST_QUICK_TASK_CHOICE',
          app: triggeringApp,
        });
      } else if (wakeReason === 'INTENTION_EXPIRED_FOREGROUND') {
        dispatchSystemEvent({
          type: 'START_INTERVENTION',
          app: triggeringApp,
        });
      } else if (wakeReason === 'RESUME_PRESERVED_STATE' || extras.resumeMode === 'RESUME') {
        // V3: Resume Logic
        const snapshotJson = await AsyncStorage.getItem(`intervention_snapshot_${triggeringApp}`);
        let resumed = false;

        if (snapshotJson) {
          try {
            const snapshot = JSON.parse(snapshotJson);
            // Validation: Must be action_timer and matches app
            if (snapshot.state === 'action_timer' && snapshot.targetApp === triggeringApp) {
              const elapsed = (Date.now() - snapshot.startedAt) / 1000;
              const remaining = snapshot.duration - elapsed;

              if (remaining > 5) { // Min 5 seconds to resume
                console.log('[SystemSurfaceRoot] RESUMING intervention', { remaining, original: snapshot.duration });

                // 1. Restore Intervention State (Timer value)
                // Note: We need access to dispatchIntervention. 
                // Since we are inside InterventionProvider (App.tsx), we can use the hook.
                // But we can't use the hook inside this async function if it's not captured.
                // We need to capture dispatchIntervention from component scope.
                // See component change below.

                // Dispatch Intervention State Restore
                dispatchIntervention({
                  type: 'RESUME_INTERVENTION',
                  actionTimer: remaining,
                  targetApp: triggeringApp
                });

                // Dispatch System Session change (UI Switch)
                dispatchSystemEvent({
                  type: 'START_ALTERNATIVE_ACTIVITY',
                  app: triggeringApp,
                  shouldLaunchHome: false
                });
                resumed = true;

                // Dispatch Intervention State Restore MUST happen. 
                // We will emit an event or rely on `InterventionFlow` not being mounted?
                // Actually, if we switch to ALTERNATIVE_ACTIVITY, InterventionFlow is NOT mounted.
                // AlternativeActivityFlow IS mounted.
                // AlternativeActivityFlow needs the correct timer value.
                // InterventionProvider holds the value.
                // We need to update InterventionProvider state.
              }
            }
          } catch (e) {
            console.error('[SystemSurfaceRoot] Invalid snapshot', e);
          }
        }

        if (!resumed) {
          console.log('[SystemSurfaceRoot] Resume failed/invalid - falling back to FRESH START');
          // Clear any stale snapshot
          await AsyncStorage.removeItem(`intervention_snapshot_${triggeringApp}`);

          dispatchSystemEvent({
            type: 'START_INTERVENTION',
            app: triggeringApp,
          });
        }
      } else if (wakeReason === 'MONITORED_APP_FOREGROUND') {
        // ... (Compatibility)
        dispatchSystemEvent({
          type: 'START_QUICK_TASK',
          app: triggeringApp,
        });
      } else {
        // Fallback
        dispatchSystemEvent({
          type: 'START_INTERVENTION',
          app: triggeringApp,
        });
      }
    } catch (error) {
      console.error('[SystemSurfaceRoot] ❌ Bootstrap initialization failed:', error);
      setSystemSurfaceActive(false);
      safeEndSession(true);
    }
  };

  // Re-entrancy guard for intent handling
  const lastProcessedNonce = useRef<number>(0);

  /**
   * Apply a new System Surface Intent (Context Switch)
   * 
   * Handles:
   * 1. App Switch (Cross-App): Forces RESET and new session.
   * 2. Same App (Re-entry): Respects resumeMode (RESET vs RESUME).
   * 
   * Updates session, bootstrap state, and intervention state.
   */
  const applyNewSurfaceIntent = async (eventNonce: number, hintApp?: string) => {
    // 1. Re-entrancy Guard
    if (eventNonce <= lastProcessedNonce.current) {
      console.log('[SystemSurfaceRoot] 🛡️ Ignoring stale/duplicate intent', { eventNonce, last: lastProcessedNonce.current });
      return;
    }
    lastProcessedNonce.current = eventNonce;

    console.log('[SystemSurfaceRoot] ⚡ Processing new surface intent', { eventNonce, hintApp });
    console.log('[SystemSurfaceRoot] [SS_INTENT] event received nonce=', eventNonce);

    // 2. Pull Authoritative Extras

    const extras = await AppMonitorModule?.getSystemSurfaceIntentExtras();
    if (!extras || !extras.triggeringApp) {
      console.warn('[SystemSurfaceRoot] ❌ applyNewSurfaceIntent: No valid extras found via pull');
      return;
    }

    const { triggeringApp, wakeReason } = extras;
    const resumeMode = (extras as any).resumeMode;

    console.log(`[SystemSurfaceRoot] [PULL_EXTRAS] app=${triggeringApp} reason=${wakeReason} mode=${resumeMode}`);
    console.log(`[SystemSurfaceRoot] [SS_INTENT] extras pulled: triggeringApp=${triggeringApp}, resumeMode=${resumeMode}`);


    // 3. Cross-App Check
    if (session && session.app !== triggeringApp) {
      console.log(`[SystemSurfaceRoot] [ACTION=RESET] reason=appChanged from=${session.app} to=${triggeringApp}`);
      console.log('[SystemSurfaceRoot] [SS_INTENT] action=RESET reason=appChanged');

      // Force cleanup of old session
      dispatchIntervention({ type: 'RESET_INTERVENTION' });
    }
    // 4. Same-App Resume Mode Check
    else if (session && session.app === triggeringApp) {
      if (resumeMode === 'RESET') {
        console.log('[SystemSurfaceRoot] [ACTION=RESET] reason=sameApp_forceReset');
        console.log('[SystemSurfaceRoot] [SS_INTENT] action=RESET reason=sameApp_forceReset');
        dispatchIntervention({ type: 'RESET_INTERVENTION' });
      } else {
        console.log('[SystemSurfaceRoot] [ACTION=RESUME] reason=sameApp');
        console.log('[SystemSurfaceRoot] [SS_INTENT] action=RESUME reason=sameApp');
      }
    }

    // 5. Execute Bootstrap/Resume Logic (Re-use handleWakeReason but purely for this new context)
    // We already pulled extras, but handleWakeReason pulls them again. 
    // Optimization: We can just let handleWakeReason do its job now that we've cleared blocking state.
    await handleWakeReason();
  };

  // Mount effect
  useEffect(() => {
    // Bootstrap (Cold Start)
    handleWakeReason();

    // Resume listener (AppState)
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[SystemSurfaceRoot] AppState -> active, checking wake reason');
        handleWakeReason();
      }
      setAppState(nextAppState);
    });

    // New Intent listener (Hot Switch / Re-use)
    console.log('[SystemSurfaceRoot] [SS_INTENT] listener registered');
    const intentSubscription = DeviceEventEmitter.addListener('onSystemSurfaceNewIntent', (event) => {
      const nonce = event?.intentNonce ?? Date.now();
      const hintApp = event?.triggeringAppHint;
      applyNewSurfaceIntent(nonce, hintApp);
    });

    return () => {
      appStateSubscription.remove();
      intentSubscription.remove();
    };
  }, []);

  /**
   * Update SystemSurface decision reactively when session or bootstrap state changes.
   * 
   * CRITICAL: Do NOT poll with setInterval.
   * Decision only changes around session creation/termination, so React re-renders naturally.
   * 
   * REACTIVE: Updates when System Brain changes state (session/bootstrap transitions).
   * NO POLLING. NO TIMERS.
   */
  useEffect(() => {
    const decision = getSystemSurfaceDecision();
    setSystemSurfaceDecisionState(decision);

    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Decision updated:', decision);
    }
  }, [session, bootstrapState]);

  /**
   * Subscribe to underlying app changes from System Brain
   * 
   * System Brain tracks lastMeaningfulApp and emits events when it changes.
   * This is the SOURCE OF TRUTH for detecting when the user switches apps
   * during a SystemSurface overlay.
   * 
   * EVENT-DRIVEN: Pure event subscription, NO POLLING, NO TIMERS.
   */
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'UNDERLYING_APP_CHANGED',
      (event: { packageName: string }) => {
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] Underlying app changed:', event.packageName);
        }
        setUnderlyingApp(event.packageName);
      }
    );

    return () => subscription.remove();
  }, []);

  /**
   * Initialize underlying app from session on bootstrap
   * 
   * CRITICAL: Event-driven state must be initialized before it can be reacted to.
   * 
   * On first launch, no UNDERLYING_APP_CHANGED event may be emitted because
   * lastMeaningfulApp might not change (e.g., staying as launcher).
   * We must initialize underlyingApp immediately from session.app.
   * 
   * This runs once per SystemSurface instance, before any teardown checks.
   */
  useEffect(() => {
    if (!session) return;

    // Initialize underlying app immediately on first render
    if (!underlyingApp && session.app) {
      setUnderlyingApp(session.app);
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] underlyingApp initialized from session', {
          underlyingApp: session.app,
        });
      }
    }
  }, [session, underlyingApp]);

  /**
   * Observe nextSessionOverride on natural re-renders (event-driven pull model)
   * 
   * System Brain updates in-memory state when Quick Task expires.
   * SystemSurface observes this state on natural React re-renders and reacts.
   * 
   * Triggers:
   * - session changes (user actions, session replacements)
   * - bootstrapState changes (bootstrap completion)
   * - foregroundApp changes (FOREGROUND_CHANGED events from System Brain)
   * 
   * Guards:
   * 1. Only process when session is active and bootstrap is ready
   * 2. Clear stale overrides that don't match current app
   * 3. Skip if session is ending (session === null)
   * 
   * NO POLLING, NO TIMERS, NO EMITTERS - Pure React reactivity.
   */
  useEffect(() => {
    // Guard: Only check if we have an active session
    if (!session || bootstrapState !== 'READY') return;

    // Read in-memory state (no AsyncStorage, no polling, no emitters)
    const override = getNextSessionOverride();
    if (!override) return;

    // Only allow transition FROM QUICK_TASK → POST_QUICK_TASK_CHOICE
    if (
      override.app === session.app &&
      session.kind === 'QUICK_TASK' &&
      override.kind === 'POST_QUICK_TASK_CHOICE'
    ) {
      console.log('[SystemSurfaceRoot] Detected nextSessionOverride - transitioning QUICK_TASK → POST_QUICK_TASK_CHOICE');

      dispatchSystemEvent({
        type: 'REPLACE_SESSION',
        newKind: 'POST_QUICK_TASK_CHOICE',
        app: override.app,
      });

      clearNextSessionOverride();
      return;
    }

    // Defensive cleanup: override no longer matches active session
    if (override.app !== session.app || session.kind !== 'QUICK_TASK') {
      console.log('[SystemSurfaceRoot] Clearing stale nextSessionOverride', {
        overrideApp: override.app,
        sessionApp: session.app,
        sessionKind: session.kind,
        reason: override.app !== session.app ? 'app mismatch' : 'session not QUICK_TASK',
      });
      clearNextSessionOverride();
    }
  }, [
    session,
    bootstrapState,
    foregroundApp,  // Triggers on FOREGROUND_CHANGED (existing state)
    lastSemanticChangeTs,  // Triggers when System Brain updates semantic state
    dispatchSystemEvent,  // Required for ESLint exhaustive-deps
  ]);

  /**
   * EXPLICIT DECISION: Only finish when System Brain explicitly says FINISH
   * 
   * CRITICAL: Do NOT finish based on session === null.
   * After Quick Task phase refactor, session === null can mean:
   * 1. "No session needed" (correct time to finish)
   * 2. "Still bootstrapping" (must NOT finish)
   * 3. "Phase logic says wait" (must NOT finish)
   * 
   * System Brain explicitly sets decision to FINISH when no session is needed.
   * 
   * IMPORTANT: This useEffect must be called BEFORE any early returns
   * to comply with React's Rules of Hooks.
   */
  useEffect(() => {
    if (
      bootstrapState === 'READY' &&
      systemSurfaceDecision === 'FINISH'
    ) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] System Brain decision: FINISH - triggering activity finish', {
          shouldLaunchHome,
        });
      }

      // Use explicit finish functions based on shouldLaunchHome flag
      if (shouldLaunchHome) {
        finishAndLaunchHome();
      } else {
        finishSurfaceOnly();
      }
    }
  }, [systemSurfaceDecision, bootstrapState, shouldLaunchHome]);

  /**
   * CRITICAL: Update decision to FINISH when session ends
   * 
   * When END_SESSION is dispatched, session becomes null but systemSurfaceDecision
   * is not automatically updated. This useEffect detects session === null and
   * updates the decision to FINISH, which triggers the finish useEffect above.
   * 
   * This is the missing link that was causing SystemSurface to stay open after
   * Quick Task, leaving Instagram frozen underneath.
   */
  useEffect(() => {
    if (
      bootstrapState === 'READY' &&
      session === null &&
      systemSurfaceDecision !== 'FINISH'
    ) {
      console.log('[SystemSurfaceRoot] Session ended, updating decision to FINISH');
      setSystemSurfaceDecisionState('FINISH');
    }
  }, [session, bootstrapState, systemSurfaceDecision]);


  /**
   * CRITICAL: End QUICK_TASK / POST_QUICK_TASK_CHOICE Session when underlying app changes
   * 
   * QUICK_TASK and POST_QUICK_TASK_CHOICE are modal overlays. When the user switches to a different app,
   * the session must end even though SystemSurface remains the foreground app.
   * 
   * This uses "underlying app" from System Brain's lastMeaningfulApp,
   * NOT foreground app (which reports BreakLoop during overlay).
   * 
   * EVENT-DRIVEN: Triggered by UNDERLYING_APP_CHANGED events only.
   * NO POLLING. NO TIMERS.
   */
  useEffect(() => {
    // Only check for QUICK_TASK and POST_QUICK_TASK_CHOICE sessions
    if (session?.kind !== 'QUICK_TASK' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;

    // Wait for underlying app to be initialized
    if (!underlyingApp) return;

    // Skip if underlying app is BreakLoop infrastructure
    if (isBreakLoopInfrastructure(underlyingApp)) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Underlying app is infrastructure, ignoring:', underlyingApp);
      }
      return;
    }

    // End session if underlying app changed from session target
    if (underlyingApp !== session.app) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] 🚨 Session ended - underlying app changed', {
          sessionKind: session.kind,
          sessionApp: session.app,
          underlyingApp,
        });
      }
      setSystemSurfaceActive(false);
      safeEndSession(true);  // User left underlying app - go to home
    }
  }, [session, underlyingApp, safeEndSession]);

  /**
   * CRITICAL: End INTERVENTION / POST_QUICK_TASK_CHOICE Session when underlying app changes
   * 
   * INTERVENTION and POST_QUICK_TASK_CHOICE sessions are ONE-SHOT and NON-RECOVERABLE.
   * When the user switches to a different app, the session must end.
   * 
   * Uses UNDERLYING APP from System Brain's lastMeaningfulApp,
   * NOT foreground app (which reports BreakLoop during overlay).
   * 
   * EVENT-DRIVEN: Triggered by UNDERLYING_APP_CHANGED events only.
   * NO POLLING. NO TIMERS.
   * 
   * IMPORTANT: This check is DISABLED during REPLACE_SESSION transitions.
   */
  useEffect(() => {
    // Only check for INTERVENTION and POST_QUICK_TASK_CHOICE sessions
    if (session?.kind !== 'INTERVENTION' && session?.kind !== 'POST_QUICK_TASK_CHOICE') return;

    // Wait for underlying app to be initialized
    if (!underlyingApp) return;

    // Skip if underlying app is BreakLoop infrastructure
    if (isBreakLoopInfrastructure(underlyingApp)) {
      if (__DEV__ && underlyingApp === 'com.android.systemui') {
        console.log('[SystemSurfaceRoot] System UI overlay detected - ignoring (not user exit)');
      }
      return;
    }

    // Skip during REPLACE_SESSION transitions
    if (isReplaceSessionTransition) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] ⏭️ Skipping user left check - REPLACE_SESSION transition');
      }
      return;
    }

    // End session if underlying app changed from session target
    if (underlyingApp !== session.app) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] 🚨 Session ended - underlying app changed', {
          sessionKind: session.kind,
          sessionApp: session.app,
          underlyingApp,
        });
      }
      setSystemSurfaceActive(false);
      safeEndSession(true);  // User left app - go to home
    }
  }, [session, underlyingApp, safeEndSession, isReplaceSessionTransition]);

  /**
   * BOOTSTRAP PHASE: Wait for JS to establish session
   * 
   * During cold start, session starts as null but this doesn't mean
   * "no session should exist" - it means "JS hasn't decided yet".
   * 
   * We must wait for bootstrapState to become 'READY' (session decision made).
   * The bootstrap useEffect runs once on mount and dispatches a session event,
   * which transitions bootstrapState from BOOTSTRAPPING → READY.
   */
  if (bootstrapState === 'BOOTSTRAPPING') {
    return null;
  }

  /**
   * EXPLICIT DECISION RENDERING: Only finish when decision === FINISH
   * 
   * CRITICAL: Do NOT finish based on session === null.
   * 
   * Decision states:
   * - PENDING: Waiting for System Brain decision (show black screen)
   * - SHOW_SESSION: System Brain decided to show session (wait for session creation if null)
   * - FINISH: System Brain decided no session needed (finish activity)
   * 
   * The useEffect above handles actual activity finish when decision === FINISH.
   */
  if (systemSurfaceDecision === 'SHOW_SESSION' && session === null) {
    return null; // Black screen while waiting
  }

  if (session === null) {
    // session is null but decision is not SHOW_SESSION
    // This means either PENDING or FINISH
    return null; // useEffect will handle finish if decision === FINISH
  }

  // Render flow based on session.kind
  switch (session.kind) {
    case 'POST_QUICK_TASK_CHOICE':
      return <PostQuickTaskChoiceScreen />;

    case 'INTERVENTION':
      return <InterventionFlow app={session.app} sessionId={(session as any).sessionId} />;

    case 'QUICK_TASK':
      return <QuickTaskFlow app={session.app} />;

    case 'ALTERNATIVE_ACTIVITY':
      // v1: Alternative Activity is ALWAYS OUT_OF_APP
      // Always render UI, never check foregroundApp, never launch app
      return <AlternativeActivityFlow app={session.app} />;

    default:
      // Should never reach here (TypeScript exhaustiveness check)
      console.error('[SystemSurfaceRoot] Unknown session kind:', (session as any).kind);
      return null;
  }
}
