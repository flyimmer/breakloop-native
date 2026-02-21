import { getMatchScore, matchesAppSearch } from '@/constants/appAliases';
import { getDisplayCategory } from '@/constants/appCategories';
import { appDiscoveryService } from '@/src/services/appDiscovery';
import { DiscoveredApp } from '@/src/storage/appDiscovery';
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
import { MainAppStackParamList } from '../../../roots/MainAppRoot';

type NavigationProp = NativeStackNavigationProp<MainAppStackParamList>;

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

  // Discovered apps from multi-source discovery
  const [discoveredApps, setDiscoveredApps] = useState<DiscoveredApp[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize discovery service and subscribe to updates
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsLoadingApps(false);
      Alert.alert(
        'Not Available',
        'App list is only available on Android devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    let unsubscribe: (() => void) | null = null;

    async function initializeDiscovery() {
      try {
        setIsLoadingApps(true);

        // Initialize discovery service (starts launcher discovery immediately)
        await appDiscoveryService.initialize();

        // Subscribe to progressive updates
        unsubscribe = appDiscoveryService.subscribe((apps) => {
          setDiscoveredApps(apps);
          setIsLoadingApps(false);
        });
      } catch (error: any) {
        console.error('[EditMonitoredApps] Failed to initialize discovery:', error);
        Alert.alert(
          'Error',
          'Failed to load apps. Please try again.',
          [{ text: 'OK' }]
        );
        setIsLoadingApps(false);
      }
    }

    initializeDiscovery();

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Convert DiscoveredApp to display format
  const installedApps = discoveredApps.map(app => ({
    packageName: app.packageName,
    appName: app.label || app.packageName,
    iconPath: app.iconPath
  }));

  // Note: Icons are now stored as file URIs in iconPath
  // No need to load them separately - React Native <Image /> can load file URIs directly
  // The iconCache is kept for compatibility but we'll use iconPath directly

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

  // Render a single app row
  const renderAppRow = (app: { packageName: string; appName: string; iconPath: string | null }) => {
    const isSelected = selectedApps.includes(app.packageName);
    const iconUri = app.iconPath || null;
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
          <View style={styles.appIconPlaceholder}>
            <Text style={styles.appIconPlaceholderText}>
              {app.appName.charAt(0).toUpperCase()}
            </Text>
          </View>
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
  };

  // Group filtered apps into Social / Others sections
  const sortAppsInSection = (apps: typeof filteredApps) =>
    apps.sort((a, b) => {
      const aSelected = selectedApps.includes(a.packageName);
      const bSelected = selectedApps.includes(b.packageName);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.appName.localeCompare(b.appName);
    });

  const socialApps = sortAppsInSection(filteredApps.filter(a => getDisplayCategory(a.packageName) === 'Social'));
  const othersApps = sortAppsInSection(filteredApps.filter(a => getDisplayCategory(a.packageName) === 'Others'));

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

        {/* Apps list — grouped by Social / Others */}
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
          {filteredApps.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No apps match your search</Text>
            </View>
          ) : (
            <>
              {/* ── Social section ──────────────────────────── */}
              {socialApps.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>Social</Text>
                  </View>
                  {socialApps.map(renderAppRow)}
                </>
              )}

              {/* ── Others section ──────────────────────────── */}
              {othersApps.length > 0 && (
                <>
                  <View style={[styles.sectionHeader, socialApps.length > 0 && styles.sectionHeaderSpaced]}>
                    <Text style={styles.sectionLabel}>Others</Text>
                  </View>
                  {othersApps.map(renderAppRow)}
                </>
              )}
            </>
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
  // Section headers
  sectionHeader: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    paddingTop: 4,
  },
  sectionHeaderSpaced: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#7C6FD9',
    textTransform: 'uppercase',
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
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIconPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A1A1AA',
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

