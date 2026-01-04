import { useColorScheme } from '@/hooks/use-color-scheme';
import { InterventionProvider, useIntervention } from '@/src/contexts/InterventionProvider';
import { QuickTaskProvider, useQuickTask } from '@/src/contexts/QuickTaskProvider';
import { 
  getInterventionDurationSec, 
  isMonitoredApp, 
  setMonitoredApps,
  setQuickTaskConfig,
  getQuickTaskDurationMs,
  getQuickTaskUsesPerWindow,
  getIsPremiumCustomer
} from '@/src/os/osConfig';
import {
  checkBackgroundIntentionExpiration,
  checkForegroundIntentionExpiration,
  checkQuickTaskExpiration,
  dispatchQuickTaskExpired,
  getIntentionTimer,
  getQuickTaskRemaining,
  getQuickTaskTimer,
  handleForegroundAppChange,
  setInterventionDispatcher,
  setInterventionStateGetter
} from '@/src/os/osTriggerBrain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './navigation/RootNavigator';

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
  const { quickTaskState, dispatchQuickTask } = useQuickTask();
  const { state, targetApp } = interventionState;
  const previousStateRef = useRef<string>(state);
  const previousTargetAppRef = useRef<any>(targetApp);
  const hasCheckedInitialTrigger = useRef<boolean>(false);

  /**
   * Connect OS Trigger Brain to React system
   * Creates a unified dispatcher that routes to Quick Task or Intervention
   * This must run ONCE on mount to wire up the dispatcher.
   */
  useEffect(() => {
    // Unified dispatcher: routes Quick Task actions to Quick Task, others to Intervention
    const unifiedDispatcher = (action: any) => {
      // Route Quick Task actions to QuickTaskProvider
      if (action.type === 'SHOW_QUICK_TASK' || 
          action.type === 'HIDE_QUICK_TASK' ||
          action.type === 'SHOW_EXPIRED' ||
          action.type === 'HIDE_EXPIRED') {
        dispatchQuickTask(action);
      } else {
        // Route all other actions to InterventionProvider
        dispatchIntervention(action);
      }
    };
    
    setInterventionDispatcher(unifiedDispatcher);
  }, [dispatchIntervention, dispatchQuickTask]);

  /**
   * Connect intervention state getter to OS Trigger Brain
   * Allows osTriggerBrain to check if there's an incomplete intervention
   * and cancel it when user switches away.
   */
  useEffect(() => {
    setInterventionStateGetter(() => ({
      state: interventionState.state,
      targetApp: interventionState.targetApp,
    }));
  }, [interventionState.state, interventionState.targetApp]);

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

    // CRITICAL: Check wake reason FIRST before any other logic
    // This determines WHY the System Surface was launched
    AppMonitorModule.getWakeReason()
      .then((wakeReason: string | null) => {
        if (__DEV__) {
          console.log('[F3.5] Wake reason:', wakeReason);
        }
        
        // ================================================================
        // QUICK_TASK_EXPIRED: Terminal boundary event
        // DO NOT run priority chain, DO NOT evaluate n_quickTask
        // ================================================================
        if (wakeReason === 'QUICK_TASK_EXPIRED') {
          console.log('[F3.5] ⏰ QUICK_TASK_EXPIRED - Bypassing priority chain');
          console.log('[F3.5] Dispatching SHOW_EXPIRED action');
          
          // Get the triggering app and dispatch SHOW_EXPIRED
          return AppMonitorModule.getInitialTriggeringApp()
            .then((triggeringApp: string | null) => {
              if (!triggeringApp) {
                console.error('[F3.5] No triggering app found for QUICK_TASK_EXPIRED');
                return;
              }
              
              console.log('[F3.5] Dispatching SHOW_EXPIRED for app:', triggeringApp);
              dispatchQuickTask({
                type: 'SHOW_EXPIRED',
                app: triggeringApp,
              });
            })
            .catch((error: any) => {
              console.error('[F3.5] Failed to get triggering app for QUICK_TASK_EXPIRED:', error);
            });
        }
        
        // ================================================================
        // MONITORED_APP_FOREGROUND: Normal wake - run priority chain
        // ================================================================
        if (wakeReason === 'MONITORED_APP_FOREGROUND') {
          return AppMonitorModule.getInitialTriggeringApp()
            .then((triggeringApp: string | null) => {
              if (!triggeringApp || !isMonitoredApp(triggeringApp)) {
                if (__DEV__ && triggeringApp) {
                  console.log(`[F3.5] Triggering app ${triggeringApp} is not monitored, ignoring`);
                }
                return;
              }
              
              const now = Date.now();
              
              // Check if a valid Quick Task timer exists (HIGHEST PRIORITY)
              const quickTaskTimer = getQuickTaskTimer(triggeringApp);
              if (quickTaskTimer && now < quickTaskTimer.expiresAt) {
                const remainingSec = Math.round((quickTaskTimer.expiresAt - now) / 1000);
                if (__DEV__) {
                  console.log(`[F3.5] Triggering app ${triggeringApp} has valid Quick Task timer (${remainingSec}s remaining), skipping intervention`);
                }
                return;
              }
              
              // Check if a valid intention timer exists before triggering intervention
              const intentionTimer = getIntentionTimer(triggeringApp);
              if (intentionTimer && now <= intentionTimer.expiresAt) {
                const remainingSec = Math.round((intentionTimer.expiresAt - now) / 1000);
                if (__DEV__) {
                  console.log(`[F3.5] Triggering app ${triggeringApp} has valid intention timer (${remainingSec}s remaining), skipping intervention`);
                }
                return;
              }
              
              if (__DEV__) {
                console.log(`[F3.5] Triggering app received: ${triggeringApp}`);
              }
              
              // Check Quick Task availability (run priority chain)
              const quickTaskRemaining = getQuickTaskRemaining(triggeringApp, now);
              
              if (quickTaskRemaining > 0) {
                // Show Quick Task decision screen
                if (__DEV__) {
                  console.log('[F3.5] Dispatching SHOW_QUICK_TASK');
                }
                dispatchQuickTask({
                  type: 'SHOW_QUICK_TASK',
                  app: triggeringApp,
                  remaining: quickTaskRemaining,
                });
              } else {
                // Start intervention directly
                if (__DEV__) {
                  console.log('[F3.5] Dispatching BEGIN_INTERVENTION (no Quick Task available)');
                }
                dispatchIntervention({
                  type: 'BEGIN_INTERVENTION',
                  app: triggeringApp,
                  breathingDuration: getInterventionDurationSec(),
                });
              }
            });
        }
        
        // No wake reason or unknown - likely launched from MainActivity
        // Reset Quick Task state to prevent stale dialogs
        if (__DEV__) {
          console.log('[F3.5] No wake reason - likely MainActivity launch, resetting Quick Task state');
        }
        dispatchQuickTask({ type: 'HIDE_EXPIRED' });
        dispatchQuickTask({ type: 'HIDE_QUICK_TASK' });
      })
      .catch((error: any) => {
        console.error('[F3.5] Failed to get wake reason:', error);
      });
  }, [dispatchIntervention, dispatchQuickTask]);

  /**
   * PHASE F3.5 - Fix #4: Finish InterventionActivity when intervention completes
   * 
   * When intervention state transitions to 'idle', explicitly finishes
   * InterventionActivity and launches the monitored app to return user to it.
   * 
   * IMPORTANT: We use previousTargetAppRef to get the target app because
   * the intervention reducer clears targetApp when transitioning to idle.
   */
  useEffect(() => {
    console.log('[F3.5 Debug] useEffect triggered:', {
      state,
      previousState: previousStateRef.current,
      targetApp,
      previousTargetApp: previousTargetAppRef.current,
      wasCompleted: interventionState.wasCompleted,
      intentionTimerSet: interventionState.intentionTimerSet,
      isAndroid: Platform.OS === 'android',
      hasModule: !!AppMonitorModule,
    });

    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    if (state === 'idle' && previousStateRef.current !== 'idle' && previousStateRef.current !== state) {
      console.log('[F3.5] Intervention complete (state → idle)');
      
      // Check if intervention completed normally and if intention timer was set
      const wasCompleted = interventionState.wasCompleted;
      const intentionTimerSet = interventionState.intentionTimerSet;
      const appToLaunch = intentionTimerSet ? targetApp : previousTargetAppRef.current;
      const previousState = previousStateRef.current;
      
      console.log('[F3.5] Previous state was:', previousState);
      console.log('[F3.5] App to launch:', appToLaunch);
      console.log('[F3.5] Was completed:', wasCompleted);
      console.log('[F3.5] Intention timer set:', intentionTimerSet);
      
      // DECISION LOGIC:
      // 1. If intervention completed normally AND no intention timer → Launch home screen
      // 2. If cancelled (not completed) → Launch home screen (user pressed back)
      // 3. If intention timer set → Launch triggering app (finishInterventionActivity)
      if (intentionTimerSet) {
        // Intention timer set - launch the triggering app
        console.log('[F3.5] Intention timer set - launching triggering app');
        setTimeout(() => {
          try {
            console.log('[F3.5] Calling finishInterventionActivity (will launch app)');
            AppMonitorModule.finishInterventionActivity();
            console.log('[F3.5] finishInterventionActivity called successfully');
          } catch (error) {
            console.error('[F3.5] finishInterventionActivity threw error:', error);
          }
        }, 100);
      } else {
        // No intention timer - launch home screen (whether completed or cancelled)
        console.log('[F3.5] No intention timer - launching home screen');
        setTimeout(() => {
          try {
            console.log('[F3.5] Launching home screen now');
            AppMonitorModule.launchHomeScreen();
            console.log('[F3.5] launchHomeScreen called successfully');
          } catch (error) {
            console.error('[F3.5] launchHomeScreen threw error:', error);
          }
        }, 100);
      }
    }
  }, [state, targetApp, interventionState.wasCompleted, interventionState.intentionTimerSet]);

  /**
   * Finish InterventionActivity when Quick Task is activated (not when Conscious Process is chosen)
   * 
   * CRITICAL: Only finish activity when user chose "Quick Task", NOT "Conscious Process"
   * 
   * When user activates Quick Task:
   * - Quick Task state changes to hidden (visible: false)
   * - Intervention state remains idle (state: 'idle')
   * - We should finish InterventionActivity to return to monitored app
   * 
   * When user chooses Conscious Process:
   * - Quick Task state changes to hidden (visible: false)
   * - Intervention state changes to breathing (state: 'breathing')
   * - We should NOT finish InterventionActivity, stay and show intervention screens
   */
  const previousQuickTaskVisibleRef = useRef<boolean>(quickTaskState.visible);
  
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    // Check if Quick Task was just hidden (visible changed from true to false)
    if (previousQuickTaskVisibleRef.current === true && quickTaskState.visible === false) {
      // CRITICAL: Check if intervention has started
      // If intervention state is NOT idle, user chose "Conscious Process" - don't finish activity
      if (state !== 'idle') {
        console.log('[Quick Task] Quick Task hidden but intervention started, NOT finishing activity');
        console.log('[Quick Task] Intervention state:', state);
        previousQuickTaskVisibleRef.current = quickTaskState.visible;
        return;
      }
      
      // User chose "Quick Task" - finish activity and return to monitored app
      console.log('[Quick Task] Quick Task activated, finishing InterventionActivity');
      
      try {
        // Native code will launch the monitored app from Intent, then finish the activity
        AppMonitorModule.finishInterventionActivity();
        console.log('[Quick Task] finishInterventionActivity called - monitored app should return to foreground');
      } catch (error) {
        console.error('[Quick Task] finishInterventionActivity threw error:', error);
      }
    }

    // Update ref
    previousQuickTaskVisibleRef.current = quickTaskState.visible;
  }, [quickTaskState.visible, state]);

  /**
   * Navigation based on Quick Task and Intervention state
   * 
   * ARCHITECTURE: Quick Task has HIGHER PRIORITY
   * - Check Quick Task state first
   * - If Quick Task visible, show Quick Task screen
   * - Otherwise, use intervention state for navigation
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

    // HIGHEST PRIORITY: Check Quick Task expired state first
    // This is a terminal boundary event - show ONLY expired screen
    // IMPORTANT: Only show if we have an expired app (not null)
    // This prevents showing "Unknown App" when state persists incorrectly
    if (quickTaskState.showExpired && quickTaskState.expiredApp) {
      if (__DEV__) {
        console.log('[Navigation] Quick Task expired, navigating to QuickTaskExpired');
        console.log('[Navigation] Expired app:', quickTaskState.expiredApp);
      }
      navigationRef.current.navigate('QuickTaskExpired');
      // Update refs
      previousStateRef.current = state;
      previousTargetAppRef.current = targetApp;
      return;
    }

    // SECOND PRIORITY: Check Quick Task visible state
    // This must be checked BEFORE the early return, because quickTaskState.visible
    // can change independently of intervention state/targetApp
    if (quickTaskState.visible) {
      if (__DEV__) {
        console.log('[Navigation] Quick Task visible, navigating to QuickTaskDialog');
      }
      navigationRef.current.navigate('QuickTaskDialog');
      // Update refs
      previousStateRef.current = state;
      previousTargetAppRef.current = targetApp;
      return;
    }

    // If Quick Task was just hidden (user activated Quick Task), the screen should close
    // The finishInterventionActivity useEffect will handle closing the activity
    // We don't need to navigate anywhere - just let the activity close
    if (previousQuickTaskVisibleRef.current === true && !quickTaskState.visible) {
      if (__DEV__) {
        console.log('[Navigation] Quick Task hidden, waiting for InterventionActivity to finish');
      }
      // Update refs
      previousStateRef.current = state;
      previousTargetAppRef.current = targetApp;
      return;
    }

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

    // Normal intervention state-based navigation
    if (__DEV__) {
      console.log('[Navigation] Navigating based on state:', {
        state,
        targetApp,
        stateChanged,
        appChanged,
      });
    }
    
    if (state === 'breathing') {
      if (__DEV__) {
        console.log('[Navigation] → Breathing screen');
      }
      navigationRef.current.navigate('Breathing');
    } else if (state === 'root-cause') {
      if (__DEV__) {
        console.log('[Navigation] → RootCause screen');
      }
      navigationRef.current.navigate('RootCause');
    } else if (state === 'alternatives') {
      navigationRef.current.navigate('Alternatives');
    } else if (state === 'timer') {
      navigationRef.current.navigate('IntentionTimer');
    } else if (state === 'action') {
      navigationRef.current.navigate('ActionConfirmation');
    } else if (state === 'action_timer') {
      navigationRef.current.navigate('ActivityTimer');
    } else if (state === 'reflection') {
      navigationRef.current.navigate('Reflection');
    } else if (state === 'idle') {
      // Don't navigate to MainTabs - just let InterventionActivity finish
      // The finishInterventionActivity() call in the other useEffect will handle closing
      // If we're in MainActivity (not InterventionActivity), this will do nothing
      if (__DEV__) {
        console.log('[Navigation] State is idle - InterventionActivity will finish via separate useEffect');
      }
    }
  }, [state, targetApp, quickTaskState.visible, quickTaskState.showExpired]);

  /**
   * Check for Quick Task expiration
   * When Quick Task timer expires, navigate to QuickTaskExpired screen
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      
      // Check for Quick Task expiration
      const expiredApp = checkQuickTaskExpiration(now);
      if (expiredApp) {
        console.log('[App] Quick Task expired for:', expiredApp);
        console.log('[App] Navigating to QuickTaskExpired screen');
        
        // Navigate to QuickTaskExpired screen
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('QuickTaskExpired');
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      onReady={() => {
        console.log('[Navigation] ✅ NavigationContainer is READY');
        console.log('[Navigation] Current state:', state);
        console.log('[Navigation] Current targetApp:', targetApp);
        console.log('[Navigation] Quick Task visible:', quickTaskState.visible);
        console.log('[Navigation] Quick Task expired:', quickTaskState.showExpired);
        
        // CRITICAL FIX: Navigate immediately if intervention/quick task is already active
        // This handles the case where intervention was triggered before navigation was ready
        if (quickTaskState.showExpired && quickTaskState.expiredApp) {
          console.log('[Navigation] Quick Task expired on mount, navigating to QuickTaskExpired');
          navigationRef.current?.navigate('QuickTaskExpired');
        } else if (quickTaskState.visible) {
          console.log('[Navigation] Quick Task visible on mount, navigating to QuickTaskDialog');
          navigationRef.current?.navigate('QuickTaskDialog');
        } else if (state === 'breathing') {
          console.log('[Navigation] Intervention in breathing state on mount, navigating to Breathing');
          navigationRef.current?.navigate('Breathing');
        } else if (state === 'root-cause') {
          console.log('[Navigation] Intervention in root-cause state on mount, navigating to RootCause');
          navigationRef.current?.navigate('RootCause');
        } else if (state === 'alternatives') {
          console.log('[Navigation] Intervention in alternatives state on mount, navigating to Alternatives');
          navigationRef.current?.navigate('Alternatives');
        } else if (state === 'timer') {
          console.log('[Navigation] Intervention in timer state on mount, navigating to IntentionTimer');
          navigationRef.current?.navigate('IntentionTimer');
        } else if (state === 'action') {
          console.log('[Navigation] Intervention in action state on mount, navigating to ActionConfirmation');
          navigationRef.current?.navigate('ActionConfirmation');
        } else if (state === 'action_timer') {
          console.log('[Navigation] Intervention in action_timer state on mount, navigating to ActivityTimer');
          navigationRef.current?.navigate('ActivityTimer');
        } else if (state === 'reflection') {
          console.log('[Navigation] Intervention in reflection state on mount, navigating to Reflection');
          navigationRef.current?.navigate('Reflection');
        }
      }}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

const App = () => {
  /**
   * Load monitored apps from storage on app start
   * This initializes osConfig with user-selected apps
   * IMPORTANT: This must complete before monitoring starts
   */
  const [monitoredAppsLoaded, setMonitoredAppsLoaded] = useState(false);

  useEffect(() => {
    const loadMonitoredApps = async () => {
      try {
        const stored = await AsyncStorage.getItem('monitored_apps_v1');
        if (stored) {
          const apps = JSON.parse(stored);
          setMonitoredApps(apps);
          setMonitoredAppsLoaded(true);
          if (__DEV__) {
            console.log('[App] ✅ Loaded monitored apps from storage:', apps);
            console.log('[App] Monitored apps count:', apps.length);
          }
        } else {
          setMonitoredAppsLoaded(true); // Mark as loaded even if empty
          if (__DEV__) {
            console.log('[App] ⚠️ No monitored apps found in storage (user hasn\'t selected any yet)');
          }
        }
      } catch (error) {
        console.error('[App] ❌ Failed to load monitored apps:', error);
        setMonitoredAppsLoaded(true); // Mark as loaded even on error
      }
    };

    loadMonitoredApps();
  }, []);

  // Load Quick Task settings from storage on app startup
  useEffect(() => {
    const loadQuickTaskSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('quick_task_settings_v1');
        if (stored) {
          const settings = JSON.parse(stored);
          const durationMs = settings.durationMs !== undefined ? settings.durationMs : getQuickTaskDurationMs();
          const usesPerWindow = settings.usesPerWindow !== undefined ? settings.usesPerWindow : getQuickTaskUsesPerWindow();
          const isPremium = settings.isPremium !== undefined ? settings.isPremium : getIsPremiumCustomer();
          
          // Update osConfig with loaded settings
          setQuickTaskConfig(durationMs, usesPerWindow, isPremium);
          
          if (__DEV__) {
            console.log('[App] ✅ Loaded Quick Task settings from storage:', {
              durationMs,
              durationMin: Math.round(durationMs / (60 * 1000)),
              usesPerWindow,
              isPremium,
            });
          }
        } else {
          // Use defaults from osConfig
          const durationMs = getQuickTaskDurationMs();
          const usesPerWindow = getQuickTaskUsesPerWindow();
          const isPremium = getIsPremiumCustomer();
          setQuickTaskConfig(durationMs, usesPerWindow, isPremium);
          
          if (__DEV__) {
            console.log('[App] ℹ️ No Quick Task settings in storage, using defaults:', {
              durationMs,
              durationMin: Math.round(durationMs / (60 * 1000)),
              usesPerWindow,
              isPremium,
            });
          }
        }
      } catch (error) {
        console.error('[App] ❌ Failed to load Quick Task settings:', error);
        // Use defaults on error
        const durationMs = getQuickTaskDurationMs();
        const usesPerWindow = getQuickTaskUsesPerWindow();
        const isPremium = getIsPremiumCustomer();
        setQuickTaskConfig(durationMs, usesPerWindow, isPremium);
      }
    };

    loadQuickTaskSettings();
  }, []);

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
   * Quick Task timer cleanup (JavaScript memory only)
   * 
   * ARCHITECTURE NOTE:
   * - Native ForegroundDetectionService handles Quick Task expiration detection
   * - Native launches InterventionActivity with WAKE_REASON = QUICK_TASK_EXPIRED
   * - JavaScript checks wake reason on mount and navigates directly to QuickTaskExpiredScreen
   * - This interval ONLY cleans up expired timers from JavaScript memory
   * - This interval MUST NOT trigger navigation or run priority chain
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      
      // CLEANUP ONLY - remove expired timers from JS memory
      // Navigation is handled by native wake reason mechanism
      checkQuickTaskExpiration(now);
    }, 5000); // Check every 5 seconds for cleanup

    return () => clearInterval(intervalId);
  }, []);

  /**
   * STEP 4 — Android foreground app monitoring (OBSERVATION ONLY)
   * Starts monitoring service and logs foreground app changes.
   * No intervention triggering logic yet - that's Step 5.
   * 
   * IMPORTANT: Wait for monitored apps to load before starting monitoring
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      if (__DEV__) {
        console.log('[OS] App monitoring not available (not Android or module missing)');
      }
      return;
    }

    // Wait for monitored apps to load before starting monitoring
    if (!monitoredAppsLoaded) {
      if (__DEV__) {
        console.log('[OS] Waiting for monitored apps to load before starting monitoring...');
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

    // Listen for new intervention triggers when InterventionActivity gets new intent
    const newTriggerSubscription = emitter.addListener(
      'onNewInterventionTrigger',
      (event: { packageName: string; timestamp: number; wakeReason?: string }) => {
        if (__DEV__) {
          console.log('[OS] New intervention trigger received:', {
            packageName: event.packageName,
            wakeReason: event.wakeReason,
          });
        }
        
        // CRITICAL: Check wake reason FIRST
        // If QUICK_TASK_EXPIRED, dispatch SHOW_EXPIRED action
        // DO NOT run priority chain
        if (event.wakeReason === 'QUICK_TASK_EXPIRED') {
          console.log('[OS] ⏰ QUICK_TASK_EXPIRED - Bypassing priority chain');
          console.log('[OS] Dispatching SHOW_EXPIRED action');
          
          // Dispatch SHOW_EXPIRED action through OS Trigger Brain
          // This will route to QuickTaskProvider and trigger navigation
          dispatchQuickTaskExpired(event.packageName);
          return; // STOP HERE - do not run priority chain
        }
        
        // Normal wake reason - run priority chain
        handleForegroundAppChange({
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
      }
    );

    return () => {
      // Only remove the event listeners
      // DO NOT stop the monitoring service - it must run independently
      subscription.remove();
      newTriggerSubscription.remove();
      
      // The monitoring service continues running even when React Native app is closed
      // This is required for intervention system to work correctly
    };
  }, [monitoredAppsLoaded]); // Re-run when monitored apps are loaded

  return (
    <SafeAreaProvider>
      <QuickTaskProvider>
        <InterventionProvider>
          <InterventionNavigationHandler />
          <StatusBar style="auto" />
        </InterventionProvider>
      </QuickTaskProvider>
    </SafeAreaProvider>
  );
};

export default App;


