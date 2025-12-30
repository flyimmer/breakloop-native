import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, Eye, LogOut, Shield, Sliders, Smartphone, User, Zap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIntervention } from '@/src/contexts/InterventionProvider';
import { completeInterventionDEV } from '@/src/os/osTriggerBrain';
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
  // Note: Stored as app names (e.g., 'Instagram', 'TikTok') for display compatibility
  const [monitoredApps, setMonitoredApps] = useState<string[]>(['Instagram', 'TikTok']);
  const [monitoredWebsites, setMonitoredWebsites] = useState<string[]>([]);

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
      setMonitoredApps(apps);
      setMonitoredWebsites(websites);
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
            <View style={styles.appsList}>
              {monitoredApps.map((app, index) => (
                <View
                  key={app}
                  style={[
                    styles.appChip,
                    index === monitoredApps.length - 1 && styles.appChipLast,
                  ]}
                >
                  <Text style={styles.appChipText}>{app}</Text>
                </View>
              ))}
            </View>
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
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Intervention Duration</Text>
              <Text style={styles.preferenceValue}>5s</Text>
            </View>
            <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
              <Text style={styles.preferenceLabel}>App Switch Interval</Text>
              <Text style={styles.preferenceValue}>5m</Text>
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
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>Free</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>Duration</Text>
              <Text style={styles.preferenceValue}>3 min</Text>
            </View>
            <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
              <Text style={styles.preferenceLabel}>Uses per 15 minutes</Text>
              <Text style={styles.preferenceValue}>1</Text>
            </View>
            <Text style={styles.upgradeHint}>Upgrade to Premium to customize these.</Text>
            <TouchableOpacity style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
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
});

export default SettingsScreen;

