/**
 * RuntimeContextProvider - Determines which Activity context we're running in
 * 
 * RuntimeContext distinguishes between:
 * - MAIN_APP: Running in MainActivity (normal app with tabs)
 * - SYSTEM_SURFACE: Running in SystemSurfaceActivity (intervention/Quick Task/Alternative Activity)
 * 
 * This is the foundation for dual-root architecture where each Activity
 * renders a completely different root component.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform, NativeModules } from 'react-native';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * Runtime context type - which Activity are we in?
 */
export type RuntimeContext = 'MAIN_APP' | 'SYSTEM_SURFACE';

/**
 * Runtime Context - provides current Activity context
 */
const RuntimeContextContext = createContext<RuntimeContext>('MAIN_APP');

/**
 * Hook to access runtime context
 * @returns Current runtime context (MAIN_APP or SYSTEM_SURFACE)
 */
export function useRuntimeContext(): RuntimeContext {
  return useContext(RuntimeContextContext);
}

/**
 * RuntimeContextProvider Component
 * 
 * Detects which Activity we're running in by calling native getRuntimeContext().
 * This runs once on mount and determines the root component to render.
 * 
 * @param {Object} props - React props
 * @param {ReactNode} props.children - Child components
 */
interface RuntimeContextProviderProps {
  children: ReactNode;
}

export const RuntimeContextProvider: React.FC<RuntimeContextProviderProps> = ({ children }) => {
  const [runtime, setRuntime] = useState<RuntimeContext>('MAIN_APP');

  useEffect(() => {
    // Detect from native module which Activity we're in
    if (Platform.OS === 'android' && AppMonitorModule) {
      AppMonitorModule.getRuntimeContext()
        .then((ctx: string) => {
          const context = ctx as RuntimeContext;
          setRuntime(context);
          if (__DEV__) {
            console.log('[RuntimeContext] Detected context:', context);
          }
        })
        .catch((error: any) => {
          console.error('[RuntimeContext] Failed to get runtime context:', error);
          // Default to MAIN_APP on error
          setRuntime('MAIN_APP');
        });
    } else {
      // Non-Android or module not available - default to MAIN_APP
      setRuntime('MAIN_APP');
    }
  }, []);

  return (
    <RuntimeContextContext.Provider value={runtime}>
      {children}
    </RuntimeContextContext.Provider>
  );
};
