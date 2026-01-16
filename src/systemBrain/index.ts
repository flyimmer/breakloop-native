/**
 * System Brain JS - Event-Driven Headless Runtime
 * 
 * This module runs as a React Native Headless JS task.
 * It is event-driven, headless, and handles ALL semantic system logic.
 * 
 * Lifecycle:
 * - Invoked by native when mechanical events occur
 * - Recomputes state deterministically on each invocation
 * - Does NOT rely on continuous execution
 * 
 * Responsibilities:
 * - Receive mechanical events from native (timer expired, foreground changed)
 * - Classify semantic meaning (Quick Task vs Intention vs other)
 * - Evaluate OS Trigger Brain logic
 * - Decide when to launch SystemSurface
 * - NEVER render UI
 * 
 * Forbidden:
 * - UI rendering
 * - React components
 * - Depending on SystemSurface or MainApp contexts
 * - Assuming continuous execution
 */

import { AppRegistry, DeviceEventEmitter } from 'react-native';
import { handleSystemEvent, handleQuickTaskDecision, handleQuickTaskCommand, handleQuotaUpdate } from './eventHandler';
import { loadTimerState } from './stateManager';
import { syncQuotaToNative, clearSystemSurfaceActive } from './decisionEngine';

/**
 * Initialize System Brain on app startup
 * 
 * PHASE 4.1: Sync quota to Native on startup
 * 
 * This ensures Native has the correct quota cache when the app starts.
 * Must run early to prevent Native from using stale quota (default: 1).
 */
async function initializeSystemBrain() {
  try {
    console.log('[System Brain] Initializing...');
    
    // CRITICAL: Clear any stuck lifecycle flags from previous sessions
    // This ensures isSystemSurfaceActive resets to false on app startup
    clearSystemSurfaceActive();
    console.log('[System Brain] Lifecycle flags cleared');
    
    // Load current state
    const state = await loadTimerState();
    
    // Sync quota to Native
    await syncQuotaToNative(state);
    
    console.log('[System Brain] ✅ Initialization complete');
  } catch (error) {
    console.error('[System Brain] ❌ Initialization failed:', error);
  }
}

// Run initialization immediately
initializeSystemBrain();

/**
 * Register System Brain headless task.
 * 
 * IMPORTANT: We use ONLY HeadlessTask for system events to ensure
 * each event is processed exactly once (no double delivery).
 * 
 * HeadlessTask works in both foreground and background, so we don't
 * need DeviceEventEmitter as a separate path.
 * 
 * Native emits ONLY mechanical events:
 * - { type: "TIMER_EXPIRED", packageName, timestamp }
 * - { type: "TIMER_SET", packageName, timestamp, expiresAt }
 * - { type: "FOREGROUND_CHANGED", packageName, timestamp }
 * 
 * System Brain classifies semantic meaning and decides action.
 */
AppRegistry.registerHeadlessTask('SystemEvent', () => async (taskData) => {
  try {
    await handleSystemEvent(taskData);
  } catch (error) {
    console.error('[System Brain] ❌ Error processing event:', error);
  }
});

/**
 * Register Quick Task decision event listener
 * 
 * PHASE 4.1: Entry decision authority
 * 
 * Native emits QUICK_TASK_DECISION events via DeviceEventEmitter
 * when it makes an entry decision for a monitored app.
 * 
 * This is separate from HeadlessTask because it's a UI-level event
 * that needs to launch SystemSurface immediately.
 */
DeviceEventEmitter.addListener('QUICK_TASK_DECISION', (event) => {
  handleQuickTaskDecision(event).catch((error) => {
    console.error('[System Brain] ❌ Error handling Quick Task decision:', error);
  });
});

/**
 * Register Quick Task command listener
 * PHASE 4.2: Native commands, JS obeys
 */
DeviceEventEmitter.addListener('QUICK_TASK_COMMAND', (event) => {
  handleQuickTaskCommand(event).catch((error) => {
    console.error('[System Brain] ❌ Error handling Quick Task command:', error);
  });
});

/**
 * Register quota update listener
 * PHASE 4.2: Native decrements, JS displays
 */
DeviceEventEmitter.addListener('QUICK_TASK_QUOTA_UPDATE', (event) => {
  handleQuotaUpdate(event).catch((error) => {
    console.error('[System Brain] ❌ Error handling quota update:', error);
  });
});
