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
import { handleForegroundAppChange } from '@/src/os/osTriggerBrain';
import InterventionFlow from '../flows/InterventionFlow';
import QuickTaskFlow from '../flows/QuickTaskFlow';
import AlternativeActivityFlow from '../flows/AlternativeActivityFlow';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Finish SystemSurfaceActivity
 * Called when session becomes null (Rule 4)
 */
function finishSystemSurfaceActivity() {
  if (Platform.OS === 'android' && AppMonitorModule) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Session is null - finishing SystemSurfaceActivity');
    }
    // Note: We call cancelInterventionActivity which finishes the activity and launches home
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
  const { session, bootstrapState, foregroundApp, dispatchSystemEvent } = useSystemSession();
  const [bootstrapInitialized, setBootstrapInitialized] = useState(false);

  /**
   * BOOTSTRAP INITIALIZATION (Cold Start)
   * 
   * Per system_surface_bootstrap.md timeline (t9-t13):
   * t9  - Read wakeReason + triggeringApp from Intent extras
   * t10 - Run OS Trigger Brain in SystemSurface context
   * t11 - OS Trigger Brain makes decision
   * t12 - Dispatch SystemSession event
   * t13 - Set bootstrapState = READY
   * 
   * This ensures session is created in the CORRECT React context.
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

        // t10-t11: Run OS Trigger Brain in THIS context (SystemSurface)
        // This will evaluate the trigger logic and dispatch the appropriate session event
        // CRITICAL: Use force flag to bypass duplicate event filtering
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...');
        }

        handleForegroundAppChange(
          {
            packageName: triggeringApp,
            timestamp: Date.now(),
          },
          { force: true } // Bypass duplicate filter for bootstrap
        );

        // t12-t13: OS Trigger Brain will dispatch session event, which sets bootstrapState = READY

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
        console.log('[SystemSurfaceRoot] Session is null (bootstrap complete) - triggering activity finish');
      }
      finishSystemSurfaceActivity();
    }
  }, [session, bootstrapState]);

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
      // RULE 1: Alternative Activity visibility is conditional
      // Session remains active, but UI is hidden when user is in different app
      if (foregroundApp !== session.app) {
        if (__DEV__) {
          console.log('[SystemSurfaceRoot] Alternative Activity hidden (foreground app:', foregroundApp, 'session app:', session.app, ')');
        }
        // Render null but DO NOT end session or finish activity
        return null;
      }

      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Rendering AlternativeActivityFlow for app:', session.app);
      }
      return <AlternativeActivityFlow app={session.app} />;

    default:
      // Should never reach here (TypeScript exhaustiveness check)
      console.error('[SystemSurfaceRoot] Unknown session kind:', (session as any).kind);
      return null;
  }
}
