/**
 * useAppMonitor Hook
 * 
 * React hook that subscribes to foreground app changes from the native module.
 * 
 * Usage:
 * ```typescript
 * import { useAppMonitor } from './hooks/useAppMonitor';
 * 
 * function MyComponent() {
 *   const { currentApp, isMonitoring, startMonitoring, stopMonitoring } = useAppMonitor({
 *     onAppChanged: (packageName, timestamp) => {
 *       console.log('Foreground app changed:', packageName);
 *       // Your business logic here (e.g., trigger intervention flow)
 *     },
 *   });
 * 
 *   return (
 *     <View>
 *       <Text>Monitoring: {isMonitoring ? 'Yes' : 'No'}</Text>
 *       <Text>Current App: {currentApp || 'None'}</Text>
 *       <Button title="Start" onPress={startMonitoring} />
 *       <Button title="Stop" onPress={stopMonitoring} />
 *     </View>
 *   );
 * }
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { AppMonitorModule, ForegroundAppEvent } from '../native-modules/AppMonitorModule';

/**
 * Hook options
 */
export interface UseAppMonitorOptions {
  /**
   * Callback fired when foreground app changes
   * 
   * @param packageName - Package name of the new foreground app
   * @param timestamp - Timestamp when app moved to foreground
   */
  onAppChanged?: (packageName: string, timestamp: number) => void;

  /**
   * Whether to automatically start monitoring on mount
   * Default: false
   */
  autoStart?: boolean;
}

/**
 * Hook return value
 */
export interface UseAppMonitorReturn {
  /** Package name of the current foreground app (null if unknown) */
  currentApp: string | null;
  
  /** Whether monitoring is currently active */
  isMonitoring: boolean;
  
  /** Start the monitoring service */
  startMonitoring: () => Promise<void>;
  
  /** Stop the monitoring service */
  stopMonitoring: () => Promise<void>;
  
  /** Refresh monitoring status */
  checkStatus: () => Promise<void>;
  
  /** Last error that occurred (null if no error) */
  error: string | null;
}

/**
 * Hook that manages app monitoring lifecycle and event subscription
 */
export function useAppMonitor(options: UseAppMonitorOptions = {}): UseAppMonitorReturn {
  const { onAppChanged, autoStart = false } = options;

  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setError('App monitoring is only available on Android');
      return;
    }

    try {
      const result = await AppMonitorModule.startMonitoring();
      if (result.success) {
        setIsMonitoring(true);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
      console.error('Failed to start app monitoring:', err);
    }
  }, []);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const result = await AppMonitorModule.stopMonitoring();
      if (result.success) {
        setIsMonitoring(false);
        setCurrentApp(null);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
      console.error('Failed to stop app monitoring:', err);
    }
  }, []);

  /**
   * Check monitoring status
   */
  const checkStatus = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const status = await AppMonitorModule.isMonitoring();
      setIsMonitoring(status);
    } catch (err) {
      console.error('Failed to check monitoring status:', err);
    }
  }, []);

  /**
   * Subscribe to foreground app events
   */
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // Create event emitter
    const eventEmitter = new NativeEventEmitter(NativeModules.AppMonitorModule);

    // Subscribe to events
    const subscription = eventEmitter.addListener(
      'onForegroundAppChanged',
      (event: ForegroundAppEvent) => {
        setCurrentApp(event.packageName);
        
        // Call user's callback
        if (onAppChanged) {
          onAppChanged(event.packageName, event.timestamp);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.remove();
    };
  }, [onAppChanged]);

  /**
   * Auto-start monitoring if requested
   */
  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }
  }, [autoStart, startMonitoring]);

  /**
   * Check initial status on mount
   */
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    currentApp,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    checkStatus,
    error,
  };
}

