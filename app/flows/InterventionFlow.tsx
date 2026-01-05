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

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { getInterventionDurationSec } from '@/src/os/osConfig';
import BreathingScreen from '../screens/conscious_process/BreathingScreen';
import RootCauseScreen from '../screens/conscious_process/RootCauseScreen';
import AlternativesScreen from '../screens/conscious_process/AlternativesScreen';
import ActionConfirmationScreen from '../screens/conscious_process/ActionConfirmationScreen';
import ActivityTimerScreen from '../screens/conscious_process/ActivityTimerScreen';
import ReflectionScreen from '../screens/conscious_process/ReflectionScreen';
import IntentionTimerScreen from '../screens/conscious_process/IntentionTimerScreen';

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
}

export default function InterventionFlow({ app }: InterventionFlowProps) {
  const navigationRef = useRef<NavigationContainerRef<InterventionStackParamList>>(null);
  const colorScheme = useColorScheme();
  const { interventionState, dispatchIntervention } = useIntervention();
  const { dispatchSystemEvent } = useSystemSession();
  const { state, targetApp } = interventionState;
  const previousStateRef = useRef<string>(state);
  const previousTargetAppRef = useRef<any>(targetApp);

  /**
   * Initialize intervention state when flow mounts
   * 
   * CRITICAL: Do NOT dispatch BEGIN_INTERVENTION unconditionally.
   * Session creation (START_INTERVENTION) IS the intervention start.
   * This flow only renders and advances the intervention steps.
   * 
   * The OS Trigger Brain already dispatched START_INTERVENTION,
   * which created the session. We just need to ensure the reducer
   * is in the correct initial state.
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[InterventionFlow] Mounted for app:', app);
    }
    
    // If reducer is not already in breathing state, initialize it
    if (interventionState.state === 'idle' || interventionState.targetApp !== app) {
      if (__DEV__) {
        console.log('[InterventionFlow] Initializing reducer state for app:', app);
      }
      dispatchIntervention({
        type: 'BEGIN_INTERVENTION',
        app,
        breathingDuration: getInterventionDurationSec(), // ✅ Use config (5 seconds)
      });
    }
  }, [app]); // Only run on mount or app change

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
        if (__DEV__) {
          console.log('[InterventionFlow] Starting alternative activity - dispatching START_ALTERNATIVE_ACTIVITY');
        }
        dispatchSystemEvent({ type: 'START_ALTERNATIVE_ACTIVITY', app });
        break;
      case 'reflection':
        navigationRef.current.navigate('Reflection');
        break;
      case 'idle':
        // RULE 3: Dispatch END_SESSION event instead of navigating
        if (__DEV__) {
          console.log('[InterventionFlow] Intervention completed - dispatching END_SESSION');
        }
        dispatchSystemEvent({ type: 'END_SESSION' });
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
