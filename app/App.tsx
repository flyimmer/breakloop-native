import { useColorScheme } from '@/hooks/use-color-scheme';
import { InterventionProvider, useIntervention } from '@/src/contexts/InterventionProvider';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    if (!navigationRef.current?.isReady()) {
      return;
    }

    if (state === previousStateRef.current) {
      return;
    }

    previousStateRef.current = state;

    if (state === 'breathing') {
      navigationRef.current.navigate('Breathing');
    } else if (state === 'root-cause') {
      navigationRef.current.navigate('RootCause');
    } else if (state === 'alternatives') {
      navigationRef.current.navigate('Alternatives');
    } else if (state === 'action') {
      navigationRef.current.navigate('ActionConfirmation');
    } else if (state === 'action_timer') {
      navigationRef.current.navigate('ActivityTimer');
    } else if (state === 'reflection') {
      navigationRef.current.navigate('Reflection');
    } else if (state === 'idle') {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
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

const { AppMonitorModule } = NativeModules;

const App = () => {
  /**
   * STEP 4 — Android foreground app listener (OBSERVATION ONLY)
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      console.log('[AppMonitor] Android module not available');
      return;
    }

    const emitter = new NativeEventEmitter(AppMonitorModule);

    const subscription = emitter.addListener(
      'onForegroundAppChanged',
      (event) => {
        console.log('[AppMonitor] Foreground app:', event);
      }
    );

    if (AppMonitorModule.start) {
      AppMonitorModule.start();
    }

    return () => {
      subscription.remove();
      if (AppMonitorModule.stop) {
        AppMonitorModule.stop();
      }
    };
  }, []);

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
