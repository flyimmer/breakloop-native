import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActivityCard, { Activity, ActivityStatus } from '../../components/ActivityCard';

type CommunityTab = 'my-upcoming' | 'discover' | 'friends' | 'plan';

// Mock data matching the screenshot
const mockActivities: Activity[] = [
  {
    id: '1',
    title: 'Morning Walk',
    dateLabel: 'Sat, Nov 16',
    time: '8:00 AM',
    location: 'English Garden',
    participantName: 'SARAH',
    hostName: 'Hosted by Sarah',
    status: 'CONFIRMED',
  },
  {
    id: '2',
    title: 'Reading & Tea',
    dateLabel: 'Wed, Nov 20',
    time: '7:00 PM',
    location: 'Home',
    participantName: 'WEI (YOU)',
    hostName: 'Hosted by Wei (You)',
    status: 'HOST',
  },
];

export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('my-upcoming');

  const tabs: { id: CommunityTab; label: string }[] = [
    { id: 'my-upcoming', label: 'My plans' },
    { id: 'discover', label: 'Discover' },
    { id: 'friends', label: 'Friends' },
    { id: 'plan', label: '+ Plan' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Segmented Tabs - Primary Header */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'my-upcoming' && (
          <>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📅</Text>
              <Text style={styles.sectionTitle}>MY UPCOMING ACTIVITIES</Text>
            </View>

            {/* Activity Cards */}
            {mockActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onPress={() => {
                  // Placeholder: No navigation yet
                  console.log('Activity tapped:', activity.id);
                }}
              />
            ))}
          </>
        )}

        {activeTab === 'discover' && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Discover</Text>
          </View>
        )}

        {activeTab === 'friends' && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Friends</Text>
          </View>
        )}

        {activeTab === 'plan' && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Plan</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Soft off-white background
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 4,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20, // Pill-style rounded
    backgroundColor: '#FFFFFF', // White for inactive
    borderWidth: 1,
    borderColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  tabActive: {
    backgroundColor: '#3F3F46', // Near-black for active
    borderColor: '#3F3F46',
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A', // Medium gray for inactive
  },
  tabTextActive: {
    color: '#FFFFFF', // White text for active
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3F3F46', // Near-black
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    fontSize: 16,
    color: '#A1A1AA',
  },
});

