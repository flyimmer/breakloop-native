import { useIntervention } from '@/src/contexts/InterventionProvider';
import { shouldTickBreathing } from '@/src/core/intervention';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * BreathingScreen
 * 
 * Updated Feb 2026:
 * - Instructions: "Breathe in" / "Breathe out" synchronized text.
 * - Visuals: Subtle Blue Circle, Purple Buttons.
 * - Duration: 8s timer for buttons, but animation LOOPS indefinitely.
 */
export default function BreathingScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, breathingCount, targetApp, breathingCompleted } = interventionState;

  // Animations
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current; // For text transitions

  // Breathing State
  const [instruction, setInstruction] = useState('Breathe in');

  // Back Handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, []);

  // Entry Animation
  useEffect(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Breathing Rhythm & Instruction Sync (LOOP CONTINUOUSLY)
  useEffect(() => {
    // 1. Start Animation Loop (4s In, 4s Out)
    Animated.loop(
      Animated.sequence([
        // Inhale (4s)
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Exhale (4s)
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // 2. Start Text Loop (Flip every 4s)
    // Initial state is 'Breathe in'.
    // At t=4s: Switch to 'Breathe out'.
    // At t=8s: Switch to 'Breathe in'.
    // ... repeat.

    // We use a recursive timeout pattern or interval to stay synced with animation start.
    // Since animation starts immediately, interval is reasonable.

    let isInhale = true; // Started with Inhale

    const textInterval = setInterval(() => {
      // Toggle phase
      isInhale = !isInhale;
      const nextText = isInhale ? 'Breathe in' : 'Breathe out';

      // Fading transition
      Animated.sequence([
        Animated.timing(textOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();

      // Update text halfway through fade (at 200ms)? 
      // Or just update state. React render might be slightly delayed relative to animation frame.
      // Let's update state immediately and let opacity hide the swap.
      // Wait, if we update immediately, user sees old text fading out? No, new text fading out?
      // We want: Fade Out Old -> Swap Text -> Fade In New.

      // Better:
      Animated.timing(textOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setInstruction(nextText);
        Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });

    }, 4000); // 4 seconds per phase

    return () => {
      clearInterval(textInterval);
      breatheAnim.stopAnimation();
    };
  }, []);

  // Timer Tick (stops at 0, but animation continues)
  useEffect(() => {
    if (!shouldTickBreathing(state, breathingCount)) return;

    const timer = setInterval(() => {
      dispatchIntervention({ type: 'BREATHING_TICK' });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, breathingCount, dispatchIntervention]);

  // Reveal Buttons logic (unchanged)
  useEffect(() => {
    if (breathingCompleted) {
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
        delay: 200,
      }).start();
    }
  }, [breathingCompleted]);

  // Actions
  const handleClose = () => {
    dispatchIntervention({ type: 'RESET_INTERVENTION', reason: 'USER_CLOSE' });
  };

  const handleContinue = () => {
    dispatchIntervention({ type: 'BREATHING_COMPLETE' });
  };

  // Interpolations
  const scale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const circleOpacity = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.3],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>

        {/* Breathing Visualization */}
        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.breathingCircle,
              {
                transform: [{ scale }],
                opacity: circleOpacity,
              },
            ]}
          />
          {/* Inner solid anchor */}
          <View style={styles.anchorCircle} />

          {/* Instruction Text */}
          <Animated.Text style={[styles.instructionText, { opacity: textOpacity }]}>
            {instruction}
          </Animated.Text>
        </View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: buttonsOpacity,
              pointerEvents: breathingCompleted ? 'auto' : 'none'
            }
          ]}
        >
          {/* Primary: Close App */}
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonTextPrimary}>Close app</Text>
          </TouchableOpacity>

          {/* Secondary: Continue */}
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonTextSecondary}>
              Continue to use {targetApp ? 'app' : 'app'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // Dark background
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#3B82F6', // Blue-500
    position: 'absolute',
  },
  anchorCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    color: '#E4E4E7', // Zinc-200
    fontSize: 24,
    fontWeight: '500',
    fontFamily: 'System',
    letterSpacing: 0.5,
    marginTop: 0,
    position: 'absolute',
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 16,
    alignItems: 'center',
    width: '100%',
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#6366F1', // Indigo-500
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
  },
  buttonTextPrimary: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '500',
  },
});
