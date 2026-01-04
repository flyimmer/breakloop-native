/**
 * AlternativeActivityFlow - Alternative Activity timer flow
 * 
 * This component manages the Alternative Activity flow:
 * - Shows activity timer UI
 * - Handles timer completion or early finish
 * 
 * Key Rules (see ARCHITECTURE_v1_frozen.md):
 * - Rule 1: Visibility is controlled by SystemSurfaceRoot (not this component)
 * - Rule 3: MUST NOT navigate to other flows directly
 * - Rule 3: MUST dispatch SystemSession events for transitions
 * 
 * CRITICAL: This component MUST NOT import InterventionFlow or QuickTaskFlow
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import ActivityTimerScreen from '../screens/conscious_process/ActivityTimerScreen';

export type AlternativeActivityStackParamList = {
  ActivityTimer: undefined;
};

const Stack = createNativeStackNavigator<AlternativeActivityStackParamList>();

/**
 * AlternativeActivityFlow Component
 * 
 * Props:
 * - app: Package name of the app that triggered the alternative activity
 * 
 * Responsibilities:
 * - Show activity timer UI
 * - Dispatch END_SESSION when timer completes or user finishes early
 * 
 * MUST NOT:
 * - Handle visibility logic (Rule 1 - handled by SystemSurfaceRoot)
 * - Import or reference InterventionFlow or QuickTaskFlow
 * - Navigate to other flows directly
 * 
 * Note: Visibility is controlled by SystemSurfaceRoot checking foregroundApp.
 * This component always renders when session.kind === 'ALTERNATIVE_ACTIVITY',
 * but SystemSurfaceRoot may render null if foregroundApp !== session.app.
 */
interface AlternativeActivityFlowProps {
  app: string;
}

export default function AlternativeActivityFlow({ app }: AlternativeActivityFlowProps) {
  const navigationRef = useRef<NavigationContainerRef<AlternativeActivityStackParamList>>(null);
  const colorScheme = useColorScheme();
  const { interventionState } = useIntervention();
  const { dispatchSystemEvent } = useSystemSession();
  const { state } = interventionState;
  const previousStateRef = useRef<string>(state);

  /**
   * Initialize Alternative Activity flow
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[AlternativeActivityFlow] Initializing Alternative Activity for app:', app);
    }
  }, [app]);

  /**
   * Watch for intervention state changes
   * When action_timer completes, dispatch END_SESSION
   */
  useEffect(() => {
    const stateChanged = state !== previousStateRef.current;
    previousStateRef.current = state;

    if (!stateChanged) {
      return;
    }

    if (__DEV__) {
      console.log('[AlternativeActivityFlow] Intervention state changed:', state);
    }

    // When user finishes activity or timer completes
    if (state === 'idle') {
      if (__DEV__) {
        console.log('[AlternativeActivityFlow] Activity completed - dispatching END_SESSION');
      }
      // RULE 3: Dispatch event instead of navigating
      dispatchSystemEvent({ type: 'END_SESSION' });
    }
  }, [state]);

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
        <Stack.Screen name="ActivityTimer" component={ActivityTimerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
