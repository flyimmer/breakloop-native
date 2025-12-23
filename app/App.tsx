import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { InterventionProvider, useIntervention } from '@/src/contexts/InterventionProvider';
import RootNavigator from './navigation/RootNavigator';

/**
 * Component that watches intervention state and navigates accordingly
 */
function InterventionNavigationHandler() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const colorScheme = useColorScheme();
  const { interventionState } = useIntervention();
  const { state } = interventionState;
  const previousStateRef = useRef<string>(state);

  useEffect(() => {
    // Only navigate if state actually changed and navigation is ready
    if (state === previousStateRef.current || !navigationRef.current?.isReady()) {
      return;
    }

    previousStateRef.current = state;

    // Navigate to BreathingScreen when intervention state becomes 'breathing'
    if (state === 'breathing') {
      navigationRef.current.navigate('Breathing');
    } else if (state === 'idle') {
      // Return to main tabs when intervention is idle
      navigationRef.current.navigate('MainTabs');
    }
  }, [state]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

const App = () => {
  return (
    <SafeAreaProvider>
      <InterventionProvider>
        <InterventionNavigationHandler />
        <StatusBar style="auto" />
      </InterventionProvider>
    </SafeAreaProvider>
  );
};

export default App;

