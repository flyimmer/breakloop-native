/**
 * RootNavigator
 * 
 * Root navigation that includes both main app tabs and intervention flow screens.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import MainNavigation from './MainNavigation';
import BreathingScreen from '../screens/conscious_process/BreathingScreen';
import RootCauseScreen from '../screens/conscious_process/RootCauseScreen';
import AlternativesScreen from '../screens/conscious_process/AlternativesScreen';
import ActionConfirmationScreen from '../screens/conscious_process/ActionConfirmationScreen';
import ActivityTimerScreen from '../screens/conscious_process/ActivityTimerScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Breathing: undefined;
  RootCause: undefined;
  Alternatives: undefined;
  ActionConfirmation: undefined;
  ActivityTimer: undefined;
  // Add other intervention screens as needed
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
      <Stack.Screen name="Breathing" component={BreathingScreen} />
      <Stack.Screen name="RootCause" component={RootCauseScreen} />
      <Stack.Screen name="Alternatives" component={AlternativesScreen} />
      <Stack.Screen name="ActionConfirmation" component={ActionConfirmationScreen} />
      <Stack.Screen name="ActivityTimer" component={ActivityTimerScreen} />
    </Stack.Navigator>
  );
}

