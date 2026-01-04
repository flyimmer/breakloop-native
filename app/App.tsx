/**
 * App - Dual-Root Entry Point
 * 
 * This is the main entry point for the BreakLoop app.
 * It determines which root component to render based on RuntimeContext.
 * 
 * Architecture:
 * - RuntimeContext === 'MAIN_APP' → Render MainAppRoot (tabs, settings, community)
 * - RuntimeContext === 'SYSTEM_SURFACE' → Render SystemSurfaceRoot (intervention flows)
 * 
 * The two roots are mutually exclusive and never render simultaneously.
 * This prevents UI leakage between MainActivity and SystemSurfaceActivity.
 */

import React, { useEffect, useState } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RuntimeContextProvider, useRuntimeContext } from '@/src/contexts/RuntimeContextProvider';
import { SystemSessionProvider, useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { InterventionProvider } from '@/src/contexts/InterventionProvider';
import MainAppRoot from './roots/MainAppRoot';
import SystemSurfaceRoot from './roots/SystemSurfaceRoot';
import {
  setMonitoredApps,
  setQuickTaskConfig,
  getQuickTaskDurationMs,
  getQuickTaskUsesPerWindow,
  getIsPremiumCustomer,
} from '@/src/os/osConfig';
import { handleForegroundAppChange, setSystemSessionDispatcher } from '@/src/os/osTriggerBrain';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * AppContent - Renders appropriate root based on RuntimeContext
 * 
 * This component is wrapped by all providers and determines which root to render.
 * Also connects OS Trigger Brain to SystemSession dispatcher (Rule 2).
 */
function AppContent() {
  const runtime = useRuntimeContext();
  const { dispatchSystemEvent } = useSystemSession();

  /**
   * Connect OS Trigger Brain to SystemSession dispatcher (Rule 2)
   * This allows OS Trigger Brain to dispatch session events
   */
  useEffect(() => {
    setSystemSessionDispatcher(dispatchSystemEvent);
    if (__DEV__) {
      console.log('[App] Connected OS Trigger Brain to SystemSession dispatcher');
    }
  }, [dispatchSystemEvent]);

  if (__DEV__) {
    console.log('[App] Rendering for runtime context:', runtime);
  }

  // Dual-root architecture: render based on RuntimeContext
  if (runtime === 'SYSTEM_SURFACE') {
    return <SystemSurfaceRoot />;
  }

  return <MainAppRoot />;
}

/**
 * App Component
 * 
 * Main entry point that:
 * 1. Loads configuration from storage
 * 2. Sets up native event listeners
 * 3. Wraps app in providers
 * 4. Renders appropriate root based on RuntimeContext
 */
const App = () => {
  const [monitoredAppsLoaded, setMonitoredAppsLoaded] = useState(false);

  /**
   * Load monitored apps from storage on app start
   * This initializes osConfig with user-selected apps
   * IMPORTANT: This must complete before monitoring starts
   */
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

  /**
   * Load Quick Task settings from storage on app startup
   */
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
   * Android foreground app monitoring
   * Starts monitoring service and logs foreground app changes.
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
        // Pass to OS Trigger Brain for tracking
        handleForegroundAppChange({
          packageName: event.packageName,
          timestamp: event.timestamp,
        });
      }
    );

    return () => {
      // Only remove the event listener
      // DO NOT stop the monitoring service - it must run independently
      subscription.remove();
    };
  }, [monitoredAppsLoaded]);

  return (
    <SafeAreaProvider>
      <RuntimeContextProvider>
        <SystemSessionProvider>
          <InterventionProvider>
            <AppContent />
            <StatusBar style="auto" />
          </InterventionProvider>
        </SystemSessionProvider>
      </RuntimeContextProvider>
    </SafeAreaProvider>
  );
};

export default App;
