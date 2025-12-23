import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActivityCard, { Activity } from '../../components/ActivityCard';

type CommunityTab = 'my-upcoming' | 'discover' | 'friends' | 'plan';

// Mock data for My plans
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

// Mock data for Discover
const mockDiscoverActivities: Activity[] = [
  {
    id: 'd1',
    title: 'Guided Breathwork',
    dateLabel: 'Tomorrow',
    time: '12:00 PM',
    location: 'Virtual',
    hostName: 'Hosted by Community Center',
  },
  {
    id: 'd2',
    title: 'Screen-free Social',
    dateLabel: 'Fri, Nov 22',
    time: '7:00 PM',
    location: 'Local library',
    hostName: 'Hosted by Neighborhood Hub',
  },
];

// Mock data for Friends
interface Friend {
  id: string;
  name: string;
  profilePhoto: string; // URI to profile photo
  recentMood?: string; // Only shown if selected within ~30 minutes
  moodTimestamp?: number; // Timestamp when mood was selected
}

const mockFriends: Friend[] = [
  {
    id: 'f1',
    name: 'Sarah',
    profilePhoto: 'https://i.pravatar.cc/150?img=47', // Female avatar
    recentMood: 'Anxiety',
    moodTimestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago (recent)
  },
  {
    id: 'f2',
    name: 'Thomas',
    profilePhoto: 'https://i.pravatar.cc/150?img=12', // Male avatar
    // No mood - timestamp > 30 min ago
  },
  {
    id: 'f3',
    name: 'Hans',
    profilePhoto: 'https://i.pravatar.cc/150?img=33', // Male avatar
    recentMood: 'Fatigue',
    moodTimestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago (recent)
  },
];

// Mock data for "What Friends Are Up To"
const mockFriendsActivities: Activity[] = [
  {
    id: 'fa1',
    title: 'Silent Co-working',
    dateLabel: 'Today',
    time: '4:00 PM',
    location: 'Virtual',
    hostName: 'Sarah',
  },
];

interface CommunityScreenProps {
  navigation: any;
}

export default function CommunityScreen({ navigation }: CommunityScreenProps) {
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
          <>
            {/* Discover Activities */}
            {mockDiscoverActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onPress={() => {
                  // Placeholder: No navigation yet
                  console.log('Discover activity tapped:', activity.id);
                }}
              />
            ))}
          </>
        )}

        {activeTab === 'friends' && (
          <>
            {/* Friends List Section */}
            <View style={styles.friendsSection}>
              <View style={styles.friendsSectionHeader}>
                <Text style={styles.friendsSectionTitle}>FRIENDS</Text>
                <Pressable
                  onPress={() => {
                    // Placeholder: Add friend action
                    console.log('Add friend tapped');
                  }}
                  style={({ pressed }) => [
                    styles.addFriendButton,
                    pressed && styles.addFriendButtonPressed,
                  ]}
                >
                  <Text style={styles.addFriendIcon}>✨</Text>
                  <Text style={styles.addFriendText}>Add</Text>
                </Pressable>
              </View>

              {/* Friends List */}
              <View style={styles.friendsList}>
                {mockFriends.map((friend) => {
                  // Check if mood is recent (within 30 minutes)
                  const moodIsRecent = friend.moodTimestamp 
                    ? (Date.now() - friend.moodTimestamp) < 30 * 60 * 1000 
                    : false;
                  const showMood = moodIsRecent && friend.recentMood;

                  return (
                    <Pressable
                      key={friend.id}
                      onPress={() => {
                        navigation.navigate('FriendOverview', {
                          friendId: friend.id,
                          friendName: friend.name,
                          friendPhoto: friend.profilePhoto,
                        });
                      }}
                      style={({ pressed }) => [
                        styles.friendItem,
                        pressed && styles.friendItemPressed,
                      ]}
                    >
                      {/* Profile Photo */}
                      <Image
                        source={{ uri: friend.profilePhoto }}
                        style={styles.friendPhoto}
                      />

                      {/* Name and Mood */}
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        {showMood && (
                          <Text style={styles.friendMood}>
                            {friend.recentMood}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* What Friends Are Up To Section */}
            <View style={styles.friendsActivitiesSection}>
              <View style={styles.friendsActivitiesHeader}>
                <Text style={styles.friendsActivitiesTitle}>
                  WHAT FRIENDS ARE UP TO
                </Text>
              </View>

              {/* Friends' Activities */}
              {mockFriendsActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() => {
                    // Placeholder: No navigation yet
                    console.log('Friend activity tapped:', activity.id);
                  }}
                />
              ))}
            </View>
          </>
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
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
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
  // Friends Section
  friendsSection: {
    marginBottom: 24,
  },
  friendsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3F3F46', // Near-black - matches "What Friends Are Up To"
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addFriendButtonPressed: {
    opacity: 0.6,
  },
  addFriendIcon: {
    fontSize: 12,
  },
  addFriendText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8B7AE8', // Brand purple
  },
  friendsList: {
    gap: 12,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  friendItemPressed: {
    opacity: 0.7,
  },
  friendPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#F4F4F5', // Placeholder background
  },
  friendInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27272A',
  },
  friendMood: {
    fontSize: 10,
    fontWeight: '400',
    color: '#D4D4D8', // Very light gray - almost whispered
    letterSpacing: 0.2,
  },
  // What Friends Are Up To Section
  friendsActivitiesSection: {
    marginTop: 8,
  },
  friendsActivitiesHeader: {
    marginBottom: 16,
  },
  friendsActivitiesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3F3F46',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

