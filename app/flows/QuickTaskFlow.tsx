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

export type QuickTaskStackParamList = {
  QuickTaskDialog: undefined;
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

  /**
   * Initialize Quick Task flow
   * 
   * Quick Task expiration is SILENT - no UI shown, no acknowledgment required.
   * Expired timers are cleaned up automatically by JS logic.
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('[QuickTaskFlow] Initializing Quick Task flow for app:', app);
    }
  }, [app]);

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
