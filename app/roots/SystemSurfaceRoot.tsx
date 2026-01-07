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

import React, { useEffect, useState, useRef } from 'react';
import { Platform, NativeModules } from 'react-native';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import InterventionFlow from '../flows/InterventionFlow';
import QuickTaskFlow from '../flows/QuickTaskFlow';
import AlternativeActivityFlow from '../flows/AlternativeActivityFlow';

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
  const { session, bootstrapState, foregroundApp, shouldLaunchHome, dispatchSystemEvent, getTransientTargetApp, setTransientTargetApp } = useSystemSession();

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
  const prevSessionKindRef = useRef<'INTERVENTION' | 'QUICK_TASK' | 'ALTERNATIVE_ACTIVITY' | null>(null);
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
  useEffect(() => {
    const initializeBootstrap = async () => {
      try {
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...');
        }

        // Read Intent extras from native
        if (!AppMonitorModule) {
          console.error('[SystemSurfaceRoot] ❌ AppMonitorModule not available');
          dispatchSystemEvent({ type: 'END_SESSION' });
          return;
        }

        const extras = await AppMonitorModule.getSystemSurfaceIntentExtras();

        if (!extras || !extras.triggeringApp) {
          console.error('[SystemSurfaceRoot] ❌ No Intent extras - finishing activity');
          dispatchSystemEvent({ type: 'END_SESSION' });
          return;
        }

        const { triggeringApp, wakeReason } = extras;

        if (__DEV__) {
          console.log('[SystemSurfaceRoot] 📋 Intent extras:', {
            triggeringApp,
            wakeReason,
          });
        }

        // ✅ CRITICAL: Check for session mismatch
        // Intent extras ALWAYS win over stale in-memory session state
        // This handles the case where SystemSurface is relaunched while a session is still active
        if (session && session.app !== triggeringApp) {
          console.warn('[SystemSurfaceRoot] Session mismatch, replacing session', {
            oldApp: session.app,
            newApp: triggeringApp,
            wakeReason,
          });
          
          // Use REPLACE_SESSION for atomic replacement (avoids duplicate lifecycle edges)
          dispatchSystemEvent({
            type: 'REPLACE_SESSION',
            newKind: wakeReason === 'SHOW_QUICK_TASK_DIALOG'
              ? 'QUICK_TASK'
              : 'INTERVENTION',
            app: triggeringApp,
          });
          
          return; // Do not proceed with stale session
        }

        // Dispatch session based on wake reason
        // System Brain already decided to launch us with this wake reason
        // We consume that decision without recomputing
        if (wakeReason === 'SHOW_QUICK_TASK_DIALOG') {
          dispatchSystemEvent({
            type: 'START_QUICK_TASK',
            app: triggeringApp,
          });
        } else if (wakeReason === 'START_INTERVENTION_FLOW') {
          dispatchSystemEvent({
            type: 'START_INTERVENTION',
            app: triggeringApp,
          });
        } else if (wakeReason === 'INTENTION_EXPIRED_FOREGROUND') {
          dispatchSystemEvent({
            type: 'START_INTERVENTION',
            app: triggeringApp,
          });
        } else if (wakeReason === 'QUICK_TASK_EXPIRED_FOREGROUND') {
          // ⚠️ DEAD CODE PATH (as of fix for app hang bug)
          // System Brain should NOT launch SystemSurface for silent expiration
          // This case is kept as a safety net to prevent zombie Activities
          console.warn('[SystemSurfaceRoot] ⚠️ UNEXPECTED: Launched for QUICK_TASK_EXPIRED_FOREGROUND');
          console.warn('[SystemSurfaceRoot] System Brain should handle silent expiration without launching UI');
          console.warn('[SystemSurfaceRoot] Finishing immediately to prevent hang');
          
          // Finish immediately, no session event
          finishSurfaceOnly();
          return; // Hard stop - no further processing
        } else if (wakeReason === 'MONITORED_APP_FOREGROUND') {
          console.warn('[SystemSurfaceRoot] ⚠️ OLD WAKE REASON: MONITORED_APP_FOREGROUND');
          console.warn('[SystemSurfaceRoot] This should be replaced by SHOW_QUICK_TASK_DIALOG or START_INTERVENTION_FLOW');
          console.warn('[SystemSurfaceRoot] Defaulting to Quick Task for compatibility');
          dispatchSystemEvent({
            type: 'START_QUICK_TASK',
            app: triggeringApp,
          });
        } else {
          console.error('[SystemSurfaceRoot] ❌ Unknown wake reason:', wakeReason);
          dispatchSystemEvent({
            type: 'START_INTERVENTION',
            app: triggeringApp,
          });
        }

        if (__DEV__) {
          console.log('[SystemSurfaceRoot] ✅ Bootstrap initialization complete');
        }
      } catch (error) {
        console.error('[SystemSurfaceRoot] ❌ Bootstrap initialization failed:', error);
        dispatchSystemEvent({ type: 'END_SESSION' });
      }
    };

    initializeBootstrap();
  }, []); // ✅ CRITICAL: Empty dependency array - run once on mount

  /**
   * RULE 4: Session is the ONLY authority for SystemSurface existence
   * When session becomes null (and bootstrap is complete), finish activity
   * 
   * IMPORTANT: This useEffect must be called BEFORE any early returns
   * to comply with React's Rules of Hooks.
   */
  useEffect(() => {
    if (bootstrapState === 'READY' && session === null) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Session is null (bootstrap complete) - triggering activity finish', {
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
  }, [session, bootstrapState, shouldLaunchHome]);

  /**
   * CRITICAL: End Intervention Session if user leaves the app
   * 
   * Intervention Session is ONE-SHOT and NON-RECOVERABLE.
   * If user switches away from the monitored app during intervention,
   * the session MUST end immediately.
   * 
   * IMPORTANT: This check is DISABLED during REPLACE_SESSION transitions.
   * REPLACE_SESSION (QUICK_TASK → INTERVENTION) is NOT user navigation.
   * During this transition, foregroundApp may be stale and should be ignored.
   * 
   * Detection: isReplaceSessionTransition flag is computed during render
   * with the PREVIOUS session kind, ensuring correct timing.
   * 
   * This does NOT apply to:
   * - ALTERNATIVE_ACTIVITY (already has visibility logic)
   * - QUICK_TASK (persists across app switches)
   */
  useEffect(() => {
    // Only check for INTERVENTION sessions
    if (session?.kind !== 'INTERVENTION') return;
    
    // ✅ CHECK SYSTEM UI FIRST (before any other logic)
    // System UI overlays (notification shade, quick settings) are NOT user exits
    if (isBreakLoopInfrastructure(foregroundApp)) {
      if (__DEV__ && foregroundApp === 'com.android.systemui') {
        console.log('[SystemSurfaceRoot] System UI overlay detected - ignoring (not user exit)');
      }
      return;  // Early return - don't end session
    }
    
    // ✅ DETERMINISTIC: Use pre-computed REPLACE_SESSION transition flag
    // This was calculated during render with the correct previous value
    if (isReplaceSessionTransition) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] ⏭️ Skipping user left check - REPLACE_SESSION transition (QUICK_TASK → INTERVENTION)');
      }
      return;
    }
    
    // End session if user switched to a different app
    if (foregroundApp !== session.app) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] 🚨 Intervention Session ended - user left app', {
          sessionApp: session.app,
          foregroundApp,
        });
      }
      dispatchSystemEvent({ type: 'END_SESSION' });
    }
  }, [session, foregroundApp, dispatchSystemEvent, isReplaceSessionTransition]);

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
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment', {
        bootstrapState,
      });
    }
    return null;
  }

  /**
   * SESSION END: Render null when session is null
   * 
   * When session becomes null (after END_SESSION), render nothing.
   * The useEffect above (lines 307-327) handles activity finish with proper shouldLaunchHome flag.
   * 
   * REMOVED: Defensive guard that was racing with END_SESSION useEffect.
   * Bootstrap failures are already caught by:
   * - Bootstrap initialization error handling (lines 297-300)
   * - Intent extras validation (lines 211-215)
   * 
   * Rendering null here is safe - the useEffect will finish the activity correctly.
   */
  if (session === null) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Session is null - rendering nothing (useEffect will finish activity)');
    }
    return null;
  }

  // Render flow based on session.kind
  switch (session.kind) {
    case 'INTERVENTION':
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Rendering InterventionFlow for app:', session.app);
      }
      return <InterventionFlow app={session.app} />;

    case 'QUICK_TASK':
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Rendering QuickTaskFlow for app:', session.app);
      }
      return <QuickTaskFlow app={session.app} />;

    case 'ALTERNATIVE_ACTIVITY':
      // v1: Alternative Activity is ALWAYS OUT_OF_APP
      // Always render UI, never check foregroundApp, never launch app
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Rendering AlternativeActivityFlow (OUT_OF_APP, always visible)');
      }
      return <AlternativeActivityFlow app={session.app} />;

    default:
      // Should never reach here (TypeScript exhaustiveness check)
      console.error('[SystemSurfaceRoot] Unknown session kind:', (session as any).kind);
      return null;
  }
}
