import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, Eye, LogOut, Shield, Sliders, Smartphone, User, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppMonitorModule as AppMonitorModuleType, InstalledApp } from '@/src/native-modules/AppMonitorModule';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { completeInterventionDEV } from '@/src/os/osTriggerBrain';
import { setMonitoredApps as updateOsConfigMonitoredApps, setQuickTaskConfig, getQuickTaskDurationMs, getQuickTaskUsesPerWindow, getIsPremiumCustomer, setInterventionPreferences, getInterventionDurationSec } from '@/src/os/osConfig';
import { RootStackParamList } from '../../../navigation/RootNavigator';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Module-level callback for EditMonitoredApps to pass data back
// This is a simple workaround since React Navigation doesn't support function callbacks in params
export let editAppsCallback: ((apps: string[], websites: string[]) => void) | null = null;

const SettingsScreen = () => {
  // Navigation
  const navigation = useNavigation<NavigationProp>();
  
  // Intervention context (for debug button)
  const { dispatchIntervention } = useIntervention();

  // Mock state - replace with actual state management
  // Profile state (independent of authentication)
  const [userProfile, setUserProfile] = useState<{
    displayName: string;
    aboutMe: string;
    interests: string;
    primaryPhoto: string | null;
  }>({
    displayName: 'Wei',
    aboutMe: 'papa',
    interests: 'swim',
    primaryPhoto: null, // Set to null to show placeholder icon
  });
  
  // Authentication state (separate concern, affects Account section only)
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [userAccount, setUserAccount] = useState({
    email: 'wei@example.com',
  });

  // Edit mode state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<{
    displayName: string;
    aboutMe: string;
    interests: string;
    primaryPhoto: string | null;
  }>({
    displayName: '',
    aboutMe: '',
    interests: '',
    primaryPhoto: null,
  });

  // Social privacy toggles
  const [shareCurrentActivity, setShareCurrentActivity] = useState(true);
  const [shareUpcomingActivities, setShareUpcomingActivities] = useState(false);
  const [shareRecentMood, setShareRecentMood] = useState(true);
  const [shareAlternativesList, setShareAlternativesList] = useState(true);

  // Monitored apps and websites state
  // Note: Stored as package names (e.g., 'com.instagram.android') for monitoring
  // We'll display app names by looking them up from the installed apps list
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [monitoredWebsites, setMonitoredWebsites] = useState<string[]>([]);
  
  // Cache of installed apps for display name lookup
  const [installedAppsCache, setInstalledAppsCache] = useState<InstalledApp[]>([]);

  // Storage key for monitored apps
  const MONITORED_APPS_STORAGE_KEY = 'monitored_apps_v1';
  
  // Quick Task settings state
  const [quickTaskDuration, setQuickTaskDuration] = useState<number>(3 * 60 * 1000); // Default: 3 minutes in ms
  const [quickTaskUsesPerWindow, setQuickTaskUsesPerWindow] = useState<number>(1); // Default: 1 use
  const [isPremium, setIsPremium] = useState<boolean>(false); // Default: free
  
  // Intervention preferences state
  const [interventionDuration, setInterventionDuration] = useState<number>(5); // Default: 5 seconds
  
  // Accessibility service status
  const [isAccessibilityEnabled, setIsAccessibilityEnabled] = useState<boolean>(false);
  const [isCheckingAccessibility, setIsCheckingAccessibility] = useState<boolean>(false);
  
  // Storage key for Quick Task settings
  const QUICK_TASK_SETTINGS_STORAGE_KEY = 'quick_task_settings_v1';
  // Storage key for Intervention preferences
  const INTERVENTION_PREFERENCES_STORAGE_KEY = 'intervention_preferences_v1';

  // Load monitored apps from storage on mount
  useEffect(() => {
    loadMonitoredApps();
    loadQuickTaskSettings();
    loadInterventionPreferences();
    checkAccessibilityStatus();
  }, []);

  // Check accessibility status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkAccessibilityStatus();
    }, [])
  );

  // Check if accessibility service is enabled
  const checkAccessibilityStatus = async () => {
    if (Platform.OS !== 'android' || !AppMonitorModuleType) {
      return;
    }

    try {
      setIsCheckingAccessibility(true);
      const enabled = await AppMonitorModuleType.isAccessibilityServiceEnabled();
      setIsAccessibilityEnabled(enabled);
      console.log('[SettingsScreen] Accessibility service enabled:', enabled);
    } catch (error) {
      console.error('[SettingsScreen] Failed to check accessibility status:', error);
      setIsAccessibilityEnabled(false);
    } finally {
      setIsCheckingAccessibility(false);
    }
  };

  // Load installed apps cache on mount (for display name lookup)
  useEffect(() => {
    if (Platform.OS === 'android' && AppMonitorModuleType) {
      loadInstalledAppsCache();
    }
  }, []);

  const loadMonitoredApps = async () => {
    try {
      const stored = await AsyncStorage.getItem(MONITORED_APPS_STORAGE_KEY);
      if (stored) {
        const apps = JSON.parse(stored);
        console.log('[SettingsScreen] 📥 Loaded monitored apps from storage:', apps);
        setMonitoredApps(apps);
        // Update osConfig with loaded apps
        updateOsConfigMonitoredApps(apps);
        console.log('[SettingsScreen] ✅ Updated osConfig with', apps.length, 'apps');
      } else {
        console.log('[SettingsScreen] ℹ️ No monitored apps in storage yet');
      }
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to load monitored apps:', error);
    }
  };

  const saveMonitoredApps = async (apps: string[]) => {
    try {
      console.log('[SettingsScreen] 💾 Saving monitored apps:', apps);
      await AsyncStorage.setItem(MONITORED_APPS_STORAGE_KEY, JSON.stringify(apps));
      // Update osConfig immediately
      updateOsConfigMonitoredApps(apps);
      console.log('[SettingsScreen] ✅ Successfully saved and updated osConfig with', apps.length, 'apps');
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to save monitored apps:', error);
      Alert.alert('Error', 'Failed to save monitored apps. Please try again.');
    }
  };

  const loadInstalledAppsCache = async () => {
    try {
      const apps = await AppMonitorModuleType.getInstalledApps();
      setInstalledAppsCache(apps);
    } catch (error) {
      console.error('Failed to load installed apps cache:', error);
      // Non-critical error - continue without cache
    }
  };

  // Load Quick Task settings from storage
  const loadQuickTaskSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUICK_TASK_SETTINGS_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        console.log('[SettingsScreen] 📥 Loaded Quick Task settings from storage:', settings);
        const durationMs = settings.durationMs || getQuickTaskDurationMs();
        const usesPerWindow = settings.usesPerWindow || getQuickTaskUsesPerWindow();
        const isPremiumCustomer = settings.isPremium !== undefined ? settings.isPremium : getIsPremiumCustomer();
        setQuickTaskDuration(durationMs);
        setQuickTaskUsesPerWindow(usesPerWindow);
        setIsPremium(isPremiumCustomer);
        // Update osConfig with loaded settings
        setQuickTaskConfig(durationMs, usesPerWindow, isPremiumCustomer);
      } else {
        // Load from osConfig defaults
        const durationMs = getQuickTaskDurationMs();
        const usesPerWindow = getQuickTaskUsesPerWindow();
        const isPremiumCustomer = getIsPremiumCustomer();
        setQuickTaskDuration(durationMs);
        setQuickTaskUsesPerWindow(usesPerWindow);
        setIsPremium(isPremiumCustomer);
        console.log('[SettingsScreen] ℹ️ No Quick Task settings in storage, using osConfig defaults');
      }
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to load Quick Task settings:', error);
      // Use osConfig defaults
      const durationMs = getQuickTaskDurationMs();
      const usesPerWindow = getQuickTaskUsesPerWindow();
      const isPremiumCustomer = getIsPremiumCustomer();
      setQuickTaskDuration(durationMs);
      setQuickTaskUsesPerWindow(usesPerWindow);
      setIsPremium(isPremiumCustomer);
    }
  };

  // Save Quick Task settings to storage
  // NOTE: Changes apply immediately - setQuickTaskConfig() updates in-memory config
  // The next Quick Task availability check will use the new value
  const saveQuickTaskSettings = async (durationMs: number, usesPerWindow: number, isPremium: boolean) => {
    try {
      const settings = {
        durationMs,
        usesPerWindow,
        isPremium,
      };
      console.log('[SettingsScreen] 💾 Saving Quick Task settings:', settings);
      await AsyncStorage.setItem(QUICK_TASK_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      // Update osConfig immediately - applies to next Quick Task check
      setQuickTaskConfig(durationMs, usesPerWindow, isPremium);
      console.log('[SettingsScreen] ✅ Successfully saved Quick Task settings (applied immediately)');
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to save Quick Task settings:', error);
      Alert.alert('Error', 'Failed to save Quick Task settings. Please try again.');
    }
  };

  // Load Intervention preferences from storage
  const loadInterventionPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(INTERVENTION_PREFERENCES_STORAGE_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        console.log('[SettingsScreen] 📥 Loaded intervention preferences from storage:', preferences);
        const durationSec = preferences.interventionDurationSec || getInterventionDurationSec();
        setInterventionDuration(durationSec);
        // Update osConfig with loaded preferences
        setInterventionPreferences(durationSec);
      } else {
        // Load from osConfig defaults
        const durationSec = getInterventionDurationSec();
        setInterventionDuration(durationSec);
        console.log('[SettingsScreen] ℹ️ No intervention preferences in storage, using osConfig defaults');
      }
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to load intervention preferences:', error);
      // Use osConfig defaults
      const durationSec = getInterventionDurationSec();
      setInterventionDuration(durationSec);
    }
  };

  // Save Intervention preferences to storage
  // NOTE: Changes apply immediately - setInterventionPreferences() updates in-memory config
  const saveInterventionPreferences = async (durationSec: number) => {
    try {
      const preferences = {
        interventionDurationSec: durationSec,
      };
      console.log('[SettingsScreen] 💾 Saving intervention preferences:', preferences);
      await AsyncStorage.setItem(INTERVENTION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
      // Update osConfig immediately - applies to next intervention
      setInterventionPreferences(durationSec);
      console.log('[SettingsScreen] ✅ Successfully saved intervention preferences (applied immediately)');
    } catch (error) {
      console.error('[SettingsScreen] ❌ Failed to save intervention preferences:', error);
      Alert.alert('Error', 'Failed to save intervention preferences. Please try again.');
    }
  };

  // Handle duration selection
  const handleDurationSelect = (durationMs: number) => {
    if (!isPremium) {
      Alert.alert('Premium Feature', 'Upgrade to Premium to customize Quick Task duration.');
      return;
    }
    setQuickTaskDuration(durationMs);
    saveQuickTaskSettings(durationMs, quickTaskUsesPerWindow, isPremium);
  };

  // Handle uses per window selection
  // -1 represents unlimited (for testing purposes)
  // Changes apply immediately - no restart needed
  const handleUsesSelect = (uses: number) => {
    if (!isPremium) {
      Alert.alert('Premium Feature', 'Upgrade to Premium to customize Quick Task uses.');
      return;
    }
    setQuickTaskUsesPerWindow(uses);
    // This updates the in-memory config immediately via setQuickTaskConfig()
    // The next Quick Task check will use the new value
    saveQuickTaskSettings(quickTaskDuration, uses, isPremium);
  };

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = seconds / 60;
    return `${minutes}m`;
  };

  // Handle intervention duration selection (5-30 seconds)
  const handleInterventionDurationSelect = (durationSec: number) => {
    setInterventionDuration(durationSec);
    saveInterventionPreferences(durationSec);
  };

  // Helper function to get app name from package name
  const getAppName = (packageName: string): string => {
    const app = installedAppsCache.find((a) => a.packageName === packageName);
    return app ? app.appName : packageName; // Fallback to package name if not found
  };

  // Profile state check (independent of authentication)
  const hasProfile = !!(userProfile.displayName || userProfile.aboutMe || userProfile.interests || userProfile.primaryPhoto);

  const handleEditProfile = () => {
    setProfileDraft({ ...userProfile });
    setIsEditingProfile(true);
  };

  const handleSetupProfile = () => {
    // Initialize empty profile for first-time setup
    setProfileDraft({
      displayName: '',
      aboutMe: '',
      interests: '',
      primaryPhoto: null,
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = () => {
    setUserProfile({ ...profileDraft });
    setIsEditingProfile(false);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setProfileDraft({
      displayName: '',
      aboutMe: '',
      interests: '',
      primaryPhoto: null,
    });
  };

  const handleAddPhoto = async () => {
    // Request permission to access media library
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile photo
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Update the draft with the selected photo URI
      setProfileDraft({ ...profileDraft, primaryPhoto: result.assets[0].uri });
    }
  };

  const handleLogOut = () => {
    // TODO: Implement logout
    console.log('Log out');
  };

  const handleEditApps = () => {
    // Set up callback before navigating
    editAppsCallback = (apps: string[], websites: string[]) => {
      console.log('[SettingsScreen] 📱 Edit apps callback received:', { apps, websites });
      setMonitoredApps(apps);
      setMonitoredWebsites(websites);
      // Persist to AsyncStorage and update osConfig
      saveMonitoredApps(apps);
      editAppsCallback = null; // Clear after use
    };

    navigation.navigate('EditMonitoredApps', {
      initialApps: monitoredApps,
      initialWebsites: monitoredWebsites,
    });
  };

  // DEV-ONLY: Debug button to start intervention flow
  // Wrapped behind __DEV__ flag for easy removal before production
  const handleStartInterventionDebug = () => {
    // Dispatch BEGIN_INTERVENTION action with mock app
    // This sets interventionState to "breathing" and starts the countdown
    dispatchIntervention({
      type: 'BEGIN_INTERVENTION',
      app: {
        id: 'debug-instagram',
        name: 'Instagram',
      },
      breathingDuration: 5, // Default 5 seconds
    });
    // Navigation will react to state change automatically
    // (interventionState changes from 'idle' to 'breathing')
  };

  // DEV-ONLY: Manually complete Instagram intervention for testing Step 5F
  const handleCompleteInstagramIntervention = () => {
    completeInterventionDEV('com.instagram.android');
    Alert.alert(
      'DEV: Intervention Completed',
      'Instagram intervention completed. OS Trigger Brain can now trigger new interventions.',
      [{ text: 'OK' }]
    );
  };

  // DEV-ONLY: Stop monitoring service for testing
  const handleStopMonitoringService = () => {
    if (Platform.OS !== 'android' || !AppMonitorModule) {
      Alert.alert('Error', 'Monitoring service not available');
      return;
    }

    Alert.alert(
      'Stop Monitoring Service?',
      'This will stop the foreground app monitoring service. Normally it should run independently even when the app is closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            AppMonitorModule.stopMonitoring()
              .then(() => {
                Alert.alert('Success', 'Monitoring service stopped');
              })
              .catch((error: any) => {
                Alert.alert('Error', `Failed to stop: ${error.message}`);
              });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* My Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <User size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>My Profile</Text>
            </View>
            {!isEditingProfile && hasProfile && (
              <TouchableOpacity onPress={handleEditProfile}>
                <Text style={styles.editButton}>Edit profile</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingProfile ? (
            /* Edit Mode */
            <View style={styles.profileCard}>
              {/* Profile Photo Section */}
              <View style={styles.editPhotoSection}>
                <Text style={styles.fieldLabel}>Profile Photo</Text>
                <View style={styles.photoRow}>
                  {profileDraft.primaryPhoto ? (
                    <Image
                      source={{ uri: profileDraft.primaryPhoto }}
                      style={styles.profilePhoto}
                    />
                  ) : (
                    <View style={styles.profilePhotoPlaceholder}>
                      <Camera size={24} color="#A1A1AA" />
                    </View>
                  )}
                  <TouchableOpacity onPress={handleAddPhoto}>
                    <Text style={styles.addPhotoButton}>
                      {profileDraft.primaryPhoto ? 'Change Photo' : 'Add Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.photoHint}>Visible to friends once you connect.</Text>
              </View>

              {/* Display Name */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your name (optional)"
                  placeholderTextColor="#A1A1AA"
                  value={profileDraft.displayName}
                  onChangeText={(text) => setProfileDraft({ ...profileDraft, displayName: text })}
                />
              </View>

              {/* About Me */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>About Me</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Tell others a bit about yourself (optional)"
                  placeholderTextColor="#A1A1AA"
                  value={profileDraft.aboutMe}
                  onChangeText={(text) => setProfileDraft({ ...profileDraft, aboutMe: text })}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <Text style={styles.fieldHint}>
                  Examples: "I enjoy quiet activities and walks." or "Usually free evenings."
                </Text>
              </View>

              {/* Preferences / Interests */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Preferences / Interests</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Your interests or preferences (optional)"
                  placeholderTextColor="#A1A1AA"
                  value={profileDraft.interests}
                  onChangeText={(text) => setProfileDraft({ ...profileDraft, interests: text })}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : hasProfile ? (
            /* View Mode - Profile Exists */
            <View style={styles.profileCard}>
              <View style={styles.identityBlock}>
                {/* Profile Photo */}
                {userProfile.primaryPhoto ? (
                  <Image
                    source={{ uri: userProfile.primaryPhoto }}
                    style={styles.profilePhoto}
                  />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <User size={32} color="#A1A1AA" strokeWidth={1.5} />
                  </View>
                )}

                {/* Display Name */}
                <Text style={styles.profileName}>
                  {userProfile.displayName || 'You'}
                </Text>
              </View>
            </View>
          ) : (
            /* View Mode - No Profile */
            <View style={styles.profileCardEmpty}>
              <View style={styles.identityBlockEmpty}>
                {/* Larger Neutral Profile Placeholder */}
                <View style={styles.profilePhotoPlaceholderLarge}>
                  <User size={40} color="#A1A1AA" strokeWidth={1.5} />
                </View>

                {/* Display Name */}
                <Text style={styles.profileNameEmpty}>Not set</Text>

                {/* Single Purpose Line */}
                <Text style={styles.profilePurposeLine}>
                  Your profile helps friends recognize you.
                </Text>

                {/* Setup Action */}
                <TouchableOpacity style={styles.setupProfileButton} onPress={handleSetupProfile}>
                  <Text style={styles.setupProfileButtonText}>Set up profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Shield size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
          </View>

          <View style={styles.card}>
            {isLoggedIn ? (
              <>
                <View style={styles.accountInfo}>
                  <View style={styles.accountAvatar}>
                    <Text style={styles.accountAvatarText}>
                      {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'W'}
                    </Text>
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>
                      {userProfile.displayName || 'Wei'}
                    </Text>
                    <Text style={styles.accountEmail}>{userAccount.email}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.logOutButton} onPress={handleLogOut}>
                  <LogOut size={16} color="#52525B" />
                  <Text style={styles.logOutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.authButtons}>
                <TouchableOpacity style={styles.signInButton}>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.registerButton}>
                  <Text style={styles.registerButtonText}>Register</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Social Privacy Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Eye size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Social Privacy</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>Controls what your friends can see.</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Share Current Activity</Text>
              <Switch
                value={shareCurrentActivity}
                onValueChange={setShareCurrentActivity}
                trackColor={{ false: '#E4E4E7', true: '#9B91E8' }}
                thumbColor={shareCurrentActivity ? '#7C6FD9' : '#f4f3f4'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Share Upcoming Activities</Text>
              <Switch
                value={shareUpcomingActivities}
                onValueChange={setShareUpcomingActivities}
                trackColor={{ false: '#E4E4E7', true: '#9B91E8' }}
                thumbColor={shareUpcomingActivities ? '#7C6FD9' : '#f4f3f4'}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Share Recent Mood</Text>
              <Switch
                value={shareRecentMood}
                onValueChange={setShareRecentMood}
                trackColor={{ false: '#E4E4E7', true: '#9B91E8' }}
                thumbColor={shareRecentMood ? '#7C6FD9' : '#f4f3f4'}
              />
            </View>
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <Text style={styles.settingLabel}>Share Alternatives List</Text>
              <Switch
                value={shareAlternativesList}
                onValueChange={setShareAlternativesList}
                trackColor={{ false: '#E4E4E7', true: '#9B91E8' }}
                thumbColor={shareAlternativesList ? '#7C6FD9' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>

        {/* Monitored Apps Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Smartphone size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Monitored Apps</Text>
            </View>
            <TouchableOpacity onPress={handleEditApps}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {monitoredApps.length === 0 ? (
              <Text style={styles.emptyAppsText}>No apps selected</Text>
            ) : (
              <View style={styles.appsList}>
                {monitoredApps.map((packageName, index) => (
                  <View
                    key={packageName}
                    style={[
                      styles.appChip,
                      index === monitoredApps.length - 1 && styles.appChipLast,
                    ]}
                  >
                    <Text style={styles.appChipText}>{getAppName(packageName)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Sliders size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Preferences</Text>
            </View>
          </View>

          <View style={styles.card}>
            {/* Intervention Duration (Breathing Duration) */}
            <Text style={styles.quickTaskLabel}>Intervention Duration (Breathing)</Text>
            <Text style={styles.preferencesDescription}>
              How long the breathing countdown lasts before showing root causes.
            </Text>
            <View style={styles.quickTaskButtonRow}>
              <TouchableOpacity
                style={[
                  styles.quickTaskButton,
                  interventionDuration === 5 && styles.quickTaskButtonSelected,
                ]}
                onPress={() => handleInterventionDurationSelect(5)}
              >
                <Text
                  style={[
                    styles.quickTaskButtonText,
                    interventionDuration === 5 && styles.quickTaskButtonTextSelected,
                  ]}
                >
                  5s
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickTaskButton,
                  interventionDuration === 10 && styles.quickTaskButtonSelected,
                ]}
                onPress={() => handleInterventionDurationSelect(10)}
              >
                <Text
                  style={[
                    styles.quickTaskButtonText,
                    interventionDuration === 10 && styles.quickTaskButtonTextSelected,
                  ]}
                >
                  10s
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickTaskButton,
                  interventionDuration === 15 && styles.quickTaskButtonSelected,
                ]}
                onPress={() => handleInterventionDurationSelect(15)}
              >
                <Text
                  style={[
                    styles.quickTaskButtonText,
                    interventionDuration === 15 && styles.quickTaskButtonTextSelected,
                  ]}
                >
                  15s
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickTaskButton,
                  interventionDuration === 20 && styles.quickTaskButtonSelected,
                ]}
                onPress={() => handleInterventionDurationSelect(20)}
              >
                <Text
                  style={[
                    styles.quickTaskButtonText,
                    interventionDuration === 20 && styles.quickTaskButtonTextSelected,
                  ]}
                >
                  20s
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickTaskButton,
                  interventionDuration === 30 && styles.quickTaskButtonSelected,
                ]}
                onPress={() => handleInterventionDurationSelect(30)}
              >
                <Text
                  style={[
                    styles.quickTaskButtonText,
                    interventionDuration === 30 && styles.quickTaskButtonTextSelected,
                  ]}
                >
                  30s
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Task Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Zap size={16} color="#52525B" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Quick Task (Emergency)</Text>
            </View>
            {isPremium ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            ) : (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            {isPremium ? (
              <>
                {/* Duration Selection */}
                <Text style={styles.quickTaskLabel}>Duration</Text>
                <View style={styles.quickTaskButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskDuration === 10 * 1000 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleDurationSelect(10 * 1000)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskDuration === 10 * 1000 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      Testing (10 s)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskDuration === 2 * 60 * 1000 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleDurationSelect(2 * 60 * 1000)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskDuration === 2 * 60 * 1000 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      Short (2m)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskDuration === 3 * 60 * 1000 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleDurationSelect(3 * 60 * 1000)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskDuration === 3 * 60 * 1000 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      Standard (3m)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskDuration === 5 * 60 * 1000 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleDurationSelect(5 * 60 * 1000)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskDuration === 5 * 60 * 1000 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      Longer (5m)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Uses per 15 minutes Selection */}
                <Text style={[styles.quickTaskLabel, { marginTop: 20 }]}>Quick tasks per 15 minutes</Text>
                <View style={styles.quickTaskButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskUsesPerWindow === 0 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleUsesSelect(0)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskUsesPerWindow === 0 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      No
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskUsesPerWindow === 1 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleUsesSelect(1)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskUsesPerWindow === 1 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      1 use
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskUsesPerWindow === 2 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleUsesSelect(2)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskUsesPerWindow === 2 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      2 uses
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickTaskButton,
                      quickTaskUsesPerWindow === 100 && styles.quickTaskButtonSelected,
                    ]}
                    onPress={() => handleUsesSelect(100)}
                  >
                    <Text
                      style={[
                        styles.quickTaskButtonText,
                        quickTaskUsesPerWindow === 100 && styles.quickTaskButtonTextSelected,
                      ]}
                    >
                      100
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.preferenceRow}>
                  <Text style={styles.preferenceLabel}>Duration</Text>
                  <Text style={styles.preferenceValue}>{formatDuration(quickTaskDuration)}</Text>
                </View>
                <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
                  <Text style={styles.preferenceLabel}>Uses per 15 minutes</Text>
                  <Text style={styles.preferenceValue}>
                    {quickTaskUsesPerWindow === 0 
                      ? 'No' 
                      : quickTaskUsesPerWindow}
                  </Text>
                </View>
                <Text style={styles.upgradeHint}>Upgrade to Premium to customize these.</Text>
                <TouchableOpacity style={styles.upgradeButton}>
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Accessibility Service Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Intervention System</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>
            Enable accessibility service to detect monitored apps and trigger interventions.
          </Text>

          <View style={styles.card}>
            {/* Status indicator */}
            <View style={styles.accessibilityStatusRow}>
              <View style={[styles.statusIndicator, isAccessibilityEnabled ? styles.statusIndicatorEnabled : styles.statusIndicatorDisabled]} />
              <Text style={styles.accessibilityStatusText}>
                {isCheckingAccessibility 
                  ? 'Checking status...' 
                  : isAccessibilityEnabled 
                    ? 'Accessibility service is enabled' 
                    : 'Accessibility service is disabled'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.accessibilityButton,
                isAccessibilityEnabled && styles.accessibilityButtonEnabled
              ]}
              onPress={async () => {
                console.log('[SettingsScreen] Accessibility button pressed');
                console.log('[SettingsScreen] Platform.OS:', Platform.OS);
                console.log('[SettingsScreen] AppMonitorModule available:', !!AppMonitorModule);
                console.log('[SettingsScreen] AppMonitorModuleType available:', !!AppMonitorModuleType);
                console.log('[SettingsScreen] NativeModules.AppMonitorModule available:', !!NativeModules.AppMonitorModule);
                
                // Try local AppMonitorModule first (has platform check)
                const moduleToUse = AppMonitorModule || AppMonitorModuleType;
                
                if (!moduleToUse) {
                  console.error('[SettingsScreen] No native module available');
                  Alert.alert(
                    'Error', 
                    'Native module not available. This feature requires Android and the native module to be properly linked.\n\nPlease:\n1. Make sure you are on Android\n2. Rebuild the app: npm run android\n3. Restart the app'
                  );
                  return;
                }

                try {
                  console.log('[SettingsScreen] Opening accessibility settings...');
                  const result = await moduleToUse.openAccessibilitySettings();
                  console.log('[SettingsScreen] Accessibility settings opened:', result);
                  // Status will be checked when screen refocuses
                } catch (error) {
                  console.error('[SettingsScreen] Failed to open accessibility settings:', error);
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  Alert.alert(
                    'Error', 
                    `Failed to open Accessibility settings: ${errorMessage}\n\nPlease go to Settings > Accessibility manually.`
                  );
                }
              }}
              disabled={isCheckingAccessibility}
            >
              <Text style={styles.accessibilityButtonText}>
                {isAccessibilityEnabled ? 'Open Accessibility Settings' : 'Enable Accessibility Service'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.accessibilityHint}>
              {isAccessibilityEnabled 
                ? 'Service is active. Tap above to open settings if you need to disable it.'
                : 'Required for interventions to work. Enable it once and it should persist across app updates.'}
            </Text>
          </View>
        </View>

        {/* Advanced / Development Tools */}
        {__DEV__ && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Demo / Test / Advanced</Text>
              </View>
            </View>
            <Text style={styles.sectionDescription}>
              Debug tools for testing intervention state machine. Remove before production.
            </Text>

            <View style={styles.card}>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={handleStartInterventionDebug}
              >
                <Text style={styles.debugButtonText}>Start Intervention (DEV)</Text>
              </TouchableOpacity>
              <Text style={styles.debugHint}>
                Development-only trigger
              </Text>

              <TouchableOpacity
                style={[styles.debugButton, { marginTop: 16 }]}
                onPress={handleCompleteInstagramIntervention}
              >
                <Text style={styles.debugButtonText}>DEV: Complete Instagram Intervention</Text>
              </TouchableOpacity>
              <Text style={styles.debugHint}>
                Manually complete to allow retesting (Step 5F)
              </Text>

              <TouchableOpacity
                style={[styles.debugButton, { marginTop: 16, borderColor: '#EF4444' }]}
                onPress={handleStopMonitoringService}
              >
                <Text style={[styles.debugButtonText, { color: '#EF4444' }]}>
                  DEV: Stop Monitoring Service
                </Text>
              </TouchableOpacity>
              <Text style={styles.debugHint}>
                Stop foreground service (normally runs independently)
              </Text>
            </View>
          </View>
        )}

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>v17.6 (BreakLoop Privacy)</Text>
    </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: '#52525B',
    textTransform: 'uppercase',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    marginBottom: 12,
  },
  editButton: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#7C6FD9',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  profileCardEmpty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  identityBlock: {
    alignItems: 'center',
  },
  identityBlockEmpty: {
    alignItems: 'center',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    marginBottom: 12,
  },
  profilePhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profilePhotoPlaceholderLarge: {
    width: 100,
    height: 100,
    borderRadius: 9999,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#18181B',
    marginBottom: 4,
  },
  profileNameEmpty: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: -0.2,
    color: '#18181B',
    marginBottom: 8,
  },
  profilePurposeLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: 20,
  },
  setupProfileButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  setupProfileButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#52525B',
  },
  emptyStateHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  profileField: {
    width: '100%',
    marginTop: 16,
  },
  profileSectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0,
    color: '#18181B',
    marginBottom: 6,
  },
  profileFieldValue: {
    fontSize: 16,
    lineHeight: 24,
    color: '#52525B',
  },
  notLoggedInText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: '#E0DCFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#7C6FD9',
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#18181B',
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
  },
  logOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  logOutButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#52525B',
    marginLeft: 8,
  },
  authButtons: {
    gap: 12,
  },
  signInButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#7C6FD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  registerButton: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#52525B',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F6',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingLabel: {
    fontSize: 16,
    lineHeight: 24,
    color: '#18181B',
  },
  appsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F4F4F6',
  },
  appChipLast: {
    // No special styling needed, just for consistency
  },
  appChipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#52525B',
  },
  emptyAppsText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    fontStyle: 'italic',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F6',
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
  },
  preferenceLabel: {
    fontSize: 16,
    lineHeight: 24,
    color: '#18181B',
  },
  preferenceValue: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#7C6FD9',
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F4F4F6',
  },
  freeBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#52525B',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E0DCFC',
  },
  premiumBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#7C6FD9',
  },
  quickTaskLabel: {
    fontSize: 16,
    lineHeight: 24,
    color: '#18181B',
    marginBottom: 12,
  },
  preferencesDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    marginBottom: 12,
  },
  quickTaskButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  quickTaskButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
  },
  quickTaskButtonSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  quickTaskButtonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#52525B',
    textAlign: 'center',
  },
  quickTaskButtonTextSelected: {
    color: '#22C55E',
    fontWeight: '600',
  },
  upgradeHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    marginTop: 12,
    marginBottom: 12,
  },
  upgradeButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#7C6FD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  advancedLink: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A1A1AA',
  },
  // Edit Mode Styles
  editPhotoSection: {
    marginBottom: 24,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  addPhotoButton: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 16,
  },
  photoHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A1A1AA',
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#18181B',
    marginBottom: 8,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#18181B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 88,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A1A1AA',
    marginTop: 8,
  },
  editActions: {
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#52525B',
  },
  debugButton: {
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F4F4F6',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  debugButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#52525B',
  },
  debugHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A1A1AA',
    fontStyle: 'italic',
  },
  accessibilityStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#27272A',
    borderRadius: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusIndicatorEnabled: {
    backgroundColor: '#10B981',
  },
  statusIndicatorDisabled: {
    backgroundColor: '#EF4444',
  },
  accessibilityStatusText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F4F4F5',
    fontWeight: '500',
  },
  accessibilityButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#7C6FD9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  accessibilityButtonEnabled: {
    backgroundColor: '#3F3F46',
    borderWidth: 1,
    borderColor: '#52525B',
  },
  accessibilityButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accessibilityHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
  },
});

export default SettingsScreen;

