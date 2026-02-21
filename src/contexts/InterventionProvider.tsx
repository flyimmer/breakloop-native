/**
 * InterventionProvider - React Context Provider for Intervention State
 * 
 * Provides intervention state management using useReducer with the interventionReducer
 * from src/core/intervention.
 * 
 * This provider is ready but unused - it does not connect to any UI yet.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useReducer, useRef } from 'react';
import {
  createInitialInterventionContext,
  interventionReducer,
} from '../core/intervention';
import { setInterventionPreserved } from '../systemBrain/nativeBridge';

/**
 * Intervention context state shape
 */
interface InterventionContextValue {
  interventionState: {
    state: 'idle' | 'breathing' | 'root-cause' | 'alternatives' | 'action' | 'action_timer' | 'timer' | 'reflection';
    targetApp: any | null;
    /** Category of the app that triggered the current intervention. Null when idle. */
    triggerAppCategory: 'social' | 'video' | 'other' | null;
    breathingCount: number;
    selectedCauses: string[];
    selectedAlternative: any | null;
    actionTimer: number;
    intentionTimerSet?: boolean;
    wasCompleted?: boolean;
    wasCancelled?: boolean;
    resetReason?: string | null;
  };
  dispatchIntervention: (action: any) => void;
}

/**
 * Intervention Context
 * Provides:
 * - interventionState: Current intervention state object
 * - dispatchIntervention: Dispatch function for intervention actions
 */
const InterventionContext = createContext<InterventionContextValue | null>(null);

/**
 * Hook to access intervention context
 * @returns {InterventionContextValue} { interventionState, dispatchIntervention }
 * @throws {Error} If used outside InterventionProvider
 */
export const useIntervention = (): InterventionContextValue => {
  const context = useContext(InterventionContext);
  if (!context) {
    throw new Error('useIntervention must be used within InterventionProvider');
  }
  return context;
};

/**
 * InterventionProvider Component
 * 
 * Manages intervention state using useReducer with interventionReducer.
 * Initial state is created using createInitialInterventionContext().
 * 
 * @param {Object} props - React props
 * @param {ReactNode} props.children - Child components
 */
interface InterventionProviderProps {
  children: ReactNode;
}


// ... existing imports

export const InterventionProvider: React.FC<InterventionProviderProps> = ({ children }) => {
  const [interventionState, dispatchIntervention] = useReducer(
    interventionReducer,
    createInitialInterventionContext() // Initial state
  );

  const { state, targetApp, actionTimer } = interventionState as any;
  const prevStateRef = useRef(state);

  // V3: Preservation Side Effects
  useEffect(() => {
    const handlePreservation = async () => {
      const prevState = prevStateRef.current;

      // Entering ACTION_TIMER -> Preserve & Snapshot
      if (state === 'action_timer' && prevState !== 'action_timer' && targetApp) {
        console.log('[InterventionProvider] Entering action_timer - preserving state for', targetApp);

        // 1. Tell Native to preserve this app's intervention
        setInterventionPreserved(targetApp, true);

        // 2. Save snapshot (Time-based)
        const snapshot = {
          state: 'action_timer',
          duration: actionTimer, // Total duration
          startedAt: Date.now(),
          targetApp
        };
        await AsyncStorage.setItem(`intervention_snapshot_${targetApp}`, JSON.stringify(snapshot));
      }

      // Exiting ACTION_TIMER -> Clear Preservation
      if (prevState === 'action_timer' && state !== 'action_timer' && targetApp) {
        console.log('[InterventionProvider] Exiting action_timer - clearing preservation for', targetApp);

        setInterventionPreserved(targetApp, false);
        await AsyncStorage.removeItem(`intervention_snapshot_${targetApp}`);
      }

      prevStateRef.current = state;
    };

    handlePreservation();
  }, [state, targetApp, actionTimer]);

  const value: InterventionContextValue = {
    interventionState: interventionState as InterventionContextValue['interventionState'],
    dispatchIntervention,
  };

  return (
    <InterventionContext.Provider value={value}>
      {children}
    </InterventionContext.Provider>
  );
};

