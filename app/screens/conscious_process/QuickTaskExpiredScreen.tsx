import React, { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, Platform, NativeModules } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { clearIntentionTimer } from '@/src/os/osTriggerBrain';
import { useQuickTask } from '@/src/contexts/QuickTaskProvider';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

/**
 * QuickTaskExpiredScreen
 * 
 * Shown when Quick Task timer expires.
 * Provides explicit boundary and clean exit from emergency mode.
 * 
 * Architecture: Part of Quick Task Flow (Emergency Bypass)
 * See: docs/SYSTEM_SURFACE_ARCHITECTURE.md - Quick Task Flow
 * 
 * Purpose:
 * - Inform user that emergency window has ended
 * - Provide explicit "Go Home" action
 * - Reset t_intention timer for the expired app (per spec)
 * - Navigate to Home screen
 * 
 * Behavior:
 * - User MUST explicitly close (no auto-dismiss)
 * - Closing navigates to Home screen
 * - t_intention reset to 0 for this app
 */

/**
 * Get friendly app name from package name
 * Maps common package names to readable names
 */
const getAppDisplayName = (packageName: string | null): string => {
  if (!packageName) return 'Unknown App';
  
  // Common app mappings
  const appMappings: Record<string, string> = {
    'com.instagram.android': 'Instagram',
    'com.zhiliaoapp.musically': 'TikTok',
    'com.twitter.android': 'Twitter',
    'com.facebook.katana': 'Facebook',
    'com.snapchat.android': 'Snapchat',
    'com.reddit.frontpage': 'Reddit',
    'com.youtube': 'YouTube',
    'com.whatsapp': 'WhatsApp',
  };
  
  // Return mapped name if available
  if (appMappings[packageName]) {
    return appMappings[packageName];
  }
  
  // Fallback: Extract readable name from package name
  // e.g., "com.example.myapp" -> "Myapp"
  const parts = packageName.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
};

export default function QuickTaskExpiredScreen() {
  const navigation = useNavigation();
  const { quickTaskState, dispatchQuickTask } = useQuickTask();

  // Get friendly app name
  const appName = getAppDisplayName(quickTaskState.expiredApp);

  // Disable Android hardware back button during Quick Task expired screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      // User must acknowledge the expiration by clicking "Close & Go Home"
      return true;
    });

    return () => backHandler.remove();
  }, []);

  const handleClose = () => {
    console.log('[QuickTaskExpired] User clicked Close & Go Home');
    
    // Reset t_intention for the expired app (per OS Trigger Contract V1)
    // When Quick Task expires: t_intention is reset to 0
    if (quickTaskState.expiredApp) {
      console.log('[QuickTaskExpired] Clearing t_intention for app:', quickTaskState.expiredApp);
      clearIntentionTimer(quickTaskState.expiredApp);
    }
    
    // Reset Quick Task state (hide the expired screen state)
    console.log('[QuickTaskExpired] Dispatching HIDE_EXPIRED');
    dispatchQuickTask({ type: 'HIDE_EXPIRED' });
    
    // Finish InterventionActivity and launch home screen
    if (Platform.OS === 'android' && AppMonitorModule) {
      try {
        console.log('[QuickTaskExpired] Launching home screen');
        AppMonitorModule.launchHomeScreen();
        console.log('[QuickTaskExpired] Home screen launched');
      } catch (error) {
        console.error('[QuickTaskExpired] Error launching home screen:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Clock size={48} color="#71717A" strokeWidth={1.5} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Title */}
        <Text style={styles.titleText}>Quick Task Ended</Text>
        
        {/* App Name */}
        <Text style={styles.appNameText}>for {appName}</Text>

        {/* Description */}
        <Text style={styles.descriptionText}>
          Your emergency window is over.{'\n'}
          It's time to return to what matters.
        </Text>
      </View>

      {/* Action */}
      <View style={styles.actionContainer}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Close & Go Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // background (dark mode)
    paddingHorizontal: 24,
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#18181B', // surfaceSecondary
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A', // border
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  titleText: {
    fontSize: 28, // h1
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FAFAFA', // textPrimary
    textAlign: 'center',
    marginBottom: 8,
  },
  appNameText: {
    fontSize: 18, // h3
    lineHeight: 28,
    fontWeight: '600',
    color: '#6558B8', // accent color
    textAlign: 'center',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16, // body
    lineHeight: 24,
    fontWeight: '400',
    color: '#A1A1AA', // textSecondary
    textAlign: 'center',
  },
  actionContainer: {
    paddingBottom: 32,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8, // radius_8
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6558B8', // Steady accent color
    // elevation_1
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16, // button
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: '#FAFAFA', // textPrimary
  },
});

