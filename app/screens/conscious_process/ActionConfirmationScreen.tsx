import { useIntervention } from '@/src/contexts/InterventionProvider';
import { parseDurationToMinutes } from '@/src/core/intervention';
import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/RootNavigator';

/**
 * ActionConfirmationScreen
 * 
 * Phase D: Step 6B - Action Confirmation
 * 
 * Gravity: Grounded Transition
 * - Decisive, calm, non-urgent
 * - One clear primary action (bottom-anchored)
 * - Secondary actions visually subordinate
 * - Reachable by thumb
 * 
 * Purpose:
 * - Answers: "Do I want to do this now?"
 * - Confirms intent
 * - Reduces ambiguity
 * - Allows clear, ethical commitment
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md (Grounded Transition)
 * - design/ui/tokens.md (colors, typography, spacing, elevation)
 * - design/ui/screens.md (Action Confirmation Screen spec)
 */

export default function ActionConfirmationScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { state, selectedAlternative, selectedCauses } = interventionState;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Allow Android hardware back button to go back to Alternatives
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Update intervention state to alternatives
      dispatchIntervention({ type: 'GO_BACK_FROM_ACTION' });
      // Allow back navigation to Alternatives screen
      navigation.goBack();
      return true; // Prevent default to use our custom navigation
    });

    return () => backHandler.remove();
  }, [navigation, dispatchIntervention]);

  // Handle swipe back gesture - update intervention state when navigating back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only handle back navigation (not forward navigation or other actions)
      if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
        // Update intervention state to alternatives
        dispatchIntervention({ type: 'GO_BACK_FROM_ACTION' });
      }
    });

    return unsubscribe;
  }, [navigation, dispatchIntervention]);

  // Only render when in 'action' state
  if (state !== 'action' || !selectedAlternative) {
    return null;
  }

  // Format selected causes for display
  const formatSelectedCauses = () => {
    if (selectedCauses.length === 0) return [];
    const causeLabels: { [key: string]: string } = {
      'boredom': 'Boredom',
      'anxiety': 'Anxiety',
      'fatigue': 'Fatigue',
      'loneliness': 'Loneliness',
      'self-doubt': 'Self-doubt',
      'no-goal': 'No clear goal',
    };
    return selectedCauses.map(id => causeLabels[id] || id);
  };

  // Extract activity data from selectedAlternative
  const activityTitle = selectedAlternative.title || 'Activity';
  const activityDuration = selectedAlternative.duration || '5m';
  const activityDescription = selectedAlternative.description || '';
  const activitySteps = selectedAlternative.actions || selectedAlternative.steps || [];
  const formattedCauses = formatSelectedCauses();

  // Handle start activity - dispatch START_ALTERNATIVE with parsed duration
  const handleStartActivity = () => {
    const durationMinutes = parseDurationToMinutes(activityDuration);
    dispatchIntervention({
      type: 'START_ALTERNATIVE',
      durationMinutes,
    });
    // Navigation will react to state change to 'action_timer'
  };

  // Handle plan for later - save activity and exit intervention
  const handlePlanForLater = async () => {
    // 1. Save activity to Main App storage (Upcoming Activities)
    const activity = {
      id: `planned-${Date.now()}`,
      title: selectedAlternative.title,
      description: selectedAlternative.description,
      duration: selectedAlternative.duration,
      plannedAt: Date.now(),
      source: 'intervention',
    };
    
    try {
      const existingActivities = await AsyncStorage.getItem('upcoming_activities');
      const activities = existingActivities ? JSON.parse(existingActivities) : [];
      activities.push(activity);
      await AsyncStorage.setItem('upcoming_activities', JSON.stringify(activities));
      
      if (__DEV__) {
        console.log('[ActionConfirmation] Activity saved for later:', activity);
      }
    } catch (error) {
      console.error('[ActionConfirmation] Failed to save activity:', error);
    }
    
    // 2. Reset intervention state (triggers idle → END_SESSION → SystemSurface closes)
    dispatchIntervention({ type: 'RESET_INTERVENTION' });
  };

  // Handle back - dispatch GO_BACK_FROM_ACTION to return to alternatives
  const handleClose = () => {
    dispatchIntervention({ type: 'GO_BACK_FROM_ACTION' });
    // Navigation will react to state change to 'alternatives'
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Back button */}
      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={12}
        >
          <ArrowLeft size={24} color="#A1A1AA" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Scrollable content area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Activity title */}
        <View style={styles.titleSection}>
          <Text style={styles.activityTitle}>{activityTitle}</Text>
          {activityDuration && (
            <Text style={styles.activityDuration}>{activityDuration}</Text>
          )}
        </View>

        {/* Activity description (if available) */}
        {activityDescription && (
          <View style={styles.descriptionSection}>
            <Text style={styles.activityDescription}>{activityDescription}</Text>
          </View>
        )}

        {/* Context reminder (subtle) */}
        {formattedCauses.length > 0 && (
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>
              Chosen because of: {formattedCauses.join(', ')}
            </Text>
          </View>
        )}

        {/* Action steps */}
        {activitySteps.length > 0 && (
          <View style={styles.stepsSection}>
            <Text style={styles.stepsHeader}>Action steps</Text>
            <View style={styles.stepsList}>
              {activitySteps.map((step: string, index: number) => (
                <View key={index} style={styles.stepItem}>
                  <Text style={styles.stepNumber}>{index + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom action area */}
      <View style={styles.bottomActions}>
        {/* Secondary action */}
        <Pressable
          onPress={handlePlanForLater}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Plan for later</Text>
        </Pressable>

        {/* Primary action (bottom-anchored, strongest affordance) */}
        <Pressable
          onPress={handleStartActivity}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Start this activity</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Slightly soften the pure black background (transition out of interruption mode)
    backgroundColor: '#0F0F10', // Between #0A0A0B (background) and #18181B (surface)
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  titleSection: {
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 32, // h1
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: '#FAFAFA', // textPrimary
    marginBottom: 8,
  },
  activityDuration: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '400',
    color: '#71717A', // textMuted - quiet presence
  },
  descriptionSection: {
    marginBottom: 16,
  },
  activityDescription: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '400',
    color: '#A1A1AA', // textSecondary
  },
  contextSection: {
    marginBottom: 32,
  },
  contextLabel: {
    fontSize: 14, // bodySmall
    lineHeight: 20,
    fontWeight: '400',
    color: '#71717A', // textMuted - informational only
    fontStyle: 'italic',
  },
  stepsSection: {
    marginBottom: 24,
  },
  stepsHeader: {
    fontSize: 14, // bodySmall
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#A1A1AA', // textSecondary
    marginBottom: 16,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumber: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '600',
    color: '#A1A1AA', // textSecondary
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '400',
    color: '#FAFAFA', // textPrimary
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
    // Subtle separation from content
    borderTopWidth: 1,
    borderTopColor: '#27272A', // Slightly lighter than background for subtle division
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    // Visually recedes - no background, no elevation
  },
  secondaryButtonPressed: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '500',
    color: '#A1A1AA', // textSecondary - subordinate to primary
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    // Calm, steady color (not celebratory, not green)
    // Using primaryMuted for decisive but non-urgent presence
    backgroundColor: '#6B5FC9', // primaryMuted
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
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '600',
    color: '#FAFAFA', // textPrimary - clear, readable
  },
});

