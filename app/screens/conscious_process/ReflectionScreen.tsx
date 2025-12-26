import { useIntervention } from '@/src/contexts/InterventionProvider';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * ReflectionScreen
 * 
 * Phase D: Step 8 - Reflection
 * 
 * Gravity: Reflective Closure
 * - Non-judgmental
 * - Optional
 * - Lighter than Step 7, signaling return to normal app posture
 * - No celebration, no metrics, no pressure
 * 
 * Purpose:
 * - Answers: "How did that feel?"
 * - Acknowledges the experience without evaluation
 * - Allows easy return to main app
 * 
 * Design constraints:
 * - No praise or judgment
 * - No gamification, stats, or summaries
 * - No animations or reward icons
 * - Equal visual weight for all response options
 * - Calm, minimal layout
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Reflective Closure)
 * - design/ui/tokens.md (colors, typography, spacing)
 */

type ReflectionOption = 'better' | 'neutral' | 'not-helpful' | null;

export default function ReflectionScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, selectedAlternative } = interventionState;
  const [selectedOption, setSelectedOption] = useState<ReflectionOption>(null);

  // Only render when in 'reflection' state
  if (state !== 'reflection') {
    return null;
  }

  const handleOptionPress = (option: ReflectionOption) => {
    setSelectedOption(option);
  };

  const handleFinish = () => {
    // Dispatch FINISH_REFLECTION to reset intervention to idle
    dispatchIntervention({ type: 'FINISH_REFLECTION' });
  };

  const handleSkip = () => {
    // Skip also finishes the reflection and resets to idle
    dispatchIntervention({ type: 'FINISH_REFLECTION' });
  };

  const handleClose = () => {
    // Close also finishes the reflection and resets to idle
    dispatchIntervention({ type: 'FINISH_REFLECTION' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Close button - very subtle */}
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

      {/* Central content */}
      <View style={styles.centerContainer}>
        {/* Prompt - single neutral question */}
        <Text style={styles.prompt}>How did that feel?</Text>

        {/* Response options - equal visual weight */}
        <View style={styles.optionsContainer}>
          <Pressable
            onPress={() => handleOptionPress('better')}
            style={({ pressed }) => [
              styles.optionButton,
              selectedOption === 'better' && styles.optionButtonSelected,
              pressed && styles.optionButtonPressed,
            ]}
          >
            <Text style={styles.optionEmoji}>🙂</Text>
            <Text
              style={[
                styles.optionText,
                selectedOption === 'better' && styles.optionTextSelected,
              ]}
            >
              Better
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleOptionPress('neutral')}
            style={({ pressed }) => [
              styles.optionButton,
              selectedOption === 'neutral' && styles.optionButtonSelected,
              pressed && styles.optionButtonPressed,
            ]}
          >
            <Text style={styles.optionEmoji}>😐</Text>
            <Text
              style={[
                styles.optionText,
                selectedOption === 'neutral' && styles.optionTextSelected,
              ]}
            >
              Neutral
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleOptionPress('not-helpful')}
            style={({ pressed }) => [
              styles.optionButton,
              selectedOption === 'not-helpful' && styles.optionButtonSelected,
              pressed && styles.optionButtonPressed,
            ]}
          >
            <Text style={styles.optionEmoji}>🙁</Text>
            <Text
              style={[
                styles.optionText,
                selectedOption === 'not-helpful' && styles.optionTextSelected,
              ]}
            >
              Not helpful
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom actions */}
      <View style={styles.bottomActions}>
        {/* Skip - de-emphasized */}
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.skipButtonPressed,
          ]}
          hitSlop={8}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        {/* Continue - calm, neutral */}
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Lighter than Step 7 - signaling return to normal app posture
    // Warmer than the timer screen's #0D0D0E
    backgroundColor: '#18181B', // surface - elevated but calm
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
    color: '#71717A', // textMuted - barely visible
    fontWeight: '300',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  prompt: {
    fontSize: 24, // h2
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#FAFAFA', // textPrimary
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12, // radius_12
    backgroundColor: '#27272A', // surfaceSecondary
    alignItems: 'center',
    justifyContent: 'flex-start', // Align from top to keep emojis aligned
    minHeight: 96, // Fixed height to accommodate two-line text
    // Subtle border for definition
    borderWidth: 1,
    borderColor: '#3F3F46', // border
  },
  optionButtonSelected: {
    backgroundColor: '#27272A', // Same background - no celebration
    borderColor: '#6B5FC9', // primaryMuted - calm indication of selection
  },
  optionButtonPressed: {
    opacity: 0.7,
  },
  optionEmoji: {
    fontSize: 28, // Equal size for all emojis - neutral visual weight
    marginTop: 8, // Consistent top spacing
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14, // bodySecondary
    lineHeight: 20,
    fontWeight: '400',
    color: '#A1A1AA', // textSecondary
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#FAFAFA', // textPrimary - slightly brighter when selected
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonPressed: {
    opacity: 0.6,
  },
  skipText: {
    fontSize: 14, // bodySecondary
    lineHeight: 20,
    fontWeight: '400',
    color: '#71717A', // textMuted - very quiet
  },
  continueButton: {
    paddingVertical: 14, // Slightly smaller than standard primary (16)
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    // More muted than standard primary - reflection choices are more important
    backgroundColor: '#52478F', // Darker, less saturated than primaryMuted (#6B5FC9)
    // No elevation - flatter to reduce dominance
  },
  continueButtonPressed: {
    opacity: 0.85,
  },
  continueButtonText: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '500', // Lighter weight (was 600)
    color: '#E4E4E7', // Slightly less bright than textPrimary (#FAFAFA)
  },
});

