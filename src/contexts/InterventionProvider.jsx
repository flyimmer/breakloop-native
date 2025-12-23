/**
 * InterventionProvider - React Context Provider for Intervention State
 * 
 * Provides intervention state management using useReducer with the interventionReducer
 * from src/core/intervention.
 * 
 * This provider is ready but unused - it does not connect to any UI yet.
 */

import React, { createContext, useContext, useReducer } from 'react';
import {
  interventionReducer,
  createInitialInterventionContext,
} from '../core/intervention';

/**
 * Intervention Context
 * Provides:
 * - interventionState: Current intervention state object
 * - dispatchIntervention: Dispatch function for intervention actions
 */
const InterventionContext = createContext(null);

/**
 * Hook to access intervention context
 * @returns {Object} { interventionState, dispatchIntervention }
 * @throws {Error} If used outside InterventionProvider
 */
export const useIntervention = () => {
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
 * @param {React.ReactNode} props.children - Child components
 */
export const InterventionProvider = ({ children }) => {
  const [interventionState, dispatchIntervention] = useReducer(
    interventionReducer,
    createInitialInterventionContext() // Initial state
  );

  const value = {
    interventionState,
    dispatchIntervention,
  };

  return (
    <InterventionContext.Provider value={value}>
      {children}
    </InterventionContext.Provider>
  );
};

