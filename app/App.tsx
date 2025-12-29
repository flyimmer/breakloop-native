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
import { 
  handleForegroundAppChange, 
  checkForegroundIntentionExpiration,
  checkBackgroundIntentionExpiration,
  setInterventionDispatcher 
} from '@/src/os/osTriggerBrain';
import { isMonitoredApp, getInterventionDurationSec } from '@/src/os/osConfig';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Component that watches intervention state and navigates accordingly
 * 
 * PHASE F3.5 ADDITIONS:
 * - Checks for initial triggering app on mount (InterventionActivity launch)
 * - Finishes InterventionActivity when intervention completes (state → idle)
 */
function InterventionNavigationHandler() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const colorScheme = useColorScheme();
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, targetApp } = interventionState;
  const previousStateRef = useRef<string>(state);
  const previousTargetAppRef = useRef<any>(targetApp);
  const hasCheckedInitialTrigger = useRef<boolean>(false);

  /**
   * Connect OS Trigger Brain to React intervention system
   * This must run ONCE on mount to wire up the dispatcher.
   */
  useEffect(() => {
    setInterventionDispatcher(dispatchIntervention);
  }, [dispatchIntervention]);

  /**
   * PHASE F3.5 - Fix #3: Check for initial triggering app
   * 
   * When InterventionActivity launches, this checks if there's a triggering app
   * passed via Intent extras. If found and it's a monitored app, dispatches
   * BEGIN_INTERVENTION to start the intervention flow.
   * 
   * This runs ONCE on mount, before any navigation occurs.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule || hasCheckedInitialTrigger.current) {
      return;
    }

    hasCheckedInitialTrigger.current = true;

    AppMonitorModule.getInitialTriggeringApp()
      .then((triggeringApp: string | null) => {
        if (triggeringApp && isMonitoredApp(triggeringApp)) {
          if (__DEV__) {
            console.log(`[F3.5] Triggering app received: ${triggeringApp}`);
            console.log('[F3.5] Dispatching BEGIN_INTERVENTION');
          }
          
          dispatchIntervention({
            type: 'BEGIN_INTERVENTION',
            app: triggeringApp,
            breathingDuration: getInterventionDurationSec(),
          });
        } else if (__DEV__ && triggeringApp) {
          console.log(`[F3.5] Triggering app ${triggeringApp} is not monitored, ignoring`);
        }
      })
      .catch((error: any) => {
        console.error('[F3.5] Failed to get initial triggering app:', error);
      });
  }, [dispatchIntervention]);

  /**
   * PHASE F3.5 - Fix #4: Finish InterventionActivity when intervention completes
   * 
   * When intervention state transitions to 'idle', explicitly finishes
   * InterventionActivity so user returns to previously opened app without
   * MainActivity being resumed.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    if (state === 'idle' && previousStateRef.current !== 'idle' && previousStateRef.current !== state) {
      if (__DEV__) {
        console.log('[F3.5] Intervention complete (state → idle), finishing InterventionActivity');
      }
      
      AppMonitorModule.finishInterventionActivity();
    }
  }, [state]);

  /**
   * Navigation based on intervention state
   * 
   * IMPORTANT: Also watches targetApp to detect app switches.
   * When targetApp changes (user switches from Instagram to TikTok during intervention),
   * we force navigation to Breathing screen even if state is already 'breathing'.
   */
  useEffect(() => {
    if (!navigationRef.current?.isReady()) {
      return;
    }

    const stateChanged = state !== previousStateRef.current;
    const appChanged = targetApp !== previousTargetAppRef.current;

    // If neither state nor app changed, do nothing
    if (!stateChanged && !appChanged) {
      return;
    }

    // Update refs
    previousStateRef.current = state;
    previousTargetAppRef.current = targetApp;

    // If app changed and we're in breathing state, force navigate to Breathing
    // This handles the case where user switches apps during intervention
    if (appChanged && state === 'breathing') {
      if (__DEV__) {
        console.log('[Navigation] App switch detected, forcing navigation to Breathing screen', {
          newApp: targetApp,
        });
      }
      navigationRef.current.navigate('Breathing');
      return;
    }

    // Normal state-based navigation
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
  }, [state, targetApp]);

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
   * STEP 5E — Intention timer expiration checking
   * Periodically checks if intention timers have expired for foreground/background apps.
   * Silent checks - only logs when timers actually expire.
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      checkForegroundIntentionExpiration(now);
      checkBackgroundIntentionExpiration(now);
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

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
    // NOTE: Service runs independently of React Native lifecycle
    // It should continue even when the app is closed/backgrounded
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
        // Pass to OS Trigger Brain for tracking (silent - Brain will log important events)
        handleForegroundAppChange({
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
        
        // TODO Step 5B: Add intervention trigger logic here
      }
    );

    return () => {
      // Only remove the event listener
      // DO NOT stop the monitoring service - it must run independently
      subscription.remove();
      
      // The monitoring service continues running even when React Native app is closed
      // This is required for intervention system to work correctly
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


