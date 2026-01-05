import React, { useState, useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { getQuickTaskRemaining, setQuickTaskTimer } from '@/src/os/osTriggerBrain';
import { getQuickTaskDurationMs, getQuickTaskWindowMs } from '@/src/os/osConfig';

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

export default function QuickTaskDialogScreen() {
  console.log('[QuickTaskDialog] ========================================');
  console.log('[QuickTaskDialog] COMPONENT FUNCTION CALLED!');
  console.log('[QuickTaskDialog] ========================================');

  const { session, dispatchSystemEvent } = useSystemSession();
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate remaining uses dynamically (GLOBAL across all apps)
  const now = Date.now();
  const quickTaskRemaining = getQuickTaskRemaining(now);
  const quickTaskWindowMinutes = Math.round(getQuickTaskWindowMs() / (60 * 1000));
  
  // Get app from session
  const targetApp = session?.kind === 'QUICK_TASK' ? session.app : null;

  // Disable Android hardware back button during Quick Task decision
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // User must use the close button (X) or action buttons to proceed
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Debug: Log when component mounts and receives data
  useEffect(() => {
    console.log('[QuickTaskDialog] ========================================');
    console.log('[QuickTaskDialog] Component mounted!');
    console.log('[QuickTaskDialog] session:', JSON.stringify(session));
    console.log('[QuickTaskDialog] targetApp:', targetApp);
    console.log('[QuickTaskDialog] quickTaskRemaining (GLOBAL):', quickTaskRemaining);
    console.log('[QuickTaskDialog] quickTaskWindowMinutes:', quickTaskWindowMinutes);
    console.log('[QuickTaskDialog] ========================================');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Debug: Log whenever session changes
  useEffect(() => {
    console.log('[QuickTaskDialog] session changed:', JSON.stringify(session));
  }, [session]);

  // Navigation handlers
  const handleConsciousProcess = () => {
    console.log('[QuickTaskDialog] ========================================');
    console.log('[QuickTaskDialog] handleConsciousProcess called!');
    console.log('[QuickTaskDialog] isProcessing:', isProcessing);
    
    if (isProcessing || !session || session.kind !== 'QUICK_TASK') {
      console.log('[QuickTaskDialog] Already processing or invalid session, ignoring tap');
      return;
    }
    
    setIsProcessing(true);
    console.log('[QuickTaskDialog] Set isProcessing to true');
    
    try {
      // Atomic session replacement - no transient null state
      // This prevents race condition where END_SESSION → session === null → activity finishes
      console.log('[QuickTaskDialog] Dispatching REPLACE_SESSION (QUICK_TASK → INTERVENTION)...');
      dispatchSystemEvent({ 
        type: 'REPLACE_SESSION', 
        newKind: 'INTERVENTION', 
        app: session.app 
      });
      console.log('[QuickTaskDialog] REPLACE_SESSION dispatched successfully');
      console.log('[QuickTaskDialog] SystemSurface will transition to InterventionFlow');
      
      // Reset isProcessing after a delay
      setTimeout(() => {
        setIsProcessing(false);
        console.log('[QuickTaskDialog] Reset isProcessing to false (timeout)');
      }, 2000);
    } catch (error) {
      console.error('[QuickTaskDialog] Error in handleConsciousProcess:', error);
      setIsProcessing(false);
    }
    console.log('[QuickTaskDialog] ========================================');
  };

  const handleQuickTask = () => {
    console.log('[QuickTaskDialog] ========================================');
    console.log('[QuickTaskDialog] handleQuickTask called!');
    console.log('[QuickTaskDialog] isProcessing:', isProcessing);
    console.log('[QuickTaskDialog] session:', JSON.stringify(session));
    console.log('[QuickTaskDialog] targetApp:', targetApp);
    console.log('[QuickTaskDialog] quickTaskRemaining (GLOBAL):', quickTaskRemaining);
    
    if (isProcessing || !session || session.kind !== 'QUICK_TASK') {
      console.log('[QuickTaskDialog] Already processing or invalid session, ignoring tap');
      return;
    }
    
    setIsProcessing(true);
    console.log('[QuickTaskDialog] Set isProcessing to true');
    
    try {
      const now = Date.now();
      const remaining = getQuickTaskRemaining(now); // GLOBAL - no packageName
      
      if (remaining <= 0) {
        console.error('[QuickTaskDialog] No Quick Task uses remaining (GLOBAL quota exhausted)');
        setIsProcessing(false);
        return;
      }
      
      // Set per-app timer (also records GLOBAL usage internally)
      const durationMs = getQuickTaskDurationMs();
      console.log('[QuickTaskDialog] Setting Quick Task timer:', { 
        app: session.app, 
        durationMs, 
        remainingBefore: remaining 
      });
      setQuickTaskTimer(session.app, durationMs, now);
      console.log('[QuickTaskDialog] Quick Task timer set successfully');
      console.log('[QuickTaskDialog] GLOBAL usage recorded, remaining uses decreased');
      
      // End session and return to app
      console.log('[QuickTaskDialog] Dispatching END_SESSION (shouldLaunchHome: false)...');
      dispatchSystemEvent({ type: 'END_SESSION', shouldLaunchHome: false });
      console.log('[QuickTaskDialog] END_SESSION dispatched - SystemSurface will finish, user returns to app');
      
      // Reset isProcessing after a delay
      setTimeout(() => {
        setIsProcessing(false);
        console.log('[QuickTaskDialog] Reset isProcessing to false (timeout)');
      }, 2000);
    } catch (error) {
      console.error('[QuickTaskDialog] Error in handleQuickTask:', error);
      setIsProcessing(false);
    }
    console.log('[QuickTaskDialog] ========================================');
  };

  const handleClose = () => {
    console.log('[QuickTaskDialog] ========================================');
    console.log('[QuickTaskDialog] handleClose called!');
    console.log('[QuickTaskDialog] isProcessing:', isProcessing);
    
    if (isProcessing) {
      console.log('[QuickTaskDialog] Already processing, ignoring tap');
      return;
    }
    
    setIsProcessing(true);
    console.log('[QuickTaskDialog] Set isProcessing to true');
    
    try {
      // End session and launch home
      console.log('[QuickTaskDialog] Dispatching END_SESSION (shouldLaunchHome: true)...');
      dispatchSystemEvent({ type: 'END_SESSION', shouldLaunchHome: true });
      console.log('[QuickTaskDialog] END_SESSION dispatched - SystemSurface will finish and launch home');
      console.log('[QuickTaskDialog] Quick Task uses unchanged (GLOBAL quota preserved)');
      
      // Reset isProcessing after a delay in case dismissal doesn't happen
      setTimeout(() => {
        setIsProcessing(false);
        console.log('[QuickTaskDialog] Reset isProcessing to false (timeout)');
      }, 2000);
    } catch (error) {
      console.error('[QuickTaskDialog] Error in handleClose:', error);
      setIsProcessing(false);
    }
    console.log('[QuickTaskDialog] ========================================');
  };

  console.log('[QuickTaskDialog] About to return JSX...');

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
            {quickTaskRemaining >= Number.MAX_SAFE_INTEGER ? 'Unlimited' : quickTaskRemaining} left in this {quickTaskWindowMinutes}-minute window.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* PRIMARY ACTION: Conscious Process */}
          <Pressable
            onPress={handleConsciousProcess}
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isProcessing && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>Start conscious process</Text>
          </Pressable>

          {/* SECONDARY ACTION: Quick Task */}
          <Pressable
            onPress={handleQuickTask}
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              isProcessing && styles.buttonDisabled,
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
  buttonDisabled: {
    opacity: 0.5,
  },
});

