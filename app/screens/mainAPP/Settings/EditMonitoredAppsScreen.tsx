import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeModules } from 'react-native';
import { AppMonitorModule as AppMonitorModuleType, InstalledApp } from '@/src/native-modules/AppMonitorModule';
import { RootStackParamList } from '../../../navigation/RootNavigator';
import { matchesAppSearch, getMatchScore } from '@/constants/appAliases';

const AppMonitorModule = Platform.OS === 'android' ? NativeModules.AppMonitorModule : null;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'apps' | 'websites';

interface EditMonitoredAppsScreenProps {
  route: {
    params: {
      initialApps?: string[]; // Now expects package names (e.g., 'com.instagram.android')
      initialWebsites?: string[];
    };
  };
}

export default function EditMonitoredAppsScreen({ route }: EditMonitoredAppsScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { initialApps = [], initialWebsites = [] } = route.params || {};

  const [activeTab, setActiveTab] = useState<TabType>('apps');
  const [selectedApps, setSelectedApps] = useState<string[]>(initialApps); // Store package names
  const [websites, setWebsites] = useState<string[]>(initialWebsites);
  const [websiteInput, setWebsiteInput] = useState('');
  
  // Real installed apps from device
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch installed apps on mount (Android only)
  useEffect(() => {
    if (Platform.OS === 'android' && AppMonitorModule && AppMonitorModuleType) {
      loadInstalledApps();
    } else {
      // iOS or module not available - show empty state or fallback
      setIsLoadingApps(false);
      if (Platform.OS !== 'android') {
        Alert.alert(
          'Not Available',
          'App list is only available on Android devices.',
          [{ text: 'OK' }]
        );
      }
    }
  }, []);

  const loadInstalledApps = async () => {
    try {
      setIsLoadingApps(true);
      const apps = await AppMonitorModuleType.getInstalledApps();
      
      console.log(`[EditMonitoredApps] Loaded ${apps.length} apps`);
      console.log('[EditMonitoredApps] First 10 apps:', apps.slice(0, 10).map(a => a.appName));
      
      // Debug: Check if Instagram is in the list
      const instagram = apps.find(app => 
        app.packageName.includes('instagram') || 
        app.appName.toLowerCase().includes('instagram')
      );
      console.log('[EditMonitoredApps] Instagram found:', instagram);
      
      // Debug: Check if TikTok is in the list
      const tiktok = apps.find(app => 
        app.packageName.toLowerCase().includes('tiktok') || 
        app.packageName.includes('musically') ||
        app.appName.toLowerCase().includes('tiktok')
      );
      console.log('[EditMonitoredApps] TikTok found:', tiktok);
      
      // Debug: Log all package names that contain common social media keywords
      const socialApps = apps.filter(app =>
        app.packageName.includes('facebook') ||
        app.packageName.includes('twitter') ||
        app.packageName.includes('snapchat') ||
        app.packageName.includes('reddit')
      );
      console.log('[EditMonitoredApps] Social apps found:', socialApps.length, socialApps.map(a => a.packageName));
      
      // Sort by app name alphabetically
      apps.sort((a, b) => a.appName.localeCompare(b.appName));
      
      setInstalledApps(apps);
    } catch (error: any) {
      console.error('Failed to load installed apps:', error);
      Alert.alert(
        'Error',
        'Failed to load installed apps. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Toggle app selection (by package name)
  const handleToggleApp = (packageName: string) => {
    setSelectedApps((prev) => {
      if (prev.includes(packageName)) {
        return prev.filter((pkg) => pkg !== packageName);
      } else {
        return [...prev, packageName];
      }
    });
  };

  // Add website
  const handleAddWebsite = () => {
    const trimmed = websiteInput.trim();
    if (trimmed && !websites.includes(trimmed)) {
      setWebsites((prev) => [...prev, trimmed]);
      setWebsiteInput('');
    }
  };

  // Remove website
  const handleRemoveWebsite = (website: string) => {
    setWebsites((prev) => prev.filter((w) => w !== website));
  };

  // Handle Done button
  const handleDone = () => {
    // Convert package names to app names for display in SettingsScreen
    // SettingsScreen expects app names for display, but we'll also pass package names
    const appNames = selectedApps.map((packageName) => {
      const app = installedApps.find((a) => a.packageName === packageName);
      return app ? app.appName : packageName;
    });
    
    // Call the callback if it exists (set by SettingsScreen)
    // Pass both package names (for monitoring) and app names (for display)
    const settingsModule = require('./SettingsScreen');
    if (settingsModule.editAppsCallback) {
      // Pass package names as the first param (SettingsScreen will need to be updated to handle this)
      settingsModule.editAppsCallback(selectedApps, websites);
    }
    
    // Go back
    navigation.goBack();
  };

  // Render tab button
  const renderTabButton = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;
    return (
      <Pressable
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  // Filter apps based on search query (including aliases)
  // If search query is empty, show all apps
  const filteredApps = installedApps
    .filter((app) => {
      // If search is empty, show all apps
      if (!searchQuery.trim()) {
        return true;
      }
      // Otherwise, filter by search query
      return matchesAppSearch(app.appName, app.packageName, searchQuery);
    })
    .sort((a, b) => {
      const aIsSelected = selectedApps.includes(a.packageName);
      const bIsSelected = selectedApps.includes(b.packageName);
      
      // 1. Monitored apps first (selected apps appear before unselected)
      if (aIsSelected && !bIsSelected) return -1;
      if (!aIsSelected && bIsSelected) return 1;
      
      // 2. Then sort by match relevance (exact matches first, then word-start, then partial)
      const aMatch = getMatchScore(a.appName, a.packageName, searchQuery);
      const bMatch = getMatchScore(b.appName, b.packageName, searchQuery);
      
      if (aMatch.score !== bMatch.score) {
        return bMatch.score - aMatch.score; // Higher score first
      }
      
      // 3. Within same match type, sort alphabetically by app name
      return a.appName.localeCompare(b.appName);
    });

  // Render Apps tab content
  const renderAppsTab = () => {
    if (isLoadingApps) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading apps...</Text>
        </View>
      );
    }

    if (installedApps.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No apps found</Text>
        </View>
      );
    }

    return (
      <View style={styles.appsTabContainer}>
        {/* Search input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search apps..."
            placeholderTextColor="#A1A1AA"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Apps list */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
          {filteredApps.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No apps match your search</Text>
            </View>
          ) : (
            filteredApps.map((app) => {
              const isSelected = selectedApps.includes(app.packageName);
              const iconUri = app.icon ? `data:image/png;base64,${app.icon}` : null;
              return (
                <Pressable
                  key={app.packageName}
                  style={[styles.appItem, isSelected && styles.appItemSelected]}
                  onPress={() => handleToggleApp(app.packageName)}
                >
                  {iconUri ? (
                    <Image
                      source={{ uri: iconUri }}
                      style={styles.appIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.appIconPlaceholder} />
                  )}
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{app.appName}</Text>
                    <Text style={styles.packageName} numberOfLines={1}>
                      {app.packageName}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkmarkContainer}>
                      <Check size={20} color="#007AFF" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  // Render Websites tab content
  const renderWebsitesTab = () => {
    return (
      <View style={styles.websitesContainer}>
        {/* Input row */}
        <View style={styles.websiteInputRow}>
          <TextInput
            style={styles.websiteInput}
            placeholder="example.com"
            placeholderTextColor="#A1A1AA"
            value={websiteInput}
            onChangeText={setWebsiteInput}
            onSubmitEditing={handleAddWebsite}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              (!websiteInput.trim() || websites.includes(websiteInput.trim())) &&
                styles.addButtonDisabled,
            ]}
            onPress={handleAddWebsite}
            disabled={!websiteInput.trim() || websites.includes(websiteInput.trim())}
          >
            <Text
              style={[
                styles.addButtonText,
                (!websiteInput.trim() || websites.includes(websiteInput.trim())) &&
                  styles.addButtonTextDisabled,
              ]}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>

        {/* Websites list */}
        <ScrollView style={styles.websitesList} contentContainerStyle={styles.websitesListContent}>
          {websites.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No websites added yet</Text>
            </View>
          ) : (
            websites.map((website, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.websiteItem,
                  pressed && styles.websiteItemPressed,
                ]}
                onPress={() => handleRemoveWebsite(website)}
              >
                <Text style={styles.websiteItemText}>{website}</Text>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Monitored Apps</Text>
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleMain}>Choose apps to be mindful about</Text>
          <Text style={styles.subtitleSecondary}>Pick where you'd like gentle check-ins.</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          {renderTabButton('apps', 'Apps')}
          {renderTabButton('websites', 'Websites')}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'apps' ? renderAppsTab() : renderWebsitesTab()}
        </View>

        {/* Bottom Done Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#18181B',
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  subtitleMain: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#18181B',
    marginBottom: 4,
  },
  subtitleSecondary: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#E0DCFC',
    borderColor: '#9B91E8',
  },
  tabText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#52525B',
  },
  tabTextActive: {
    color: '#7C6FD9',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  appItemSelected: {
    backgroundColor: '#F0F0FF',
    borderColor: '#007AFF',
  },
  appsTabContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  appIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#E4E4E7', // Placeholder color
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#18181B',
    marginBottom: 2,
  },
  packageName: {
    fontSize: 12,
    lineHeight: 16,
    color: '#A1A1AA',
  },
  checkmarkContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  websitesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  websiteInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  websiteInput: {
    flex: 1,
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
  addButton: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#E4E4E7',
  },
  addButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#A1A1AA',
  },
  websitesList: {
    flex: 1,
  },
  websitesListContent: {
    paddingBottom: 16,
  },
  websiteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  websiteItemPressed: {
    backgroundColor: '#F4F4F6',
  },
  websiteItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#18181B',
  },
  removeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#EF4444',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#A1A1AA',
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: '#FAFAFB',
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  doneButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

