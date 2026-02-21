import { useColorScheme } from '@/hooks/use-color-scheme';
import { AlternativesLinkProvider } from '@/src/contexts/AlternativesLinkContext';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
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
 * - MainTabs: Bottom tab navigator (Insights, Alternatives, Settings)
 * - EditMonitoredApps: Modal screen for editing monitored apps
 *
 * NO system flows are rendered here.
 */
export default function MainAppRoot() {
  const colorScheme = useColorScheme();

  return (
    <AlternativesLinkProvider>
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
    </AlternativesLinkProvider>
  );
}

