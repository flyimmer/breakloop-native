/**
 * SystemSessionProvider - Authoritative session state for SystemSurface
 * 
 * SystemSession determines:
 * - WHETHER SystemSurfaceActivity should exist (session !== null)
 * - WHICH system flow to render (session.kind)
 * - WHICH app the session is bound to (session.app)
 * 
 * Key Rules (see ARCHITECTURE_v1_frozen.md):
 * - Rule 1: Alternative Activity visibility is conditional on foregroundApp
 * - Rule 2: Session modification is event-driven only (dispatchSystemEvent)
 * - Rule 4: Session is the ONLY authority for SystemSurface lifecycle
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * System Session type - determines which system flow is active
 */
export type SystemSession =
  | { kind: 'INTERVENTION'; app: string }
  | { kind: 'QUICK_TASK'; app: string }
  | { kind: 'ALTERNATIVE_ACTIVITY'; app: string }
  | null;

/**
 * System Session Event - event-based API for modifying session (Rule 2)
 */
export type SystemSessionEvent =
  | { type: 'START_INTERVENTION'; app: string }
  | { type: 'START_QUICK_TASK'; app: string }
  | { type: 'START_ALTERNATIVE_ACTIVITY'; app: string }
  | { type: 'END_SESSION' };

/**
 * System Session Context Value
 */
interface SystemSessionContextValue {
  session: SystemSession;
  foregroundApp: string | null;  // Tracked for Alternative Activity visibility (Rule 1)
  dispatchSystemEvent: (event: SystemSessionEvent) => void;
}

/**
 * Internal state for SystemSessionProvider
 */
interface SystemSessionState {
  session: SystemSession;
  foregroundApp: string | null;
}

/**
 * System Session Context
 */
const SystemSessionContext = createContext<SystemSessionContextValue | null>(null);

/**
 * Hook to access system session context
 * @returns {SystemSessionContextValue} { session, foregroundApp, dispatchSystemEvent }
 * @throws {Error} If used outside SystemSessionProvider
 */
export const useSystemSession = (): SystemSessionContextValue => {
  const context = useContext(SystemSessionContext);
  if (!context) {
    throw new Error('useSystemSession must be used within SystemSessionProvider');
  }
  return context;
};

/**
 * System Session Reducer
 * 
 * Handles session state transitions based on SystemSessionEvent.
 * Enforces Rule 2: Event-driven modification only.
 * 
 * @param state - Current session state
 * @param event - System session event
 * @returns New session state
 */
function systemSessionReducer(
  state: SystemSessionState,
  event: SystemSessionEvent | { type: 'UPDATE_FOREGROUND_APP'; app: string | null }
): SystemSessionState {
  if (__DEV__) {
    console.log('[SystemSession] Event:', event.type, event);
  }

  // Handle foreground app updates (internal event)
  if (event.type === 'UPDATE_FOREGROUND_APP') {
    return {
      ...state,
      foregroundApp: event.app,
    };
  }

  // Handle session events
  switch (event.type) {
    case 'START_INTERVENTION':
      if (__DEV__) {
        console.log('[SystemSession] Starting INTERVENTION session for app:', event.app);
      }
      return {
        ...state,
        session: { kind: 'INTERVENTION', app: event.app },
      };

    case 'START_QUICK_TASK':
      if (__DEV__) {
        console.log('[SystemSession] Starting QUICK_TASK session for app:', event.app);
      }
      return {
        ...state,
        session: { kind: 'QUICK_TASK', app: event.app },
      };

    case 'START_ALTERNATIVE_ACTIVITY':
      if (__DEV__) {
        console.log('[SystemSession] Starting ALTERNATIVE_ACTIVITY session for app:', event.app);
      }
      return {
        ...state,
        session: { kind: 'ALTERNATIVE_ACTIVITY', app: event.app },
      };

    case 'END_SESSION':
      if (__DEV__) {
        console.log('[SystemSession] Ending session');
      }
      return {
        ...state,
        session: null,
      };

    default:
      return state;
  }
}

/**
 * Initial system session state
 */
const initialSystemSessionState: SystemSessionState = {
  session: null,
  foregroundApp: null,
};

/**
 * SystemSessionProvider Component
 * 
 * Manages system session state and foreground app tracking.
 * 
 * Key Responsibilities:
 * - Provide session state to SystemSurfaceRoot
 * - Track foreground app for Alternative Activity visibility (Rule 1)
 * - Enforce event-driven modification (Rule 2)
 * - Ensure session is single source of truth for lifecycle (Rule 4)
 * 
 * @param {Object} props - React props
 * @param {ReactNode} props.children - Child components
 */
interface SystemSessionProviderProps {
  children: ReactNode;
}

export const SystemSessionProvider: React.FC<SystemSessionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(systemSessionReducer, initialSystemSessionState);

  /**
   * Listen for foreground app changes from native layer
   * Required for Rule 1: Alternative Activity visibility
   */
  useEffect(() => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      return;
    }

    const emitter = new NativeEventEmitter(AppMonitorModule);
    const subscription = emitter.addListener(
      'onForegroundAppChanged',
      (event: { packageName: string; timestamp: number }) => {
        if (__DEV__) {
          console.log('[SystemSession] Foreground app changed:', event.packageName);
        }
        dispatch({ type: 'UPDATE_FOREGROUND_APP', app: event.packageName });
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Event dispatcher - ONLY way to modify session (Rule 2)
   */
  const dispatchSystemEvent = (event: SystemSessionEvent) => {
    if (__DEV__) {
      console.log('[SystemSession] dispatchSystemEvent:', event);
    }
    dispatch(event);
  };

  const value: SystemSessionContextValue = {
    session: state.session,
    foregroundApp: state.foregroundApp,
    dispatchSystemEvent,
  };

  return (
    <SystemSessionContext.Provider value={value}>
      {children}
    </SystemSessionContext.Provider>
  );
};
