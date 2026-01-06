import React, { useEffect } from 'react';
import { BackHandler, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { setIntentionTimer } from '@/src/os/osTriggerBrain';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * IntentionTimerScreen
 * 
 * Phase A2: Exit Normalization
 * 
 * Purpose:
 * - Allows user to set an "intention timer" when they genuinely need to use a blocked app
 * - Replaces silent intervention bypass with explicit user choice
 * - Stores intentionTimerUntil timestamp and resets intervention to 'idle'
 * 
 * Entry points:
 * 1. AlternativesScreen → "Ignore & Continue" button
 * 2. RootCauseScreen → "I really need to use it" option
 * 
 * Gravity: Reflective Float (calm, non-urgent choice)
 * - No bottom-anchored CTA
 * - Even visual weight across duration options
 * - Confirmation action is secondary presence
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Reflective Float)
 * - design/ui/tokens.md (colors, typography, spacing, elevation)
 * - design/ui/tone-ambient-hearth.md (calm, soft, depth via elevation)
 * - Web reference: "Set Intention Timer" modal
 */

// Duration options in minutes (matching web reference)
const DURATION_OPTIONS = [
  { value: 5, label: '5m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 45, label: '45m' },
  { value: 60, label: '60m' },
] as const;

export default function IntentionTimerScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { setTransientTargetApp } = useSystemSession();

  // Disable Android hardware back button during intervention
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // User must select a duration to proceed
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Handle duration selection - starts timer immediately
  const handleSelectDuration = (durationMinutes: number) => {
    const currentTimestamp = Date.now();
    const durationMs = durationMinutes * 60 * 1000;

    console.log('[IntentionTimer] User selected duration:', {
      durationMinutes,
      targetApp: interventionState.targetApp,
      currentTimestamp,
      expiresAt: currentTimestamp + durationMs,
    });

    // Set intention timer in OS Trigger Brain for the target app
    if (interventionState.targetApp) {
      const expiresAt = currentTimestamp + durationMs;
      
      setIntentionTimer(interventionState.targetApp, durationMs, currentTimestamp);
      
      // Set wake suppression flag (mechanical instruction to native)
      // This tells native: "Don't launch SystemSurface before this time"
      // Native doesn't know WHY (intention timer) - just that wake is suppressed
      if (AppMonitorModule) {
        AppMonitorModule.setSuppressSystemSurfaceUntil(interventionState.targetApp, expiresAt);
        console.log('[IntentionTimer] Wake suppression flag set until:', new Date(expiresAt).toISOString());
      }
      
      // Store timer in native SharedPreferences (for backward compatibility)
      if (AppMonitorModule) {
        AppMonitorModule.storeIntentionTimer(interventionState.targetApp, expiresAt);
        console.log('[IntentionTimer] Stored intention timer in native SharedPreferences');
      }
      
      console.log('[IntentionTimer] Timer set successfully');
      
      // Set transient targetApp for finish-time navigation
      // This ensures SystemSurface launches the target app after finishing
      setTransientTargetApp(interventionState.targetApp);
      console.log('[IntentionTimer] Set transient targetApp:', interventionState.targetApp);
    }

    // Dispatch action to reset intervention state to idle
    // This will trigger navigation handler to finish InterventionActivity
    // and release user back to the monitored app
    console.log('[IntentionTimer] Dispatching SET_INTENTION_TIMER to reset state to idle');
    console.log('[IntentionTimer] Current intervention state before dispatch:', {
      state: interventionState.state,
      targetApp: interventionState.targetApp,
    });
    
    dispatchIntervention({
      type: 'SET_INTENTION_TIMER',
    });
    
    console.log('[IntentionTimer] SET_INTENTION_TIMER dispatched');
  };

  // Handle "Just 1 min" - starts immediately
  const handleJustOneMin = () => {
    handleSelectDuration(1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Content vertically centered */}
      <View style={styles.contentContainer}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🕐</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Set Intention Timer</Text>

        {/* Duration options grid */}
        <View style={styles.durationGrid}>
          {DURATION_OPTIONS.map((option) => {
            return (
              <Pressable
                key={option.value}
                onPress={() => handleSelectDuration(option.value)}
                style={({ pressed }) => [
                  styles.durationCard,
                  pressed && styles.durationCardPressed,
                ]}
              >
                <Text style={styles.durationLabel}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* "Just 1 min" - small tappable text (starts immediately) */}
        <Pressable
          onPress={handleJustOneMin}
          style={({ pressed }) => [
            styles.justOneMinContainer,
            pressed && styles.justOneMinPressed,
          ]}
        >
          <Text style={styles.justOneMinText}>Just 1 min</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // tokens: background (dark mode)
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24, // tokens: space_24
    paddingTop: 80, // Gentle vertical centering
    paddingBottom: 24, // tokens: space_24
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16, // tokens: space_16
  },
  icon: {
    fontSize: 48,
    textAlign: 'center',
  },
  title: {
    fontSize: 24, // tokens: h2.fontSize
    lineHeight: 32, // tokens: h2.lineHeight
    fontWeight: '600', // tokens: h2.fontWeight
    letterSpacing: -0.3, // tokens: h2.letterSpacing
    color: '#FAFAFA', // tokens: textPrimary
    textAlign: 'center',
    marginBottom: 32, // tokens: space_32
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12, // tokens: space_12
    marginBottom: 16, // tokens: space_16 (reduced since "Just 1 min" is below)
    width: '100%',
    maxWidth: 320,
  },
  durationCard: {
    paddingVertical: 16, // tokens: space_16
    paddingHorizontal: 20, // tokens: space_20
    backgroundColor: '#18181B', // tokens: surface
    borderRadius: 12, // tokens: radius_12
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8, // Reduced prominence (less bright)
    // Minimal elevation
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, // Reduced shadow for less prominence
    shadowRadius: 1,
    elevation: 1,
  },
  durationCardPressed: {
    opacity: 0.7, // tokens: opacity_hover (reduced from 0.8)
  },
  durationLabel: {
    fontSize: 20, // tokens: h3.fontSize
    lineHeight: 28, // tokens: h3.lineHeight
    fontWeight: '600', // tokens: h3.fontWeight
    letterSpacing: -0.2, // tokens: h3.letterSpacing
    color: '#A1A1AA', // tokens: textSecondary (reduced from textPrimary for less brightness)
    textAlign: 'center',
  },
  justOneMinContainer: {
    alignItems: 'center',
    marginTop: 8, // tokens: space_8
    marginBottom: 24, // tokens: space_24
    paddingVertical: 4, // Small touch target
    paddingHorizontal: 8,
  },
  justOneMinPressed: {
    opacity: 0.6, // tokens: opacity_muted
  },
  justOneMinText: {
    fontSize: 12, // Very small text (tokens: caption.fontSize)
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '400', // tokens: caption.fontWeight
    letterSpacing: 0,
    color: '#71717A', // tokens: textMuted (light grey, subtle)
    textAlign: 'center',
  },
});

