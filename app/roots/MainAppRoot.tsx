/**
 * MainAppRoot - Root component for MainActivity
 * 
 * This component is the ONLY root rendered in MainActivity.
 * It contains the normal app UI with tabs and navigation.
 * 
 * CRITICAL INVARIANTS:
 * - MUST NEVER render system flows (intervention, Quick Task, Alternative Activity)
 * - MUST NEVER depend on SystemSession
 * - Contains ONLY main app UI (tabs, settings, community, etc.)
 * 
 * This root is completely isolated from SystemSurfaceRoot.
 * There is NO navigation path between these two roots.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import MainNavigation from '../navigation/MainNavigation';
import EditMonitoredAppsScreen from '../screens/mainAPP/Settings/EditMonitoredAppsScreen';

export type MainAppStackParamList = {
  Main: undefined;
  EditMonitoredApps: {
    initialApps?: string[];
    initialWebsites?: string[];
    onSave?: (apps: string[], websites: string[]) => void;
  };
};

const Stack = createNativeStackNavigator<MainAppStackParamList>();

/**
 * MainAppRoot Component
 * 
 * Renders the main app navigation with tabs.
 * This is the root component for MainActivity.
 * 
 * Structure:
 * - MainTabs: Bottom tab navigator (Insights, Community, Inbox, Settings)
 * - EditMonitoredApps: Modal screen for editing monitored apps
 * 
 * NO system flows are rendered here.
 */
export default function MainAppRoot() {
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Main" component={MainNavigation} />
        <Stack.Screen
          name="EditMonitoredApps"
          component={EditMonitoredAppsScreen}
          options={{
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
