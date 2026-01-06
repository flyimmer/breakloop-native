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

import React, { useEffect, useState } from 'react';
import { Platform, NativeModules } from 'react-native';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import InterventionFlow from '../flows/InterventionFlow';
import QuickTaskFlow from '../flows/QuickTaskFlow';
import AlternativeActivityFlow from '../flows/AlternativeActivityFlow';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Check if a package name is BreakLoop infrastructure
 * These apps should NOT trigger intervention session end
 * 
 * During bootstrap, foregroundApp may temporarily be BreakLoop's own app,
 * which is infrastructure and should not be treated as "user left the app".
 */
function isBreakLoopInfrastructure(packageName: string | null): boolean {
  if (!packageName) return true; // null = not yet initialized
  
  // BreakLoop's own app package
  if (packageName === 'com.anonymous.breakloopnative') return true;
  
  // Android system navigation/gesture package
  // This appears briefly during React Navigation swipe gestures
  if (packageName === 'android') return true;
  
  // Add other infrastructure packages if needed
  // if (packageName === 'com.android.systemui') return true;
  
  return false;
}

/**
 * Finish SystemSurfaceActivity
 * Called when session becomes null (Rule 4)
 * 
 * @param shouldLaunchHome - If true, launches home screen after finishing (cancellation/completion)
 *                           If false, just finishes activity (intention timer/alternative activity)
 */
function finishSystemSurfaceActivity(shouldLaunchHome: boolean = true) {
  if (Platform.OS === 'android' && AppMonitorModule) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Session is null - finishing SystemSurfaceActivity', {
        shouldLaunchHome,
      });
    }
    
    if (shouldLaunchHome) {
      // Finish activity AND launch home (cancellation/completion)
      AppMonitorModule.cancelInterventionActivity();
    } else {
      // Finish activity only (intention timer/alternative activity)
      AppMonitorModule.finishSystemSurfaceActivity();
    }
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
  const { session, bootstrapState, foregroundApp, shouldLaunchHome, dispatchSystemEvent } = useSystemSession();
  const [bootstrapInitialized, setBootstrapInitialized] = useState(false);

  /**
   * BOOTSTRAP INITIALIZATION (Cold Start)
   * 
   * Phase 2 Bootstrap (System Brain pre-decided):
   * 1. Read wakeReason + triggeringApp from Intent extras
   * 2. Map wake reason → START_QUICK_TASK or START_INTERVENTION
   * 3. Dispatch exactly one session
   * 4. Set bootstrapState = READY
   * 
   * NO OS Trigger Brain evaluation in SystemSurface.
   * System Brain already made the decision.
   */
  useEffect(() => {
    if (bootstrapInitialized) return;

    const initializeBootstrap = async () => {
      try {
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...');
        }

        // t9: Read Intent extras from native
        if (!AppMonitorModule) {
          console.error('[SystemSurfaceRoot] ❌ AppMonitorModule not available');
          dispatchSystemEvent({ type: 'END_SESSION' });
          setBootstrapInitialized(true);
          return;
        }

        const extras = await AppMonitorModule.getSystemSurfaceIntentExtras();

        if (!extras || !extras.triggeringApp) {
          console.error('[SystemSurfaceRoot] ❌ No Intent extras - finishing activity');
          dispatchSystemEvent({ type: 'END_SESSION' });
          setBootstrapInitialized(true);
          return;
        }

        const { triggeringApp, wakeReason } = extras;

        if (__DEV__) {
          console.log('[SystemSurfaceRoot] 📋 Intent extras:', {
            triggeringApp,
            wakeReason,
          });
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
          dispatchSystemEvent({
            type: 'START_INTERVENTION',
            app: triggeringApp,
          });
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

        // Bootstrap complete, session dispatched

        setBootstrapInitialized(true);

        if (__DEV__) {
          console.log('[SystemSurfaceRoot] ✅ Bootstrap initialization complete');
        }
      } catch (error) {
        console.error('[SystemSurfaceRoot] ❌ Bootstrap initialization failed:', error);
        dispatchSystemEvent({ type: 'END_SESSION' });
        setBootstrapInitialized(true);
      }
    };

    initializeBootstrap();
  }, [bootstrapInitialized, dispatchSystemEvent]);

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
      finishSystemSurfaceActivity(shouldLaunchHome);
    }
  }, [session, bootstrapState, shouldLaunchHome]);

  /**
   * CRITICAL: End Intervention Session if user leaves the app
   * 
   * Intervention Session is ONE-SHOT and NON-RECOVERABLE.
   * If user switches away from the monitored app during intervention,
   * the session MUST end immediately.
   * 
   * IMPORTANT: Exclude BreakLoop infrastructure apps from this check.
   * During bootstrap, foregroundApp may temporarily be BreakLoop's own app,
   * which should NOT trigger session end.
   * 
   * This does NOT apply to:
   * - ALTERNATIVE_ACTIVITY (already has visibility logic)
   * - QUICK_TASK (persists across app switches)
   */
  useEffect(() => {
    // Only check for INTERVENTION sessions
    if (session?.kind !== 'INTERVENTION') return;
    
    // Don't end session if foregroundApp is null or BreakLoop infrastructure
    if (isBreakLoopInfrastructure(foregroundApp)) return;
    
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
  }, [session, foregroundApp, dispatchSystemEvent]);

  /**
   * BOOTSTRAP PHASE: Wait for JS to establish session
   * 
   * During cold start, session starts as null but this doesn't mean
   * "no session should exist" - it means "JS hasn't decided yet".
   * 
   * We must wait for:
   * 1. Bootstrap initialization to complete (Intent extras read, OS Trigger Brain run)
   * 2. bootstrapState to become 'READY' (session decision made)
   */
  if (!bootstrapInitialized || bootstrapState === 'BOOTSTRAPPING') {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment', {
        bootstrapInitialized,
        bootstrapState,
      });
    }
    return null;
  }

  // RULE 4: If no session (and bootstrap complete), render nothing (activity will finish via useEffect)
  if (session === null) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Rendering null (no session, bootstrap complete)');
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
