import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
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
 * - Starts automatically on mount
 * - Counts down to 0
 * - Continues running even if app goes to background
 * - Uses timestamp-based calculation for accuracy
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Execution with Minimal Presence)
 * - design/ui/tokens.md (colors, typography, spacing)
 * - design/ui/screens.md (Activity Timer Screen spec)
 */

// Placeholder data (TODO: accept as route params)
const PLACEHOLDER_ACTIVITY = {
  title: 'Short walk',
  durationSeconds: 10, // Duration in seconds (for testing; use durationMinutes for production)
  steps: [
    'Put on shoes',
    'Step outside',
    'Walk around block',
  ],
};

// Mock settings value (TODO: connect to actual settings)
const SHARE_CURRENT_ACTIVITY_ENABLED = false;

// Visibility options
type VisibilityOption = 'Private' | 'Friends can ask to join' | 'Anyone can ask to join';

/**
 * Formats seconds into MM:SS format
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function ActivityTimerScreen() {
  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    PLACEHOLDER_ACTIVITY.durationSeconds
  );
  
  // Store start time for accurate calculation across app lifecycle
  const startTimeRef = useRef<number>(Date.now());
  const totalDurationRef = useRef<number>(PLACEHOLDER_ACTIVITY.durationSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Visibility state (defaults based on settings)
  const [visibility, setVisibility] = useState<VisibilityOption>(
    SHARE_CURRENT_ACTIVITY_ENABLED ? 'Anyone can ask to join' : 'Private'
  );
  // Timer logic
  useEffect(() => {
    // Start countdown timer
    intervalRef.current = setInterval(() => {
      // Calculate elapsed time since start
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const newRemainingSeconds = Math.max(0, totalDurationRef.current - elapsedSeconds);
      
      setRemainingSeconds(newRemainingSeconds);
      
      // Stop timer when it reaches 0
      if (newRemainingSeconds === 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Recalculate remaining time when app returns to foreground
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const newRemainingSeconds = Math.max(0, totalDurationRef.current - elapsedSeconds);
        setRemainingSeconds(newRemainingSeconds);
        
        // If timer completed while in background, ensure interval is stopped
        if (newRemainingSeconds === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Derived state
  const isTimerActive = remainingSeconds > 0;
  const timerDisplay = formatTime(remainingSeconds);
  
  // Navigation handlers (stubbed for now)
  const handleEndActivity = () => {
    // Stop timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    console.log('End activity early');
    // TODO: Navigate to reflection screen
  };

  const handleFinishAndReflect = () => {
    console.log('Finish and reflect');
    // TODO: Navigate to reflection screen
  };

  const handleClose = () => {
    // Stop timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    console.log('Close');
    // TODO: Navigate back (with confirmation?)
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
          <Text style={styles.activityTitle}>{PLACEHOLDER_ACTIVITY.title}</Text>
          <Text style={styles.activityDuration}>
            {PLACEHOLDER_ACTIVITY.durationSeconds}s
          </Text>
        </View>

        {/* Action steps (quiet reminder) */}
        {PLACEHOLDER_ACTIVITY.steps && PLACEHOLDER_ACTIVITY.steps.length > 0 && (
          <View style={styles.stepsContainer}>
            {PLACEHOLDER_ACTIVITY.steps.map((step, index) => (
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

