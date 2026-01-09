/**
 * PostQuickTaskChoiceScreen
 * 
 * Shown when Quick Task expires in foreground.
 * Replaces immediate intervention with explicit user choice.
 * 
 * Design Authority:
 * - design/ui/tokens.md (colors, typography, spacing, radius, elevation)
 * 
 * Architecture:
 * - NEVER auto-restarts Quick Task
 * - Suppresses OS Trigger Brain decisions until user chooses
 * - Pure UI + event dispatch (no business logic)
 */

import React, { useState, useEffect } from 'react';
import { BackHandler, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { getQuickTaskRemainingForDisplay } from '@/src/systemBrain/publicApi';
import { clearExpiredQuickTaskInMemory, clearBlockingState } from '@/src/systemBrain/stateManager';
import { clearQuickTaskSuppression } from '@/src/systemBrain/decisionEngine';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * PostQuickTaskChoiceScreen
 * 
 * Gravity: Pause Moment (Full-screen Interruption)
 * - Full-screen modal-style UI
 * - Centered content card
 * - Dark mode primary (low stimulation)
 * - User must explicitly choose next action
 * - No auto-decisions, no timers
 */
export default function PostQuickTaskChoiceScreen() {
  const { session, dispatchSystemEvent, safeEndSession } = useSystemSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [quickTaskRemaining, setQuickTaskRemaining] = useState<number>(0);
  
  // Get app from session
  const targetApp = session?.kind === 'POST_QUICK_TASK_CHOICE' ? session.app : null;

  // Load Quick Task remaining uses for decision logic
  useEffect(() => {
    async function loadRemaining() {
      const info = await getQuickTaskRemainingForDisplay();
      setQuickTaskRemaining(info.remaining);
      console.log('[PostQuickTaskChoice] Quick Task remaining:', info.remaining);
    }
    loadRemaining();
  }, []);

  // Disable Android hardware back button during choice
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Treat back button as "Quit this app"
      handleQuitApp();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  /**
   * Handle "Quit this app" action
   * 
   * End session and launch home screen.
   * No intervention, user explicitly chose to quit.
   */
  const handleQuitApp = () => {
    if (isProcessing || !targetApp) return;
    
    setIsProcessing(true);
    console.log('[PostQuickTaskChoice] User chose: Quit this app');
    
    // Clear blocking state synchronously (in-memory)
    clearBlockingState(targetApp);
    
    // Clear legacy UI coordination flags
    clearExpiredQuickTaskInMemory(targetApp);
    clearQuickTaskSuppression();
    
    console.log('[PostQuickTaskChoice] 🔓 Blocking state cleared - exiting to home');
    
    // End session and go to home
    safeEndSession(true);
  };

  /**
   * Handle "Continue using this app" action
   * 
   * Check n_quickTask and decide:
   * - If quota > 0: Show Quick Task dialog again
   * - If quota = 0: Start Intervention Flow immediately
   */
  const handleContinueUsingApp = async () => {
    if (isProcessing || !session || !targetApp) return;
    
    setIsProcessing(true);
    console.log('[PostQuickTaskChoice] User chose: Continue using this app');
    console.log('[PostQuickTaskChoice] Quick Task remaining:', quickTaskRemaining);
    
    // Clear blocking state synchronously (in-memory)
    clearBlockingState(targetApp);
    
    // Clear legacy UI coordination flags
    clearQuickTaskSuppression();
    
    if (quickTaskRemaining > 0) {
      // Case A: Quota available → Show Quick Task dialog
      console.log('[PostQuickTaskChoice] n_quickTask > 0 → Launching Quick Task dialog');
      console.log('[PostQuickTaskChoice] 🔓 Blocking state cleared - showing Quick Task dialog');
      
      // Replace current session with QUICK_TASK
      dispatchSystemEvent({
        type: 'REPLACE_SESSION',
        newKind: 'QUICK_TASK',
        app: targetApp,
      });
    } else {
      // Case B: Quota exhausted → Start Intervention Flow
      console.log('[PostQuickTaskChoice] n_quickTask = 0 → Starting Intervention Flow');
      console.log('[PostQuickTaskChoice] 🔓 Blocking state cleared - starting Intervention');
      
      // Clear legacy flag explicitly
      clearExpiredQuickTaskInMemory(targetApp);
      
      // Replace current session with INTERVENTION
      dispatchSystemEvent({
        type: 'REPLACE_SESSION',
        newKind: 'INTERVENTION',
        app: targetApp,
      });
    }
    
    setIsProcessing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Content - vertically centered */}
      <View style={styles.contentContainer}>
        {/* Centered card */}
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.titleText}>Your Quick Task is finished</Text>
          
          {/* Description */}
          <Text style={styles.descriptionText}>What would you like to do next?</Text>
          
          {/* Actions */}
          <View style={styles.actionsSection}>
            {/* PRIMARY ACTION: Continue using this app */}
            <Pressable
              onPress={handleContinueUsingApp}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isProcessing && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>Continue using this app</Text>
            </Pressable>

            {/* SECONDARY ACTION: Quit this app */}
            <Pressable
              onPress={handleQuitApp}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
                isProcessing && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Quit this app</Text>
            </Pressable>
          </View>
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
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24, // space_24
    paddingBottom: 40, // space_40
  },
  card: {
    backgroundColor: '#18181B', // tokens: surface (dark mode)
    borderRadius: 24, // tokens: radius_24 (modals, sheets)
    padding: 32, // space_32
    // elevation_3 - prominent modal
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  titleText: {
    // tokens: h2
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#FAFAFA', // textPrimary
    textAlign: 'center',
    marginBottom: 12, // space_12
  },
  descriptionText: {
    // tokens: bodySecondary
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
    color: '#A1A1AA', // textSecondary
    textAlign: 'center',
    marginBottom: 32, // space_32
  },
  actionsSection: {
    gap: 12, // space_12
  },
  // PRIMARY BUTTON: Continue using this app
  // - Primary accent color
  // - Placed ABOVE secondary action
  // - Clear affordance as the main choice
  // - elevation_2 for prominence
  primaryButton: {
    height: 44, // buttonHeight_primary
    paddingHorizontal: 24, // space_24
    borderRadius: 12, // radius_12
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B7AE8', // tokens: primary
    // elevation_2
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonPressed: {
    opacity: 0.8, // opacity_hover
  },
  primaryButtonText: {
    // tokens: button
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: '#FAFAFA', // textPrimary
  },
  // SECONDARY BUTTON: Quit this app
  // - Ghost/transparent style
  // - Subtle border
  // - Lower visual hierarchy
  secondaryButton: {
    height: 36, // buttonHeight_secondary
    paddingHorizontal: 24, // space_24
    borderRadius: 12, // radius_12
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3F3F46', // border
  },
  secondaryButtonPressed: {
    opacity: 0.6, // opacity_muted
  },
  secondaryButtonText: {
    // tokens: button
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: '#A1A1AA', // textSecondary
  },
  buttonDisabled: {
    opacity: 0.4, // opacity_disabled
  },
});
