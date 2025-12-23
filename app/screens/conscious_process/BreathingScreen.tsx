import { useIntervention } from '@/src/contexts/InterventionProvider';
import { shouldTickBreathing } from '@/src/core/intervention';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * BreathingScreen
 * 
 * Phase D: Static Intervention → Breathing step
 * 
 * Gravity: Regulation Anchor
 * - Single focal element (breathing number)
 * - Centered visual gravity
 * - No CTAs, no instructional text, no close button
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Regulation Anchor)
 * - design/ui/tokens.md (colors, typography, spacing, elevation, motion)
 * - design/ui/tone-ambient-hearth.md (calm, soft, depth via elevation)
 */
export default function BreathingScreen() {
  // Intervention state from context
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, breathingCount } = interventionState;

  // Soft breathing animation (opacity-based, organic feel)
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Continuous breathing rhythm animation
  useEffect(() => {
    // Continuous breathing rhythm using opacity
    // Mimics natural breath: slow inhale, slow exhale, subtle presence shift
    Animated.loop(
      Animated.sequence([
        // Inhale - presence softens
        Animated.timing(breatheAnim, {
          toValue: 0.85,
          duration: 3000, // Slow, calm inhale (duration_slower × 5)
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Exhale - presence returns
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 3000, // Slow, calm exhale
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [breatheAnim]);

  // Breathing countdown timer
  useEffect(() => {
    // Only tick if we're in breathing state and count > 0
    if (!shouldTickBreathing(state, breathingCount)) {
      return;
    }

    // Set up 1-second interval to decrement countdown
    const timer = setInterval(() => {
      dispatchIntervention({ type: 'BREATHING_TICK' });
    }, 1000);

    // Cleanup interval on unmount or state change
    return () => clearInterval(timer);
  }, [state, breathingCount, dispatchIntervention]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Central breathing visual */}
      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.breathingCircle,
            {
              opacity: breatheAnim,
            },
          ]}
        >
          <Text style={styles.countdownNumber}>{breathingCount}</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // tokens: background (dark mode)
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingCircle: {
    width: 160,
    height: 160,
    borderRadius: 9999, // tokens: radius_full
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // tokens: surfaceGlass
    alignItems: 'center',
    justifyContent: 'center',
    // elevation_2 (dark mode)
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  countdownNumber: {
    fontSize: 64, // Scaled from h1 (32) for prominence
    lineHeight: 72,
    fontWeight: '600', // tokens: h1.fontWeight
    letterSpacing: -0.5, // tokens: h1.letterSpacing
    color: '#FAFAFA', // tokens: textPrimary
  },
});

