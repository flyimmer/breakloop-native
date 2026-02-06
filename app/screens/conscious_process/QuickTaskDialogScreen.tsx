import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { getQuickTaskRemainingForDisplay } from '@/src/systemBrain/publicApi';
import { setSystemSurfaceActive } from '@/src/systemBrain/stateManager';
import React, { useEffect, useState } from 'react';
import { BackHandler, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

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
  const { session, dispatchSystemEvent, safeEndSession, setTransientTargetApp } = useSystemSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayInfo, setDisplayInfo] = useState<{ remaining: number; windowMinutes: number } | null>(null);

  // Get app from session
  const targetApp = session?.kind === 'QUICK_TASK' ? session.app : null;

  // Load remaining uses for display (informational only)
  useEffect(() => {
    async function loadRemaining() {
      const info = await getQuickTaskRemainingForDisplay();
      setDisplayInfo(info);
      console.log('[QuickTaskDialog] Loaded display info:', info);
    }
    loadRemaining();
  }, []);

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
    console.log('[QuickTaskDialog] displayInfo:', displayInfo);
    console.log('[QuickTaskDialog] ========================================');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Log whenever session changes
  useEffect(() => {
    console.log('[QuickTaskDialog] session changed:', JSON.stringify(session));
  }, [session]);

  // Navigation handlers
  const handleConsciousProcess = async () => {
    if (isProcessing || !session || session.kind !== 'QUICK_TASK') {
      return;
    }

    setIsProcessing(true);

    try {
      // PHASE 4.2: Notify Native that we are switching to Intervention
      // This resets native Quick Task state machine but keeps SystemSurface open
      if (AppMonitorModule) {
        try {
          await AppMonitorModule.quickTaskSwitchToIntervention(session.app);
          console.log(`[QT][INTENT] SWITCH_TO_INTERVENTION app=${session.app}`);
        } catch (error) {
          // Fallback - continue even if native call fails
        }
      }

      // Atomic session replacement - no transient null state
      // This prevents race condition where END_SESSION → session === null → activity finishes
      dispatchSystemEvent({
        type: 'REPLACE_SESSION',
        newKind: 'INTERVENTION',
        app: session.app
      });

      // Reset isProcessing after a delay
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  const handleQuickTaskStart = async () => {
    if (isProcessing || !session || session.kind !== 'QUICK_TASK') {
      return;
    }

    setIsProcessing(true);

    try {
      // OFFERING → ACTIVE Transition
      // Native will:
      // 1. Validate session ID (3-tier guard)
      // 2. Transition state OFFERING → ACTIVE
      // 3. Decrement quota (ONCE)
      // 4. Start timer keyed by (app, sessionId)
      // 5. Persist state

      if (AppMonitorModule) {
        try {
          const app = session.app;
          const sessionId = String(session.sessionId); // Defensive: ensure string for bridge

          // Log UI confirmation BEFORE calling native (with type check)
          console.log(`[QT_UI] confirm app=${app} sid=${sessionId} typeof=${typeof session.sessionId}`);

          // Call native confirmation (OFFERING → ACTIVE)
          await AppMonitorModule.quickTaskConfirm(app, sessionId);
          console.log(`[QT][INTENT] CONFIRMED app=${app} sid=${sessionId}`);
        } catch (error) {
          console.error('[QT][INTENT] Failed to confirm Quick Task:', error);
          setIsProcessing(false);
          return;
        }
      }

      // ACTIVE phase is silent - close SystemSurface immediately
      // User continues using the app, Native enforces timer

      // Set transient targetApp for finish-time navigation
      setTransientTargetApp(session.app);

      // End session and return to app (ACTIVE phase has no UI)
      safeEndSession(false);

      // Reset isProcessing
      setIsProcessing(false);
    } catch (error) {
      console.error('[QT] Error in handleQuickTaskStart:', error);
      setIsProcessing(false);
    }
  };

  const handleClose = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      // PHASE 4.2: Send decline intent to Native
      if (AppMonitorModule && session?.app) {
        try {
          // Native will:
          // 1. Remove entry from quickTaskMap
          // 2. Clear persisted state
          // 3. Emit FINISH_SYSTEM_SURFACE command
          await AppMonitorModule.quickTaskDecline(session.app);
          console.log(`[QT][INTENT] DECLINE app=${session.app}`);
        } catch (error) {
          // Silent failure
        }
      }

      // Notify native that SystemSurface is finishing
      setSystemSurfaceActive(false);

      // End session and launch home (idempotent, immediate)
      safeEndSession(true);

      // Reset isProcessing after a delay in case dismissal doesn't happen
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      setIsProcessing(false);
    }
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
            {displayInfo
              ? `${displayInfo.remaining} left in this ${displayInfo.windowMinutes}-minute window.`
              : 'Loading...'}
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
            onPress={handleQuickTaskStart}
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

