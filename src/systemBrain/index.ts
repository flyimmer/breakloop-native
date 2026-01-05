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

import { AppRegistry } from 'react-native';
import { handleSystemEvent } from './eventHandler';

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
  console.log('[System Brain] Event received (HeadlessTask):', taskData);
  
  try {
    await handleSystemEvent(taskData);
  } catch (error) {
    console.error('[System Brain] Error processing event:', error);
  }
});

console.log('[System Brain] Headless JS task registered (single event path)');
