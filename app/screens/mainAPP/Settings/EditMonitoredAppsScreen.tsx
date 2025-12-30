import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'apps' | 'websites';

interface AppItem {
  id: string;
  name: string;
  iconColor: string; // Placeholder for app icon color
}

// Static list of available apps
const AVAILABLE_APPS: AppItem[] = [
  { id: 'instagram', name: 'Instagram', iconColor: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', iconColor: '#000000' },
  { id: 'x', name: 'X', iconColor: '#000000' },
  { id: 'facebook', name: 'Facebook', iconColor: '#1877F2' },
  { id: 'games', name: 'Games', iconColor: '#8B5CF6' },
];

interface EditMonitoredAppsScreenProps {
  route: {
    params: {
      initialApps?: string[];
      initialWebsites?: string[];
    };
  };
}

export default function EditMonitoredAppsScreen({ route }: EditMonitoredAppsScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const { initialApps = [], initialWebsites = [] } = route.params || {};

  // Convert app names to IDs for internal state
  // SettingsScreen passes app names (e.g., 'Instagram'), but we work with IDs internally
  const getAppIdFromName = (name: string): string | null => {
    const app = AVAILABLE_APPS.find((a) => a.name === name);
    return app ? app.id : null;
  };

  const initialAppIds = initialApps
    .map((name) => getAppIdFromName(name))
    .filter((id): id is string => id !== null);

  const [activeTab, setActiveTab] = useState<TabType>('apps');
  const [selectedApps, setSelectedApps] = useState<string[]>(initialAppIds);
  const [websites, setWebsites] = useState<string[]>(initialWebsites);
  const [websiteInput, setWebsiteInput] = useState('');

  // Toggle app selection
  const handleToggleApp = (appId: string) => {
    setSelectedApps((prev) => {
      if (prev.includes(appId)) {
        return prev.filter((id) => id !== appId);
      } else {
        return [...prev, appId];
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
    // Convert app IDs to names for SettingsScreen compatibility
    const appNames = selectedApps.map((id) => {
      const app = AVAILABLE_APPS.find((a) => a.id === id);
      return app ? app.name : id;
    });
    
    // Call the callback if it exists (set by SettingsScreen)
    // This is a simple workaround since React Navigation doesn't support function callbacks in params
    // In a production app, you might use a state management solution like Context or Redux
    // Import the callback from SettingsScreen module
    const settingsModule = require('./SettingsScreen');
    if (settingsModule.editAppsCallback) {
      settingsModule.editAppsCallback(appNames, websites);
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

  // Render Apps tab content
  const renderAppsTab = () => {
    return (
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
        {AVAILABLE_APPS.map((app) => {
          const isSelected = selectedApps.includes(app.id);
          return (
            <Pressable
              key={app.id}
              style={[styles.appItem, isSelected && styles.appItemSelected]}
              onPress={() => handleToggleApp(app.id)}
            >
              <View style={[styles.appIcon, { backgroundColor: app.iconColor }]} />
              <Text style={styles.appName}>{app.name}</Text>
              {isSelected && (
                <View style={styles.checkmarkContainer}>
                  <Check size={20} color="#007AFF" strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  appName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#18181B',
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

