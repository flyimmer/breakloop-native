/**
 * QuickTaskProvider - React Context Provider for Quick Task State
 * 
 * Manages Quick Task decision screen state independently from intervention flow.
 * Quick Task is a pre-intervention decision layer with higher priority.
 * 
 * Architecture:
 * - Quick Task state is separate from intervention state
 * - Quick Task is checked BEFORE intervention starts
 * - User can choose "Quick Task" (bypass) or "Continue" (start intervention)
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

/**
 * Quick Task state shape
 */
interface QuickTaskState {
  visible: boolean;           // Whether Quick Task decision screen is visible
  targetApp: string | null;   // App that triggered Quick Task
  remaining: number;          // Number of Quick Task uses remaining (global)
  showExpired: boolean;       // Whether to show Quick Task expired screen
  expiredApp: string | null;  // App whose Quick Task expired
}

/**
 * Quick Task context value
 */
interface QuickTaskContextValue {
  quickTaskState: QuickTaskState;
  dispatchQuickTask: (action: QuickTaskAction) => void;
}

/**
 * Quick Task actions
 */
type QuickTaskAction =
  | { type: 'SHOW_QUICK_TASK'; app: string; remaining: number }
  | { type: 'HIDE_QUICK_TASK' }
  | { type: 'ACTIVATE_QUICK_TASK' }
  | { type: 'DECLINE_QUICK_TASK' }
  | { type: 'SHOW_EXPIRED'; app: string }
  | { type: 'HIDE_EXPIRED' };

/**
 * Initial Quick Task state
 */
const initialQuickTaskState: QuickTaskState = {
  visible: false,
  targetApp: null,
  remaining: 0,
  showExpired: false,
  expiredApp: null,
};

/**
 * Quick Task reducer
 */
function quickTaskReducer(state: QuickTaskState, action: QuickTaskAction): QuickTaskState {
  switch (action.type) {
    case 'SHOW_QUICK_TASK':
      return {
        visible: true,
        targetApp: action.app,
        remaining: action.remaining,
        showExpired: false,
        expiredApp: null,
      };

    case 'HIDE_QUICK_TASK':
      return {
        visible: false,
        targetApp: null,
        remaining: 0,
        showExpired: false,
        expiredApp: null,
      };

    case 'ACTIVATE_QUICK_TASK':
      // User chose Quick Task - hide the screen
      // Actual Quick Task logic (timer, usage) handled by caller
      return {
        visible: false,
        targetApp: null,
        remaining: 0,
        showExpired: false,
        expiredApp: null,
      };

    case 'DECLINE_QUICK_TASK':
      // User chose to continue with intervention - hide the screen
      // Intervention will be started by caller
      return {
        visible: false,
        targetApp: null,
        remaining: 0,
        showExpired: false,
        expiredApp: null,
      };

    case 'SHOW_EXPIRED':
      // Quick Task timer expired - show expired screen
      return {
        visible: false,
        targetApp: null,
        remaining: 0,
        showExpired: true,
        expiredApp: action.app,
      };

    case 'HIDE_EXPIRED':
      // User acknowledged expired screen - hide it
      return {
        visible: false,
        targetApp: null,
        remaining: 0,
        showExpired: false,
        expiredApp: null,
      };

    default:
      return state;
  }
}

/**
 * Quick Task Context
 */
const QuickTaskContext = createContext<QuickTaskContextValue | null>(null);

/**
 * Hook to access Quick Task context
 */
export const useQuickTask = (): QuickTaskContextValue => {
  const context = useContext(QuickTaskContext);
  if (!context) {
    throw new Error('useQuickTask must be used within QuickTaskProvider');
  }
  return context;
};

/**
 * Quick Task Provider Component
 */
interface QuickTaskProviderProps {
  children: ReactNode;
}

export const QuickTaskProvider: React.FC<QuickTaskProviderProps> = ({ children }) => {
  const [quickTaskState, dispatchQuickTask] = useReducer(quickTaskReducer, initialQuickTaskState);

  return (
    <QuickTaskContext.Provider value={{ quickTaskState, dispatchQuickTask }}>
      {children}
    </QuickTaskContext.Provider>
  );
};

