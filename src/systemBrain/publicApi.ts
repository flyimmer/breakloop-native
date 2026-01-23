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

    // Return simple DTO (no internal details exposed)
    return {
      remaining,
      windowMinutes,
    };
  } catch (e) {
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
    // Load System Brain state
    const stateJson = await AsyncStorage.getItem('system_brain_state_v1');
    const state = stateJson ? JSON.parse(stateJson) : {};

    // Set the flag
    state.lastIntervenedApp = packageName;

    // Save updated state IMMEDIATELY (blocking write)
    // System Brain will load this on next event
    await AsyncStorage.setItem('system_brain_state_v1', JSON.stringify(state));
  } catch (e) {
    throw e; // Propagate error so caller knows coordination failed
  }
}

/*
DISABLED: transitionQuickTaskToActive
Native now owns phase transitions and quota decrements

export async function transitionQuickTaskToActive(
  app: string,
  timestamp: number
): Promise<void> {
  // ...
}
*/

// ============================================================================
// PHASE 4.2: JS TIMER/PHASE LOGIC DISABLED
// Native now owns Quick Task ACTIVE phase, timers, and state machine
// This code is kept for reference but must NOT be used for new Quick Task flows
//
// JS must never:
// - start timers
// - stop timers
// - decrement quota (Native does this atomically)
// - infer ACTIVE / POST_CHOICE
// - suppress dialogs
// - decide expiration
//
// JS only:
// - renders UI when instructed by Native commands
// - sends user intent events to Native
// ============================================================================

/*
DISABLED: clearQuickTaskPhase
Native now manages phase transitions

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
*/

/*
DISABLED: getQuickTaskPhase
Native now owns phase state

export async function getQuickTaskPhase(app: string): Promise<'DECISION' | 'ACTIVE' | null> {
  const state = await loadTimerState();
  return state.quickTaskPhaseByApp[app] || null;
}
*/

/*
DISABLED: setQuickTaskPhase
Native now owns phase transitions

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
*/

// ============================================================================
// END DISABLED CODE
// ============================================================================
