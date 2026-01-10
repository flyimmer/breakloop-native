/**
 * System Brain Public API
 * 
 * This is the ONLY module that SystemSurface and other contexts should import from System Brain.
 * 
 * Purpose:
 * - Provides stable interface for reading System Brain state
 * - Decouples UI from System Brain's internal storage format
 * - Allows System Brain internals to refactor without breaking UI
 * 
 * Rules:
 * - Most functions are READ-ONLY (informational display only)
 * - UI must NOT make semantic decisions based on these values
 * - System Brain has already made all decisions before UI sees data
 * - Exception: setLastIntervenedApp() writes state for coordination (event-driven architecture)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTimerState, saveTimerState, setInMemoryStateCache } from './stateManager';

/**
 * DTO for Quick Task display information.
 * Simple data transfer object with no internal implementation details.
 */
export interface QuickTaskDisplayInfo {
  remaining: number;      // Number of uses remaining
  windowMinutes: number;  // Window duration in minutes
}

/**
 * Get remaining Quick Task uses for UI display.
 * 
 * IMPORTANT: This is for INFORMATIONAL DISPLAY ONLY.
 * SystemSurface must NOT make semantic decisions based on this value.
 * System Brain has already decided to show the Quick Task dialog.
 * 
 * This function abstracts away System Brain's internal storage format,
 * providing a stable interface that won't break if System Brain refactors.
 * 
 * @returns DTO with remaining uses and window duration
 */
export async function getQuickTaskRemainingForDisplay(): Promise<QuickTaskDisplayInfo> {
  try {
    // Load Quick Task config
    const configJson = await AsyncStorage.getItem('quick_task_settings_v1');
    let maxUses = 1; // Default
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (configJson) {
      const config = JSON.parse(configJson);
      maxUses = config.usesPerWindow ?? 1;
    }
    
    // Load System Brain state (internal format hidden from caller)
    const stateJson = await AsyncStorage.getItem('system_brain_state_v1');
    let usageHistory: number[] = [];
    
    if (stateJson) {
      const state = JSON.parse(stateJson);
      usageHistory = state.quickTaskUsageHistory || [];
    }
    
    // Calculate remaining uses
    const currentTimestamp = Date.now();
    const recentUsages = usageHistory.filter(
      ts => currentTimestamp - ts < windowMs
    );
    const remaining = Math.max(0, maxUses - recentUsages.length);
    const windowMinutes = Math.round(windowMs / (60 * 1000));
    
    console.log('[System Brain Public API] Quick Task remaining (display only):', {
      maxUses,
      recentUsages: recentUsages.length,
      remaining,
      windowMinutes,
    });
    
    // Return simple DTO (no internal details exposed)
    return {
      remaining,
      windowMinutes,
    };
  } catch (e) {
    console.warn('[System Brain Public API] Failed to calculate remaining uses:', e);
    // Fallback DTO
    return {
      remaining: 1,
      windowMinutes: 15,
    };
  }
}

/**
 * Set lastIntervenedApp flag in System Brain state.
 * 
 * CRITICAL: This function writes to AsyncStorage immediately and waits for completion.
 * System Brain is event-driven and loads state on each event, so we must ensure
 * the write completes BEFORE the next FOREGROUND_CHANGED event arrives.
 * 
 * Called by SystemSurface when user makes a decision that returns them to the app.
 * This flag tells System Brain to skip the next foreground event for this app
 * (it's an internal return, not a new user-initiated app open).
 * 
 * IMPORTANT: Only call this when user makes an explicit decision:
 * - User presses Quick Task button
 * - User completes intervention
 * 
 * Do NOT call this when merely showing a dialog.
 * 
 * @param packageName - App package name that user is returning to
 */
export async function setLastIntervenedApp(packageName: string): Promise<void> {
  try {
    console.log('[System Brain Public API] Setting lastIntervenedApp:', packageName);
    console.log('[System Brain Public API] Writing to AsyncStorage immediately (event-driven coordination)');
    
    // Load System Brain state
    const stateJson = await AsyncStorage.getItem('system_brain_state_v1');
    const state = stateJson ? JSON.parse(stateJson) : {};
    
    // Set the flag
    state.lastIntervenedApp = packageName;
    
    // Save updated state IMMEDIATELY (blocking write)
    // System Brain will load this on next event
    await AsyncStorage.setItem('system_brain_state_v1', JSON.stringify(state));
    
    console.log('[System Brain Public API] ✅ lastIntervenedApp persisted to AsyncStorage');
    console.log('[System Brain Public API] Next System Brain event will load this value');
  } catch (e) {
    console.error('[System Brain Public API] ❌ Failed to set lastIntervenedApp:', e);
    throw e; // Propagate error so caller knows coordination failed
  }
}

/**
 * Transition Quick Task from DECISION to ACTIVE phase.
 * This is the ONLY place where n_quickTask is decremented.
 * 
 * ⚠️ CRITICAL: Phase must be updated BEFORE any side effects.
 * This function must complete fully before calling code performs:
 * - Timer storage in native
 * - UI transitions
 * - Session ending
 * 
 * @param app - App package name
 * @param timestamp - Current timestamp
 */
export async function transitionQuickTaskToActive(
  app: string,
  timestamp: number
): Promise<void> {
  // STEP 1: Load state (authoritative source)
  const state = await loadTimerState();
  
  // STEP 2: Verify we're in DECISION phase (validation)
  if (state.quickTaskPhaseByApp[app] !== 'DECISION') {
    console.warn('[QuickTask] Transition to ACTIVE from non-DECISION phase:', {
      app,
      currentPhase: state.quickTaskPhaseByApp[app],
      note: 'This may indicate a race condition or stale state',
    });
  }
  
  // STEP 3: Set phase = ACTIVE (state mutation - FIRST)
  state.quickTaskPhaseByApp[app] = 'ACTIVE';
  
  // STEP 4: Decrement global quota (record usage - SECOND, after phase set)
  // Add to persisted usage history
  state.quickTaskUsageHistory.push(timestamp);
  console.log('[QuickTask] Quick Task usage recorded (GLOBAL, PERSISTED)', {
    app,
    timestamp,
    totalUsagesGlobal: state.quickTaskUsageHistory.length,
    note: 'Usage is GLOBAL across all apps and PERSISTED for kill-safety',
  });
  
  // STEP 5: Save state persistently (THIRD, before in-memory cache)
  await saveTimerState(state);
  
  // STEP 6: Update in-memory cache (FOURTH, after persistence)
  setInMemoryStateCache(state);
  
  // STEP 7: Log completion (informational only)
  console.log('[QuickTask] Phase transition: DECISION → ACTIVE', {
    app,
    timestamp,
    remainingUses: state.quickTaskUsageHistory.length,
    note: 'Phase and quota updated - safe to proceed with timer storage',
  });
  
  // Function returns - calling code may now safely perform side effects
}

/**
 * Clear Quick Task phase for an app.
 * Called when user chooses "Conscious Process" or when Quick Task is cancelled.
 * 
 * @param app - App package name
 */
export async function clearQuickTaskPhase(app: string): Promise<void> {
  const state = await loadTimerState();
  
  if (state.quickTaskPhaseByApp[app]) {
    delete state.quickTaskPhaseByApp[app];
    await saveTimerState(state);
    setInMemoryStateCache(state);
    
    console.log('[QuickTask] Phase cleared:', app);
  } else {
    console.log('[QuickTask] No phase to clear for:', app);
  }
}

/**
 * Get Quick Task phase for an app.
 * 
 * @param app - App package name
 * @returns Phase ('DECISION' | 'ACTIVE') or null
 */
export async function getQuickTaskPhase(app: string): Promise<'DECISION' | 'ACTIVE' | null> {
  const state = await loadTimerState();
  return state.quickTaskPhaseByApp[app] || null;
}

/**
 * Set Quick Task phase for an app (used by System Brain internally).
 * 
 * @param app - App package name
 * @param phase - Phase to set
 */
export async function setQuickTaskPhase(
  app: string,
  phase: 'DECISION' | 'ACTIVE'
): Promise<void> {
  const state = await loadTimerState();
  state.quickTaskPhaseByApp[app] = phase;
  await saveTimerState(state);
  setInMemoryStateCache(state);
  
  console.log('[QuickTask] Phase set:', { app, phase });
}
