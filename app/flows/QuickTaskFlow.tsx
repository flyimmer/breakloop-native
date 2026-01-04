/**
 * QuickTaskFlow - Quick Task decision dialog flow
 * 
 * This component manages the Quick Task flow:
 * - Shows Quick Task dialog (user chooses Quick Task or Conscious Process)
 * - Shows Quick Task expired screen when timer expires
 * 
 * Key Rules (see ARCHITECTURE_v1_frozen.md):
 * - Rule 3: MUST NOT navigate to other flows directly
 * - Rule 3: MUST dispatch SystemSession events for transitions
 * 
 * CRITICAL: This component MUST NOT import InterventionFlow or AlternativeActivityFlow
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import QuickTaskDialogScreen from '../screens/conscious_process/QuickTaskDialogScreen';
import QuickTaskExpiredScreen from '../screens/conscious_process/QuickTaskExpiredScreen';

export type QuickTaskStackParamList = {
  QuickTaskDialog: undefined;
  QuickTaskExpired: undefined;
};

const Stack = createNativeStackNavigator<QuickTaskStackParamList>();

/**
 * QuickTaskFlow Component
 * 
 * Props:
 * - app: Package name of the app that triggered Quick Task
 * 
 * Responsibilities:
 * - Show Quick Task dialog
 * - Show Quick Task expired screen
 * - Dispatch START_INTERVENTION when user chooses "Conscious Process"
 * - Dispatch END_SESSION when user chooses "Quick Task" or acknowledges expiry
 * 
 * MUST NOT:
 * - Import or reference InterventionFlow or AlternativeActivityFlow
 * - Navigate to other flows directly
 */
interface QuickTaskFlowProps {
  app: string;
}

export default function QuickTaskFlow({ app }: QuickTaskFlowProps) {
  const navigationRef = useRef<NavigationContainerRef<QuickTaskStackParamList>>(null);
  const colorScheme = useColorScheme();
  const { dispatchSystemEvent } = useSystemSession();

  /**
   * Initialize Quick Task flow
   * 
   * Note: The actual Quick Task state (visible, expired) is managed by
   * the old QuickTaskProvider for now. This will be migrated to SystemSession
   * in a future step.
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[QuickTaskFlow] Initializing Quick Task flow for app:', app);
    }
  }, [app]);

  /**
   * Handle user choosing "Quick Task"
   * Dispatches END_SESSION to close SystemSurface and launch the app
   */
  const handleQuickTaskChosen = () => {
    if (__DEV__) {
      console.log('[QuickTaskFlow] User chose Quick Task - dispatching END_SESSION');
    }
    // RULE 3: Dispatch event instead of navigating
    dispatchSystemEvent({ type: 'END_SESSION' });
  };

  /**
   * Handle user choosing "Conscious Process"
   * Dispatches START_INTERVENTION to transition to intervention flow
   */
  const handleConsciousProcessChosen = () => {
    if (__DEV__) {
      console.log('[QuickTaskFlow] User chose Conscious Process - dispatching START_INTERVENTION');
    }
    // RULE 3: Dispatch event instead of navigating
    dispatchSystemEvent({ type: 'START_INTERVENTION', app });
  };

  /**
   * Handle Quick Task expired acknowledgment
   * Dispatches END_SESSION to close SystemSurface and launch home
   */
  const handleExpiredAcknowledged = () => {
    if (__DEV__) {
      console.log('[QuickTaskFlow] User acknowledged expiry - dispatching END_SESSION');
    }
    // RULE 3: Dispatch event instead of navigating
    dispatchSystemEvent({ type: 'END_SESSION' });
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      independent={true}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="QuickTaskDialog" component={QuickTaskDialogScreen} />
        <Stack.Screen name="QuickTaskExpired" component={QuickTaskExpiredScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
