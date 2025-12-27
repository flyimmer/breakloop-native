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

// Use NativeModules instead of TurboModuleRegistry for legacy modules
const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

// TEMP DEBUG: Check module access
console.log('=== TEMP DEBUG START ===');
console.log('Is bridgeless:', (global as any).__bridgeless);
console.log('AppMonitorModule via NativeModules:', AppMonitorModule);
console.log('AppMonitorModule is non-null:', !!AppMonitorModule);
console.log('=== TEMP DEBUG END ===');

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
   * STEP 4 — Android foreground app listener (OBSERVATION ONLY)
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      console.log('[AppMonitor] Android module not available');
      return;
    }

    // TEMP DEBUG: Start monitoring
    console.log('[AppMonitor] TEMP DEBUG: Starting monitoring...');
    AppMonitorModule.startMonitoring()
      .then((result: any) => {
        console.log('[AppMonitor] TEMP DEBUG: Monitoring started:', result);
      })
      .catch((error: any) => {
        console.error('[AppMonitor] TEMP DEBUG: Failed to start monitoring:', error);
      });

    const emitter = new NativeEventEmitter(AppMonitorModule);

    const subscription = emitter.addListener(
      'onForegroundAppChanged',
      (event: { packageName: string; timestamp: number }) => {
        console.log('[AppMonitor] Foreground app changed:', {
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
      }
    );

    return () => {
      console.log('[AppMonitor] TEMP DEBUG: Cleaning up monitoring...');
      subscription.remove();
      AppMonitorModule.stopMonitoring()
        .then((result: any) => {
          console.log('[AppMonitor] TEMP DEBUG: Monitoring stopped:', result);
        })
        .catch((error: any) => {
          console.error('[AppMonitor] TEMP DEBUG: Failed to stop monitoring:', error);
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


