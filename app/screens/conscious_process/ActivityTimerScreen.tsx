import { useIntervention } from '@/src/contexts/InterventionProvider';
import {
  formatTimerDisplay,
  isActionTimerComplete,
  shouldTickActionTimer,
} from '@/src/core/intervention';
import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * ActivityTimerScreen
 * 
 * Phase D: Step 7 - Activity Timer
 * 
 * Gravity: Execution with Minimal Presence
 * - Quieter than all previous screens
 * - UI recedes to encourage putting phone down
 * - Timer is the only prominent element
 * - No celebration, no motivation, no noise
 * 
 * Purpose:
 * - Answers: "Can I stop interacting with my phone and do the activity now?"
 * - Supports absence
 * - Provides minimal control without temptation
 * 
 * Timer behavior:
 * - Starts automatically when interventionState transitions to "action_timer"
 * - Counts down to 0 via reducer/state updates
 * - Timer ticks once per second via ACTION_TIMER_TICK dispatch
 * - Automatically transitions to "reflection" when timer reaches 0
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Execution with Minimal Presence)
 * - design/ui/tokens.md (colors, typography, spacing)
 * - design/ui/screens.md (Activity Timer Screen spec)
 */

// Mock settings value (TODO: connect to actual settings)
const SHARE_CURRENT_ACTIVITY_ENABLED = false;

// Visibility options
type VisibilityOption = 'Private' | 'Friends can ask to join' | 'Anyone can ask to join';

export default function ActivityTimerScreen() {
  // Intervention state from context
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, selectedAlternative, actionTimer } = interventionState;

  // Visibility state (defaults based on settings)
  // IMPORTANT: Must be declared BEFORE early return to avoid React hooks violation
  const [visibility, setVisibility] = useState<VisibilityOption>(
    SHARE_CURRENT_ACTIVITY_ENABLED ? 'Anyone can ask to join' : 'Private'
  );

  // Disable Android hardware back button during intervention
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // User must use the "Finish" or "Go back" buttons to navigate
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Action timer countdown - dispatch ACTION_TIMER_TICK every second
  // IMPORTANT: Must be declared BEFORE early return to avoid React hooks violation
  useEffect(() => {
    // Only tick if we're in action_timer state and timer > 0
    if (!shouldTickActionTimer(state, actionTimer)) {
      return;
    }

    // Set up 1-second interval to decrement timer
    const timer = setInterval(() => {
      dispatchIntervention({ type: 'ACTION_TIMER_TICK' });
    }, 1000);

    // Cleanup interval on unmount or state change
    return () => clearInterval(timer);
  }, [state, actionTimer, dispatchIntervention]);

  // Auto-complete when timer reaches 0
  // IMPORTANT: Must be declared BEFORE early return to avoid React hooks violation
  useEffect(() => {
    if (isActionTimerComplete(state, actionTimer)) {
      // Dispatch FINISH_ACTION to transition to reflection
      dispatchIntervention({ type: 'FINISH_ACTION' });
    }
  }, [state, actionTimer, dispatchIntervention]);

  // Only render when in 'action_timer' state
  if (state !== 'action_timer' || !selectedAlternative) {
    return null;
  }

  // Extract activity data from selectedAlternative
  const activityTitle = selectedAlternative.title || 'Activity';
  const activityDuration = selectedAlternative.duration || '5m';
  const activitySteps = selectedAlternative.actions || selectedAlternative.steps || [];

  // Derived state
  const isTimerActive = actionTimer > 0;
  const timerDisplay = formatTimerDisplay(actionTimer);

  // Manual completion handler
  const handleEndActivity = () => {
    // Dispatch FINISH_ACTION to transition to reflection
    dispatchIntervention({ type: 'FINISH_ACTION' });
  };

  const handleFinishAndReflect = () => {
    // Same as handleEndActivity - both transition to reflection
    dispatchIntervention({ type: 'FINISH_ACTION' });
  };

  const handleClose = () => {
    console.log('Close');
    // TODO: Navigate back (with confirmation?)
    // Note: Closing during timer is not recommended per design, but keeping handler for future use
  };

  const handleVisibilityPress = () => {
    console.log('Open visibility selector');
    // TODO: Open bottom sheet or inline selector with options:
    // - Private
    // - Friends can ask to join
    // - Anyone can ask to join
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Close button - very low emphasis */}
      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          hitSlop={12}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Central timer area */}
      <View style={styles.centerContainer}>
        {/* Activity context (very quiet) */}
        <View style={styles.activityContext}>
          <Text style={styles.activityTitle}>{activityTitle}</Text>
          <Text style={styles.activityDuration}>{activityDuration}</Text>
        </View>

        {/* Action steps (quiet reminder) */}
        {activitySteps && activitySteps.length > 0 && (
          <View style={styles.stepsContainer}>
            {activitySteps.map((step: string, index: number) => (
              <View key={index} style={styles.stepItem}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Timer (primary element) */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerDisplay}>{timerDisplay}</Text>
        </View>
      </View>

      {/* Bottom control area */}
      <View style={styles.bottomActions}>
        {/* Visibility control (quiet metadata) */}
        <Pressable
          onPress={handleVisibilityPress}
          style={({ pressed }) => [
            styles.visibilityControl,
            pressed && styles.visibilityControlPressed,
          ]}
          hitSlop={8}
        >
          <Text style={styles.visibilityLabel}>Visibility · </Text>
          <Text style={styles.visibilityValue}>{visibility}</Text>
        </Pressable>

        {/* Single primary control - label changes based on timer state */}
        <Pressable
          onPress={isTimerActive ? handleEndActivity : handleFinishAndReflect}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isTimerActive ? 'End activity' : 'Finish & reflect'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Softer than Step 6B, but still low-stimulation
    // Slightly warmer than pure black to reduce harshness
    backgroundColor: '#0D0D0E', // Between #0A0A0B and #0F0F10
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  closeButtonPressed: {
    opacity: 0.5,
  },
  closeButtonText: {
    fontSize: 24,
    // Even more receded than Step 6B
    color: '#71717A', // textMuted - barely visible
    fontWeight: '300',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  activityContext: {
    alignItems: 'center',
    marginBottom: 48,
  },
  activityTitle: {
    fontSize: 20, // Smaller than Step 6B (was 32)
    lineHeight: 28,
    fontWeight: '500', // Lighter weight
    letterSpacing: -0.3,
    color: '#A1A1AA', // textSecondary - recedes into background
    marginBottom: 4,
  },
  activityDuration: {
    fontSize: 14, // bodySmall
    lineHeight: 20,
    fontWeight: '400',
    color: '#71717A', // textMuted - very quiet
  },
  stepsContainer: {
    marginTop: 24,
    marginBottom: 40,
    alignSelf: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14, // bodySmall
    lineHeight: 20,
    fontWeight: '400',
    color: '#71717A', // textMuted - same as duration, very quiet
    minWidth: 20,
    textAlign: 'right',
    marginRight: 8,
  },
  stepText: {
    fontSize: 14, // bodySmall
    lineHeight: 20,
    fontWeight: '400',
    color: '#71717A', // textMuted - same as duration, very quiet
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDisplay: {
    // Large, calm, centered - the brightest element on screen
    fontSize: 72, // Even larger than breathing screen for clarity at a glance
    lineHeight: 84,
    fontWeight: '300', // Light weight for calm presence
    letterSpacing: -1,
    color: '#FAFAFA', // textPrimary - brightest element
    // Tabular numbers for consistent width during countdown
    fontVariant: ['tabular-nums'],
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  visibilityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  visibilityControlPressed: {
    opacity: 0.6,
  },
  visibilityLabel: {
    fontSize: 13, // Smaller than bodySmall
    lineHeight: 18,
    fontWeight: '400',
    color: '#71717A', // textMuted - very quiet
  },
  visibilityValue: {
    fontSize: 13, // Smaller than bodySmall
    lineHeight: 18,
    fontWeight: '400',
    color: '#A1A1AA', // textSecondary - slightly more visible than label
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    // Same calm, non-celebratory color as Step 6B
    // No color change between states - this is a control, not a reward
    backgroundColor: '#6B5FC9', // primaryMuted
    // Minimal elevation
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '600',
    color: '#FAFAFA', // textPrimary
  },
});

