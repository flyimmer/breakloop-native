/**
 * InterventionProvider - React Context Provider for Intervention State
 * 
 * Provides intervention state management using useReducer with the interventionReducer
 * from src/core/intervention.
 * 
 * This provider is ready but unused - it does not connect to any UI yet.
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  interventionReducer,
  createInitialInterventionContext,
} from '../core/intervention';

/**
 * Intervention context state shape
 */
interface InterventionContextValue {
  interventionState: {
    state: 'idle' | 'breathing' | 'root-cause' | 'alternatives' | 'action' | 'action_timer' | 'timer' | 'reflection';
    targetApp: any | null;
    breathingCount: number;
    selectedCauses: string[];
    selectedAlternative: any | null;
    actionTimer: number;
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

export const InterventionProvider: React.FC<InterventionProviderProps> = ({ children }) => {
  const [interventionState, dispatchIntervention] = useReducer(
    interventionReducer,
    createInitialInterventionContext() // Initial state
  );

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

