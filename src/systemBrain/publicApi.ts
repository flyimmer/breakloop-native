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
 * - All functions are READ-ONLY (informational display only)
 * - UI must NOT make semantic decisions based on these values
 * - System Brain has already made all decisions before UI sees data
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
