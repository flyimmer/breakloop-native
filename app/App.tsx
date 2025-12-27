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
import { handleForegroundAppChange } from '@/src/os/osTriggerBrain';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

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

const App = () => {
  /**
   * STEP 4 — Android foreground app monitoring (OBSERVATION ONLY)
   * Starts monitoring service and logs foreground app changes.
   * No intervention triggering logic yet - that's Step 5.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      if (__DEV__) {
        console.log('[OS] App monitoring not available (not Android or module missing)');
      }
      return;
    }

    // Start monitoring service
    AppMonitorModule.startMonitoring()
      .then((result: any) => {
        if (__DEV__ && result.success) {
          console.log('[OS] Foreground app monitoring started');
        } else if (__DEV__ && !result.success) {
          console.warn('[OS] Monitoring service started but permission may be missing:', result.message);
        }
      })
      .catch((error: any) => {
        console.error('[OS] Failed to start monitoring:', error);
      });

    // Listen for foreground app changes
    const emitter = new NativeEventEmitter(AppMonitorModule);
    const subscription = emitter.addListener(
      'onForegroundAppChanged',
      (event: { packageName: string; timestamp: number }) => {
        if (__DEV__) {
          console.log('[OS] Foreground app changed:', event.packageName);
        }
        
        // Pass to OS Trigger Brain for tracking
        handleForegroundAppChange({
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
        
        // TODO Step 5B: Add intervention trigger logic here
      }
    );

    return () => {
      subscription.remove();
      AppMonitorModule.stopMonitoring()
        .then(() => {
          if (__DEV__) {
            console.log('[OS] Foreground app monitoring stopped');
          }
        })
        .catch((error: any) => {
          console.error('[OS] Failed to stop monitoring:', error);
        });
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


