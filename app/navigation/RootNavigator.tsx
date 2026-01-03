/**
 * RootNavigator
 * 
 * Root navigation that includes both main app tabs and intervention flow screens.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import MainNavigation from './MainNavigation';
import QuickTaskDialogScreen from '../screens/conscious_process/QuickTaskDialogScreen';
import QuickTaskExpiredScreen from '../screens/conscious_process/QuickTaskExpiredScreen';
import BreathingScreen from '../screens/conscious_process/BreathingScreen';
import RootCauseScreen from '../screens/conscious_process/RootCauseScreen';
import AlternativesScreen from '../screens/conscious_process/AlternativesScreen';
import ActionConfirmationScreen from '../screens/conscious_process/ActionConfirmationScreen';
import ActivityTimerScreen from '../screens/conscious_process/ActivityTimerScreen';
import ReflectionScreen from '../screens/conscious_process/ReflectionScreen';
import IntentionTimerScreen from '../screens/conscious_process/IntentionTimerScreen';
import EditMonitoredAppsScreen from '../screens/mainAPP/Settings/EditMonitoredAppsScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  QuickTaskDialog: undefined;
  QuickTaskExpired: undefined;
  Breathing: undefined;
  RootCause: undefined;
  Alternatives: undefined;
  ActionConfirmation: undefined;
  ActivityTimer: undefined;
  Reflection: undefined;
  IntentionTimer: undefined; // A2: Exit normalization screen
  EditMonitoredApps: {
    initialApps?: string[];
    initialWebsites?: string[];
    onSave?: (apps: string[], websites: string[]) => void;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal', // Intervention screens appear as modals
      }}
    >
      <Stack.Screen name="MainTabs" component={MainNavigation} />
      <Stack.Screen 
        name="QuickTaskDialog" 
        component={QuickTaskDialogScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'none',
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="QuickTaskExpired" 
        component={QuickTaskExpiredScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'none',
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="Breathing" 
        component={BreathingScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="RootCause" 
        component={RootCauseScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="Alternatives" 
        component={AlternativesScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="ActionConfirmation" 
        component={ActionConfirmationScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="ActivityTimer" 
        component={ActivityTimerScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="Reflection" 
        component={ReflectionScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen 
        name="IntentionTimer" 
        component={IntentionTimerScreen}
        options={{
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen
        name="EditMonitoredApps"
        component={EditMonitoredAppsScreen}
        options={{
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

