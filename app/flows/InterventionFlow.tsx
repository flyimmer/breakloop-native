/**
 * InterventionFlow - Full intervention flow component
 * 
 * This component manages the complete intervention flow:
 * breathing → root-cause → alternatives → action → action_timer → reflection
 * 
 * Key Rules (see ARCHITECTURE_v1_frozen.md):
 * - Rule 3: MUST NOT navigate to other flows directly
 * - Rule 3: MUST dispatch SystemSession events for transitions
 * - Internal navigation only (within intervention screens)
 * 
 * CRITICAL: This component MUST NOT import QuickTaskFlow or AlternativeActivityFlow
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { getAppCategory, getInterventionDurationSec } from '@/src/os/osConfig';
import { setLastIntervenedApp } from '@/src/systemBrain/publicApi';
import { setSystemSurfaceActive } from '@/src/systemBrain/stateManager';
import { DarkTheme, DefaultTheme, NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { NativeModules, Platform } from 'react-native';
import ActionConfirmationScreen from '../screens/conscious_process/ActionConfirmationScreen';
import ActivityTimerScreen from '../screens/conscious_process/ActivityTimerScreen';
import AlternativesScreen from '../screens/conscious_process/AlternativesScreen';
import BreathingScreen from '../screens/conscious_process/BreathingScreen';
import IntentionTimerScreen from '../screens/conscious_process/IntentionTimerScreen';
import ReflectionScreen from '../screens/conscious_process/ReflectionScreen';
import RootCauseScreen from '../screens/conscious_process/RootCauseScreen';

export type InterventionStackParamList = {
  Breathing: undefined;
  RootCause: undefined;
  Alternatives: undefined;
  ActionConfirmation: undefined;
  ActivityTimer: undefined;
  Reflection: undefined;
  IntentionTimer: undefined;
};

const Stack = createNativeStackNavigator<InterventionStackParamList>();

/**
 * InterventionFlow Component
 * 
 * Props:
 * - app: Package name of the app that triggered the intervention
 * 
 * Responsibilities:
 * - Manage internal navigation between intervention screens
 * - Dispatch END_SESSION when intervention completes
 * - Dispatch START_ALTERNATIVE_ACTIVITY when user starts alternative
 * 
 * MUST NOT:
 * - Import or reference QuickTaskFlow or AlternativeActivityFlow
 * - Navigate to other flows directly
 */
interface InterventionFlowProps {
  app: string;
  sessionId: number;
}

export default function InterventionFlow({ app, sessionId }: InterventionFlowProps) {
  const navigationRef = useRef<NavigationContainerRef<InterventionStackParamList>>(null);
  const colorScheme = useColorScheme();
  const { interventionState, dispatchIntervention } = useIntervention();
  const { safeEndSession, dispatchSystemEvent } = useSystemSession();
  const { state, targetApp } = interventionState;
  const previousStateRef = useRef<string>(state);
  const previousTargetAppRef = useRef<any>(targetApp);

  /**
   * Initialize intervention state when flow mounts or app changes
   * 
   * CRITICAL: Dispatch BEGIN_INTERVENTION exactly once per app change.
   * - No state inspection (no race conditions)
   * - No refs or timers (deterministic)
   * - Depends ONLY on [app] (session boundary)
   * 
   * This aligns with Phase 2 architecture:
   * - SystemBrain decides when an intervention starts
   * - SystemSurface dispatches exactly one session (START_INTERVENTION)
   * - InterventionFlow initializes exactly once per session (one BEGIN_INTERVENTION per app)
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[InterventionFlow] BEGIN_INTERVENTION for app:', app, 'sessionId:', sessionId);
    }

    const triggerAppCategory = getAppCategory(app);

    dispatchIntervention({
      type: 'BEGIN_INTERVENTION',
      app,
      breathingDuration: getInterventionDurationSec(),
      triggerAppCategory,
    });
  }, [app, sessionId]);

  /**
   * Navigate based on intervention state changes
   */
  useEffect(() => {
    if (!navigationRef.current?.isReady()) {
      return;
    }

    const stateChanged = state !== previousStateRef.current;
    const appChanged = targetApp !== previousTargetAppRef.current;

    if (!stateChanged && !appChanged) {
      return;
    }

    // Update refs
    previousStateRef.current = state;
    previousTargetAppRef.current = targetApp;

    if (__DEV__) {
      console.log('[InterventionFlow] State changed:', state);
    }

    // Navigate based on state
    switch (state) {
      case 'breathing':
        navigationRef.current.navigate('Breathing');
        break;
      case 'root-cause':
        navigationRef.current.navigate('RootCause');
        break;
      case 'alternatives':
        navigationRef.current.navigate('Alternatives');
        break;
      case 'timer':
        navigationRef.current.navigate('IntentionTimer');
        break;
      case 'action':
        navigationRef.current.navigate('ActionConfirmation');
        break;
      case 'action_timer':
        // RULE 3: Dispatch START_ALTERNATIVE_ACTIVITY event instead of navigating
        // Don't launch home - user is starting alternative activity
        if (__DEV__) {
          console.log('[InterventionFlow] Starting alternative activity - dispatching START_ALTERNATIVE_ACTIVITY');
        }
        dispatchSystemEvent({
          type: 'START_ALTERNATIVE_ACTIVITY',
          app,
          shouldLaunchHome: false,
        });
        break;
      case 'reflection':
        navigationRef.current.navigate('Reflection');
        break;
      case 'idle':
        // RULE 3: Dispatch END_SESSION event instead of navigating

        // APP_SWITCH BYPASS (Hot Swap)
        // If we represent a cross-app switch, the surface MUST remain active.
        // We will immediately start a NEW intervention for the NEW app.
        // Do NOT close the surface here.
        if (interventionState.resetReason === 'APP_SWITCH') {
          if (__DEV__) {
            console.log('[InterventionFlow] Idle due to APP_SWITCH — skip safeEndSession / surface finish');
          }
          // Resume execution? No, just break. The new intervention will start via new props.
          break;
        }

        // Determine if we should launch home based on how intervention ended
        const shouldLaunchHome = !interventionState.intentionTimerSet;

        if (__DEV__) {
          console.log('[InterventionFlow] Intervention completed - calling safeEndSession', {
            intentionTimerSet: interventionState.intentionTimerSet,
            shouldLaunchHome,
          });
        }

        // CRITICAL: Notify native BEFORE surface close (atomic cleanup + deterministic reevaluation)
        let nativeOwnsFinish = false;
        if (Platform.OS === 'android' && app && NativeModules.AppMonitorModule?.onInterventionCompleted) {
          try {
            const sid = sessionId?.toString() ?? '';
            NativeModules.AppMonitorModule.onInterventionCompleted(app, sid);
            nativeOwnsFinish = true;
            if (__DEV__) {
              console.log('[InterventionFlow] onInterventionCompleted sent to native');
            }
          } catch (e) {
            console.error('[InterventionFlow] onInterventionCompleted failed', e);
          }
        }

        // Set lastIntervenedApp flag if user is returning to the app (not going home)
        // Fire-and-forget - no await, END_SESSION must happen immediately
        if (!shouldLaunchHome && app) {
          setLastIntervenedApp(app);
          if (__DEV__) {
            console.log('[InterventionFlow] lastIntervenedApp set (fire-and-forget)');
          }
        }

        if (nativeOwnsFinish) {
          // Fallback timeout: if native FINISH doesn't close surface within 500ms, JS closes it
          setTimeout(() => {
            // Check if session still exists (native may have already closed it)
            if (__DEV__) {
              console.log('[InterventionFlow] Fallback timeout fired - closing surface if still active');
            }
            setSystemSurfaceActive(false);
            safeEndSession(shouldLaunchHome);
          }, 500);
        } else {
          // Non-Android or bridge unavailable: JS closes surface directly
          setSystemSurfaceActive(false);
          if (__DEV__) {
            console.log('[InterventionFlow] Notified native: SystemSurface finishing');
          }
          safeEndSession(shouldLaunchHome);
        }
        break;
    }
  }, [state, targetApp, app]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      independent={true}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="Breathing" component={BreathingScreen} />
        <Stack.Screen name="RootCause" component={RootCauseScreen} />
        <Stack.Screen name="Alternatives" component={AlternativesScreen} />
        <Stack.Screen name="ActionConfirmation" component={ActionConfirmationScreen} />
        <Stack.Screen name="ActivityTimer" component={ActivityTimerScreen} />
        <Stack.Screen name="Reflection" component={ReflectionScreen} />
        <Stack.Screen name="IntentionTimer" component={IntentionTimerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
