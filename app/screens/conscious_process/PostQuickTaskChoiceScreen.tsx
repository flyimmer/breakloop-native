import { useSystemSession } from '@/src/contexts/SystemSessionProvider';
import { CheckCircle } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, NativeModules, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Design Tokens (Inline for safety, but matches project theme)
const COLORS = {
  background: '#0A0A0B',
  surfaceSecondary: '#27272A',
  primary: '#8B7AE8',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
};

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * PostQuickTaskChoiceScreen
 * 
 * Refactored to follow "Ambient Hearth" design:
 * - Closure, not Choice.
 * - Primary action is to Quit/Close.
 * - Secondary action is to Continue (with friction).
 */
export default function PostQuickTaskChoiceScreen() {
  const { session, safeEndSession } = useSystemSession();
  const [isProcessing, setIsProcessing] = useState(false);
  const insets = useSafeAreaInsets();

  // Get app from session
  const appPackageName = session?.kind === 'POST_QUICK_TASK_CHOICE' ? session.app : 'Unknown';
  const [appName, setAppName] = useState<string>('App');

  // Format app name (e.g., "com.instagram.android" -> "Instagram")
  const displayAppName = useMemo(() => {
    if (!appPackageName || appPackageName === 'Unknown') return 'App';
    const parts = appPackageName.split('.');
    const name = parts.length > 2 ? parts[parts.length - 2] : appPackageName; // Handle com.x.y format
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [appPackageName]);

  // Fetch real app name from native
  useEffect(() => {
    async function fetchAppName() {
      if (appPackageName && appPackageName !== 'Unknown' && AppMonitorModule) {
        try {
          const label = await AppMonitorModule.getAppLabel(appPackageName);
          if (label) {
            setAppName(label);
          } else {
            setAppName(displayAppName);
          }
        } catch (error) {
          console.error('[QT] Failed to fetch app label:', error);
          setAppName(displayAppName);
        }
      }
    }
    fetchAppName();
  }, [appPackageName, displayAppName]);

  // Disable Android hardware back button during choice
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Treat back button as "Quit this app"
      handleQuit();
      return true;
    });

    return () => backHandler.remove();
  }, [appPackageName]);

  const handleQuit = async () => {
    if (isProcessing || appPackageName === 'Unknown') return;
    setIsProcessing(true);

    if (AppMonitorModule && session?.sessionId) {
      try {
        await AppMonitorModule.quickTaskPostQuit(appPackageName, session.sessionId);
        console.log(`[QT][INTENT] POST_QUIT app=${appPackageName} sid=${session.sessionId}`);
      } catch (error) {
        console.error('[QT] Failed to post quit:', error);
      }
    }

    safeEndSession(true);
  };

  const handleContinue = async () => {
    if (isProcessing || appPackageName === 'Unknown') return;
    setIsProcessing(true);

    if (AppMonitorModule && session?.sessionId) {
      try {
        await AppMonitorModule.quickTaskPostContinue(appPackageName, session.sessionId);
        console.log(`[QT][INTENT] POST_CONTINUE app=${appPackageName} sid=${session.sessionId}`);
      } catch (error) {
        console.error('[QT] Failed to post continue:', error);
      }
    }

    setIsProcessing(false);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>

      {/* 1. Hero Section: Visual Confirmation of Completion */}
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <CheckCircle size={48} color={COLORS.primary} strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>Quick Task Complete</Text>
        <Text style={styles.subtitle}>
          You've checked what you needed.{'\n'}Ready to return to life?
        </Text>
      </View>

      {/* 2. Action Section: Healthy Choice is Primary */}
      <View style={styles.actionContainer}>

        {/* Primary: QUIT (The "Good" Choice) */}
        <TouchableOpacity
          style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleQuit}
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          <Text style={styles.primaryButtonText}>Close {appName}</Text>
        </TouchableOpacity>

        {/* Secondary: CONTINUE (The "Friction" Choice) */}
        <TouchableOpacity
          style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.6}
          disabled={isProcessing}
        >
          <Text style={styles.secondaryButtonText}>I want to use "{appName}" more</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 999,
    // Subtle glow
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  secondaryButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '400',
  },
  buttonDisabled: {
    opacity: 0.5,
  }
});
