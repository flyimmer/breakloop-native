import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { canProceedToAlternatives } from '@/src/core/intervention';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/RootNavigator';

/**
 * RootCauseScreen
 * 
 * Phase D: Static Intervention → Root Cause Selection step
 * 
 * Gravity: Reflective Float
 * - Reflection without commitment
 * - No bottom-anchored primary CTA
 * - Even visual weight across options
 * - Generous spacing
 * - Calm, non-urgent language
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Reflective Float)
 * - design/ui/tokens.md (colors, typography, spacing, elevation)
 * - design/ui/tone-ambient-hearth.md (calm, soft, depth via elevation)
 */

// Canonical causes (exact wording from requirements)
const CAUSES = [
  { id: 'boredom', label: 'Boredom' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'loneliness', label: 'Loneliness' },
  { id: 'self-doubt', label: 'Self-doubt' },
  { id: 'no-goal', label: 'No clear goal' },
] as const;

export default function RootCauseScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { selectedCauses } = interventionState;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Check if cause is selected (from intervention context)
  const isCauseSelected = (causeId: string) => {
    return selectedCauses.includes(causeId);
  };

  // Toggle cause selection using intervention reducer
  const handleToggleCause = (causeId: string) => {
    if (isCauseSelected(causeId)) {
      dispatchIntervention({ type: 'DESELECT_CAUSE', causeId });
    } else {
      dispatchIntervention({ type: 'SELECT_CAUSE', causeId });
    }
  };

  // Proceed to alternatives (only if causes are selected)
  const handleContinue = () => {
    if (canProceedToAlternatives(interventionState)) {
      dispatchIntervention({ type: 'PROCEED_TO_ALTERNATIVES' });
    }
  };

  // Navigate to intention timer (user chose "I really need to use it")
  const handleNeedToUseIt = () => {
    dispatchIntervention({ type: 'PROCEED_TO_TIMER' });
  };

  // Cancel intervention and return to idle
  const handleCancel = () => {
    dispatchIntervention({ type: 'RESET_INTERVENTION' });
  };

  const hasSelection = selectedCauses.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Close/Cancel button */}
      <View style={styles.header}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          hitSlop={12}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Content vertically centered (upper-mid) */}
      <View style={styles.contentContainer}>
        {/* Prompt text: short, neutral, non-judgmental */}
        <Text style={styles.promptText}>What's driving this urge?</Text>

        {/* Cause cards: multi-select, equal visual weight */}
        <View style={styles.causesGrid}>
          {CAUSES.map((cause, index) => {
            const isSelected = isCauseSelected(cause.id);
            return (
              <Pressable
                key={cause.id}
                onPress={() => handleToggleCause(cause.id)}
                style={({ pressed }) => [
                  styles.causeCard,
                  isSelected && styles.causeCardSelected,
                  pressed && styles.causeCardPressed,
                  // Add right margin to left column cards (even indices)
                  index % 2 === 0 && styles.causeCardLeft,
                  // Add bottom margin to all but last row
                  index < CAUSES.length - 2 && styles.causeCardNotLastRow,
                ]}
              >
                <Text style={[
                  styles.causeLabel,
                  !isSelected && styles.causeLabelUnselected,
                ]}>
                  {cause.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Continue action: calm, secondary presence, NOT bottom-anchored */}
        <View style={styles.actionContainer}>
          <Pressable
            onPress={handleContinue}
            disabled={!hasSelection}
            style={({ pressed }) => [
              styles.continueButton,
              !hasSelection && styles.continueButtonDisabled,
              pressed && hasSelection && styles.continueButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.continueButtonText,
                !hasSelection && styles.continueButtonTextDisabled,
              ]}
            >
              See alternatives
            </Text>
          </Pressable>

          {/* New option: "I really need to use it" - navigates to IntentionTimer (de-emphasized, secondary) */}
          <Pressable
            onPress={handleNeedToUseIt}
            style={({ pressed }) => [
              styles.needToUseText,
              pressed && styles.needToUseTextPressed,
            ]}
          >
            <Text style={styles.needToUseTextLabel}>I really need to use it</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // tokens: background (dark mode)
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // tokens: surfaceGlass
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeButtonText: {
    fontSize: 18,
    lineHeight: 24,
    color: '#FAFAFA', // tokens: textPrimary
    fontWeight: '300',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24, // tokens: space_24
    paddingTop: 120, // Increased quiet space above (gentle pause)
    paddingBottom: 24, // tokens: space_24
    justifyContent: 'flex-start', // Cluster sits below center
  },
  promptText: {
    fontSize: 20, // tokens: h3.fontSize
    lineHeight: 28, // tokens: h3.lineHeight
    fontWeight: '600', // tokens: h3.fontWeight
    letterSpacing: -0.2, // tokens: h3.letterSpacing
    color: '#A1A1AA', // tokens: textSecondary (reduced dominance)
    textAlign: 'center',
    marginBottom: 32, // tokens: space_32 (cluster cohesion)
  },
  causesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 40, // tokens: space_40
  },
  causeCard: {
    width: '48%', // 2-column grid (48% + 48% + 4% gap = 100%)
    paddingVertical: 20, // tokens: space_20
    paddingHorizontal: 12, // tokens: space_12
    backgroundColor: '#18181B', // tokens: surface
    borderRadius: 16, // tokens: radius_16 (soft containment)
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7, // Unselected cards recede slightly
    // Minimal elevation for unselected (calm, receded)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  causeCardLeft: {
    marginRight: '4%', // Gap between columns
  },
  causeCardNotLastRow: {
    marginBottom: 12, // tokens: space_12 (gap between rows)
  },
  causeCardSelected: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // tokens: surfaceGlass (closer, more present)
    opacity: 1, // Full presence when selected
    // elevation_3 (dark mode) - selected card feels closer
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  causeCardPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  causeLabel: {
    fontSize: 16, // tokens: body.fontSize
    lineHeight: 24, // tokens: body.lineHeight
    fontWeight: '500', // Slightly emphasized for readability
    letterSpacing: 0, // tokens: body.letterSpacing
    color: '#FAFAFA', // tokens: textPrimary (selected state)
    textAlign: 'center',
  },
  causeLabelUnselected: {
    color: '#71717A', // tokens: textMuted (unselected state)
  },
  actionContainer: {
    alignItems: 'center',
    marginTop: 8, // tokens: space_8 (NOT bottom-anchored, flows with content)
  },
  continueButton: {
    paddingVertical: 12, // tokens: space_12 (secondary presence, not prominent)
    paddingHorizontal: 32, // tokens: space_32
    backgroundColor: '#27272A', // tokens: surfaceSecondary (calm, secondary)
    borderRadius: 8, // tokens: radius_8
    // elevation_1 (dark mode) - subtle, not dominant
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16, // tokens: space_16 (spacing between buttons)
  },
  continueButtonDisabled: {
    opacity: 0.4, // tokens: opacity_disabled
  },
  continueButtonPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  continueButtonText: {
    fontSize: 16, // tokens: button.fontSize
    lineHeight: 24, // tokens: button.lineHeight
    fontWeight: '500', // tokens: button.fontWeight
    letterSpacing: 0.1, // tokens: button.letterSpacing
    color: '#8B7AE8', // tokens: primary (calm but present)
  },
  continueButtonTextDisabled: {
    color: '#71717A', // tokens: textMuted
  },
  needToUseText: {
    paddingVertical: 4, // Minimal touch target only
    paddingHorizontal: 8,
    marginTop: 8, // tokens: space_8 (spacing from main CTA)
  },
  needToUseTextPressed: {
    opacity: 0.5, // Very subtle feedback (lower contrast)
  },
  needToUseTextLabel: {
    fontSize: 13, // Slightly smaller than bodySecondary
    lineHeight: 18,
    fontWeight: '400', // Regular weight (not emphasized)
    letterSpacing: 0,
    color: '#52525B', // Lower contrast than textMuted (clearly secondary)
  },
});

