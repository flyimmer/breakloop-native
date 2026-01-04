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

import React, { useEffect } from 'react';
import { Platform, NativeModules } from 'react-native';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
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
 * Rendering Logic:
 * - session === null → Finish activity immediately (Rule 4)
 * - session.kind === 'INTERVENTION' → Render InterventionFlow
 * - session.kind === 'QUICK_TASK' → Render QuickTaskFlow
 * - session.kind === 'ALTERNATIVE_ACTIVITY' → Render AlternativeActivityFlow (with visibility check)
 */
export default function SystemSurfaceRoot() {
  const { session, foregroundApp } = useSystemSession();

  /**
   * RULE 4: Session is the ONLY authority for SystemSurface existence
   * When session becomes null, finish activity immediately
   */
  useEffect(() => {
    if (session === null) {
      if (__DEV__) {
        console.log('[SystemSurfaceRoot] Session is null - triggering activity finish');
      }
      finishSystemSurfaceActivity();
    }
  }, [session]);

  // RULE 4: If no session, render nothing (activity will finish via useEffect)
  if (session === null) {
    if (__DEV__) {
      console.log('[SystemSurfaceRoot] Rendering null (no session)');
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
