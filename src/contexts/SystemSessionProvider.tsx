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
 * Bootstrap state - prevents premature activity finish during cold start
 * 
 * BOOTSTRAPPING: JS is still processing wake reason and establishing session
 * READY: JS has made a decision, session state is authoritative
 * 
 * This solves the race condition where SystemSurfaceActivity launches with
 * a fresh React context (session = null) and finishes before JS can establish
 * the session.
 */
export type SessionBootstrapState = 'BOOTSTRAPPING' | 'READY';

/**
 * System Session Event - event-based API for modifying session (Rule 2)
 */
export type SystemSessionEvent =
  | { type: 'START_INTERVENTION'; app: string }
  | { type: 'START_QUICK_TASK'; app: string }
  | { type: 'START_ALTERNATIVE_ACTIVITY'; app: string; shouldLaunchHome?: boolean }
  | { type: 'REPLACE_SESSION'; newKind: 'INTERVENTION' | 'ALTERNATIVE_ACTIVITY'; app: string }
  | { type: 'END_SESSION'; shouldLaunchHome?: boolean; targetApp?: string };

/**
 * System Session Context Value
 */
interface SystemSessionContextValue {
  session: SystemSession;
  bootstrapState: SessionBootstrapState;
  foregroundApp: string | null;  // Tracked for Alternative Activity visibility (Rule 1)
  shouldLaunchHome: boolean;  // Whether to launch home screen when session ends
  dispatchSystemEvent: (event: SystemSessionEvent) => void;
  safeEndSession: (shouldLaunchHome: boolean) => void;  // Idempotent END_SESSION dispatcher
  setTransientTargetApp: (app: string | null) => void;  // Set transient targetApp for finish-time navigation
  getTransientTargetApp: () => string | null;  // Get transient targetApp for finish-time navigation
}

/**
 * Internal state for SystemSessionProvider
 */
interface SystemSessionState {
  session: SystemSession;
  bootstrapState: SessionBootstrapState;
  foregroundApp: string | null;
  shouldLaunchHome: boolean;  // Whether to launch home screen when session ends
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
 * BOOTSTRAP PHASE:
 * - All session events (START_*, END_SESSION) transition bootstrapState to 'READY'
 * - This ensures bootstrap ends only after JS makes a semantic decision
 * - No timers, no delays, purely event-driven
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
  // IMPORTANT: All session events exit bootstrap phase
  switch (event.type) {
    case 'START_INTERVENTION':
      if (__DEV__) {
        console.log('[SystemSession] Starting INTERVENTION session for app:', event.app);
        if (state.bootstrapState === 'BOOTSTRAPPING') {
          console.log('[SystemSession] Bootstrap phase complete - session established');
        }
      }
      return {
        ...state,
        session: { kind: 'INTERVENTION', app: event.app },
        bootstrapState: 'READY',
      };

    case 'START_QUICK_TASK':
      if (__DEV__) {
        console.log('[SystemSession] Starting QUICK_TASK session for app:', event.app);
        if (state.bootstrapState === 'BOOTSTRAPPING') {
          console.log('[SystemSession] Bootstrap phase complete - session established');
        }
      }
      return {
        ...state,
        session: { kind: 'QUICK_TASK', app: event.app },
        bootstrapState: 'READY',
      };

    case 'START_ALTERNATIVE_ACTIVITY':
      if (__DEV__) {
        console.log('[SystemSession] Starting ALTERNATIVE_ACTIVITY session for app:', event.app);
        if (state.bootstrapState === 'BOOTSTRAPPING') {
          console.log('[SystemSession] Bootstrap phase complete - session established');
        }
      }
      return {
        ...state,
        session: { kind: 'ALTERNATIVE_ACTIVITY', app: event.app },
        bootstrapState: 'READY',
        // Alternative activity: don't launch home (default to false)
        shouldLaunchHome: event.shouldLaunchHome ?? false,
      };

    case 'REPLACE_SESSION':
      if (__DEV__) {
        console.log('[SystemSession] Replacing session atomically:', {
          from: state.session?.kind,
          to: event.newKind,
          app: event.app,
        });
      }
      return {
        ...state,
        session: { kind: event.newKind, app: event.app },
        bootstrapState: 'READY',
        shouldLaunchHome: false, // Keep SystemSurface alive
      };

    case 'END_SESSION':
      if (__DEV__) {
        console.log('[SystemSession] Ending session', {
          shouldLaunchHome: event.shouldLaunchHome ?? true,
        });
        if (state.bootstrapState === 'BOOTSTRAPPING') {
          console.log('[SystemSession] Bootstrap phase complete - explicit "do nothing" decision');
        }
      }
      return {
        ...state,
        session: null,
        bootstrapState: 'READY',
        // Store shouldLaunchHome flag for SystemSurfaceRoot to read
        // Default to true (launch home) for safety
        shouldLaunchHome: event.shouldLaunchHome ?? true,
      };

    default:
      return state;
  }
}

/**
 * Initial system session state
 * 
 * BOOTSTRAP PHASE:
 * - Starts in 'BOOTSTRAPPING' state to prevent premature activity finish
 * - Only transitions to 'READY' when a session event is dispatched
 * - This solves the race condition on cold start
 */
const initialSystemSessionState: SystemSessionState = {
  session: null,
  bootstrapState: 'BOOTSTRAPPING',
  foregroundApp: null,
  shouldLaunchHome: true,  // Default to launching home for safety
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
  transientTargetAppRef?: React.MutableRefObject<string | null>;
}

export const SystemSessionProvider: React.FC<SystemSessionProviderProps> = ({ 
  children,
  transientTargetAppRef 
}) => {
  const [state, dispatch] = useReducer(systemSessionReducer, initialSystemSessionState);

  /**
   * Idempotency guard for END_SESSION
   * Prevents double-dispatch that can cause partial Activity teardown and frozen UI
   */
  const hasEndedSessionRef = React.useRef(false);

  /**
   * Reset hasEndedSession flag when a new session starts
   */
  useEffect(() => {
    if (state.session !== null && state.bootstrapState === 'READY') {
      hasEndedSessionRef.current = false;
    }
  }, [state.session, state.bootstrapState]);

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

  /**
   * Safe END_SESSION dispatcher with idempotency guard
   * Prevents double-dispatch that can cause partial Activity teardown and frozen UI
   * 
   * @param shouldLaunchHome - Whether to launch home screen when session ends
   */
  const safeEndSession = (shouldLaunchHome: boolean) => {
    if (hasEndedSessionRef.current) {
      console.warn('[SystemSession] END_SESSION ignored — already ended');
      return;
    }
    hasEndedSessionRef.current = true;
    console.log('[SystemSurfaceInvariant] safeEndSession() called:', { shouldLaunchHome });
    dispatchSystemEvent({ type: 'END_SESSION', shouldLaunchHome });
  };

  /**
   * Set transient targetApp for finish-time navigation
   * This is NOT part of session state - only used when finishing activity
   */
  const setTransientTargetApp = (app: string | null) => {
    if (transientTargetAppRef) {
      transientTargetAppRef.current = app;
    }
  };

  /**
   * Get transient targetApp for finish-time navigation
   * This is NOT part of session state - only used when finishing activity
   */
  const getTransientTargetApp = () => {
    return transientTargetAppRef?.current ?? null;
  };

  const value: SystemSessionContextValue = {
    session: state.session,
    bootstrapState: state.bootstrapState,
    foregroundApp: state.foregroundApp,
    shouldLaunchHome: state.shouldLaunchHome,
    dispatchSystemEvent,
    safeEndSession,
    setTransientTargetApp,
    getTransientTargetApp,
  };

  return (
    <SystemSessionContext.Provider value={value}>
      {children}
    </SystemSessionContext.Provider>
  );
};
