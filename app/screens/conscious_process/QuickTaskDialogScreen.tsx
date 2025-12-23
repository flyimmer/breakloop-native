import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * QuickTaskDialogScreen
 * 
 * Phase C/D: Quick Task Gate
 * 
 * Gravity: Pause Moment (Full-screen Interruption)
 * - Full-screen takeover (not a modal card)
 * - Dark, low-stimulation background (matches other interruption screens)
 * - Calm, neutral presentation
 * - Conscious process is the PRIMARY path (encouraged)
 * - Quick Task is SECONDARY (exceptional, but allowed)
 * - No guilt, no warnings - just clear hierarchy
 * 
 * Purpose:
 * - Answers: "Do I need the full process, or is this truly urgent?"
 * - Default path: conscious process
 * - Exception path: Quick Task (with clear limits)
 * - User autonomy preserved
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Pause Moment)
 * - design/ui/tokens.md (colors, typography, spacing, elevation)
 * - design/ui/screens.md (Quick Task Dialog spec)
 * - design/ux/states.md (Quick Task System)
 */

// Placeholder data for static implementation
const PLACEHOLDER_DATA = {
  appName: 'Instagram',
  quickTaskRemaining: 1,
  quickTaskWindow: 15, // minutes
};

export default function QuickTaskDialogScreen() {
  // Navigation handlers (stubbed for now)
  const handleConsciousProcess = () => {
    console.log('Go through conscious process');
    // TODO: Navigate to breathing screen (start full intervention)
  };

  const handleQuickTask = () => {
    console.log('Quick Task selected');
    // TODO: Activate quick task and unlock app
  };

  const handleClose = () => {
    console.log('Close dialog');
    // TODO: Dismiss dialog, return to launcher (app doesn't launch)
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Close button */}
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

      {/* Content - vertically centered */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.overlineText}>QUICK TASK</Text>
          <Text style={styles.titleText}>Quick, necessary task?</Text>
        </View>

        {/* Usage limit info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {PLACEHOLDER_DATA.quickTaskRemaining} left in this {PLACEHOLDER_DATA.quickTaskWindow}-minute window.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* PRIMARY ACTION: Conscious Process */}
          <Pressable
            onPress={handleConsciousProcess}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Start conscious process</Text>
          </Pressable>

          {/* SECONDARY ACTION: Quick Task */}
          <Pressable
            onPress={handleQuickTask}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Quick Task</Text>
          </Pressable>
        </View>

        {/* Explanatory text */}
        <View style={styles.footnoteSection}>
          <Text style={styles.footnoteText}>
            Quick tasks skip the full intervention for urgent moments and expire automatically.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // tokens: background (dark mode) - matches other interruption screens
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
    opacity: 0.6,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#A1A1AA', // textSecondary - visually recedes
    fontWeight: '300',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 16,
    alignItems: 'center',
  },
  overlineText: {
    fontSize: 12, // caption
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: '#A1A1AA', // textSecondary
    marginBottom: 8,
  },
  titleText: {
    fontSize: 24, // h2
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#FAFAFA', // textPrimary
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 32,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14, // bodySecondary
    lineHeight: 20,
    fontWeight: '400',
    color: '#A1A1AA', // textSecondary - informational, not threatening
    textAlign: 'center',
  },
  actionsSection: {
    gap: 12,
    marginBottom: 16,
  },
  // PRIMARY BUTTON: Conscious Process
  // - Calm, steady accent color (slightly muted compared to main app)
  // - Placed ABOVE Quick Task
  // - Clear affordance as the default path
  // - Feels intentional, not exciting
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6558B8', // Further reduced saturation (~7% darker) - steady, default, not promotional
    // elevation_1 (subtle presence)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontSize: 16, // button
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: '#FAFAFA', // textPrimary - clear, readable
  },
  // SECONDARY BUTTON: Quick Task
  // - Neutral surface color (dark gray)
  // - No accent color
  // - Placed BELOW conscious process
  // - Lower contrast, no elevation
  // - No energetic styling
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272A', // surfaceSecondary - neutral, subtle
    borderWidth: 1,
    borderColor: '#3F3F46', // border - minimal emphasis
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    fontSize: 16, // button
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: '#A1A1AA', // textSecondary - lower contrast than primary
  },
  footnoteSection: {
    alignItems: 'center',
  },
  footnoteText: {
    fontSize: 12, // caption
    lineHeight: 16,
    fontWeight: '400',
    color: '#71717A', // textMuted - informational only
    textAlign: 'center',
  },
});

