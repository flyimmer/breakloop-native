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

import { InterventionProvider } from '@/src/contexts/InterventionProvider';
import { RuntimeContextProvider, useRuntimeContext } from '@/src/contexts/RuntimeContextProvider';
import { SystemSessionProvider, useSystemSession } from '@/src/contexts/SystemSessionProvider';
import {
  getIsPremiumCustomer,
  getQuickTaskDurationMs,
  getQuickTaskUsesPerWindow,
  setMonitoredApps,
  setQuickTaskConfig,
} from '@/src/os/osConfig';
import {
  handleForegroundAppChange,
  setSystemSessionDispatcher,
} from '@/src/os/osTriggerBrain';
import { appDiscoveryService } from '@/src/services/appDiscovery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainAppRoot from './roots/MainAppRoot';
import SystemSurfaceRoot from './roots/SystemSurfaceRoot';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * AppContent - Renders appropriate root based on RuntimeContext
 * 
 * This component is wrapped by all providers and determines which root to render.
 * Also connects OS Trigger Brain to SystemSession dispatcher (Rule 2).
 */
function AppContent({ monitoredAppsLoaded }: { monitoredAppsLoaded: boolean }) {
  const runtime = useRuntimeContext();
  const { dispatchSystemEvent } = useSystemSession();
  const hasStartedMonitoringRef = useRef(false);

  /**
   * Android foreground app monitoring service startup
   * 
   * CRITICAL: Foreground monitoring must NEVER start in SYSTEM_SURFACE runtime.
   * Duplicate monitoring causes Quick Task to reopen after POST_QUIT.
   * 
   * Rule: Only start monitoring in MAIN_APP context.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    // Guard: Never start monitoring in SYSTEM_SURFACE
    if (runtime === 'SYSTEM_SURFACE') {
      if (__DEV__) {
        console.log('[OS] (SYSTEM_SURFACE) Skipping foreground monitoring start - duplicate monitoring prevention');
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
    if (hasStartedMonitoringRef.current) {
      return;
    }
    hasStartedMonitoringRef.current = true;

    AppMonitorModule.startMonitoring()
      .then((result: any) => {
        if (__DEV__ && result.success) {
          console.log('[OS] Foreground app monitoring started (MAIN_APP context)');
        } else if (__DEV__ && !result.success) {
          // Reset ref so we can try again if user grants permissions later/config changes
          hasStartedMonitoringRef.current = false;
          console.warn('[OS] Monitoring service started but permission may be missing:', result.message);
        }
      })
      .catch((error: any) => {
        // Reset ref on error to allow retry on next effect run
        hasStartedMonitoringRef.current = false;
        console.error('[OS] Failed to start monitoring:', error);
      });
  }, [monitoredAppsLoaded, runtime]);

  /**
   * Connect OS Trigger Brain to SystemSession dispatcher (Rule 2)
   * 
   * CRITICAL: Only connect in SYSTEM_SURFACE context
   * MainApp context MUST NOT create or modify SystemSession
   * 
   * This prevents the context mismatch bug where:
   * - MainActivity dispatches START_INTERVENTION in its context
   * - SystemSurfaceActivity launches with a fresh context
   * - Session never transfers → app hangs
   */
  useEffect(() => {
    if (runtime === 'SYSTEM_SURFACE') {
      setSystemSessionDispatcher(dispatchSystemEvent);
      if (__DEV__) {
        console.log('[App] ✅ Connected OS Trigger Brain to SystemSession dispatcher (SYSTEM_SURFACE context)');
      }
    } else {
      if (__DEV__) {
        console.log('[App] ⏭️ Skipping OS Trigger Brain connection (MAIN_APP context - sessions created in SystemSurface only)');
      }
    }
  }, [dispatchSystemEvent, runtime]);

  /**
   * Subscribe to foreground app changes ONLY in SYSTEM_SURFACE context
   * 
   * CRITICAL: MainActivity must NEVER subscribe to these system-level signals.
   * Foreground events are consumed exclusively by SystemSurface / OS Trigger Brain.
   * 
   * This prevents MainActivity from waking and rendering when monitored apps are detected.
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    // Only subscribe if we're in SYSTEM_SURFACE context
    if (runtime === 'SYSTEM_SURFACE') {
      const emitter = new NativeEventEmitter(AppMonitorModule);
      const subscription = emitter.addListener(
        'onForegroundAppChanged',
        (event: { packageName: string; timestamp: number }) => {
          // Pass to OS Trigger Brain for tracking exits and session lifecycle
          handleForegroundAppChange({
            packageName: event.packageName,
            timestamp: event.timestamp,
          });
        }
      );

      if (__DEV__) {
        console.log('[OS] ✅ Subscribed to foreground app changes (SYSTEM_SURFACE context)');
      }

      return () => {
        subscription.remove();
        if (__DEV__) {
          console.log('[OS] 🧹 Unsubscribed from foreground app changes (SYSTEM_SURFACE context)');
        }
      };
    } else {
      if (__DEV__) {
        console.log('[OS] ⏭️ Skipping foreground app change subscription (MAIN_APP context)');
      }
    }
  }, [runtime]);

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
   * Transient targetApp ref for finish-time navigation
   * This is NOT part of session state - only used when finishing SystemSurfaceActivity
   */
  const transientTargetAppRef = useRef<string | null>(null);

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
   * Initialize app discovery service (Android only)
   * 
   * Starts multi-source app discovery:
   * - Launcher: Fast seed (synchronous)
   * - UsageStats: Async backfill (may be slow)
   * - Accessibility: Runtime discovery (event-driven)
   * 
   * Also sets up periodic reconciliation (daily cleanup).
   */
  useEffect(() => {
    if (Platform.OS === 'android') {
      appDiscoveryService.initialize().catch((error) => {
        console.error('[App] Failed to initialize app discovery:', error);
      });

      // Periodic reconciliation (daily)
      const reconciliationInterval = setInterval(() => {
        appDiscoveryService.reconcile().catch((error) => {
          console.error('[App] Reconciliation failed:', error);
        });
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Cleanup on unmount
      return () => {
        clearInterval(reconciliationInterval);
        appDiscoveryService.cleanup();
      };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <RuntimeContextProvider>
        <SystemSessionProvider transientTargetAppRef={transientTargetAppRef}>
          <InterventionProvider>
            <AppContent monitoredAppsLoaded={monitoredAppsLoaded} />
            <StatusBar style="auto" />
          </InterventionProvider>
        </SystemSessionProvider>
      </RuntimeContextProvider>
    </SafeAreaProvider>
  );
};

export default App;
