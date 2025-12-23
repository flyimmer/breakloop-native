import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActivityCard, { Activity } from '../../components/ActivityCard';

interface FriendOverviewScreenProps {
  route: {
    params: {
      friendId: string;
      friendName: string;
      friendPhoto: string;
    };
  };
  navigation: any;
}

// Mock data for friend activities
const mockFriendActivities: Activity[] = [
  {
    id: 'fa1',
    title: 'Silent Co-working',
    dateLabel: 'Today',
    time: '4:00 PM',
    location: 'Virtual',
    hostName: 'Sarah',
  },
  {
    id: 'fa2',
    title: 'Morning Walk',
    dateLabel: 'Sat, Nov 16',
    time: '8:00 AM',
    location: 'English Garden',
    hostName: 'Sarah',
  },
];

export default function FriendOverviewScreen({ route, navigation }: FriendOverviewScreenProps) {
  const { friendId, friendName, friendPhoto } = route.params;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleProfilePress = () => {
    navigation.navigate('FullFriendProfile', {
      friendId,
      friendName,
      friendPhoto,
    });
  };

  const handleChat = () => {
    // TODO: Navigate to chat
    console.log('Chat with', friendName);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={12}
        >
          <ChevronLeft size={24} color="#18181B" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{friendName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Summary Card */}
        <Pressable
          onPress={handleProfilePress}
          style={({ pressed }) => [
            styles.profileCard,
            pressed && styles.profileCardPressed,
          ]}
        >
          <Image
            source={{ uri: friendPhoto }}
            style={styles.profilePhoto}
          />
          <View style={styles.profileTextRow}>
            <Text style={styles.profileName}>{friendName} Chen</Text>
            <ChevronLeft
              size={20}
              color="#A1A1AA"
              strokeWidth={2}
              style={styles.chevronRight}
            />
          </View>
        </Pressable>

        {/* Chat Button */}
        <Pressable
          onPress={handleChat}
          style={({ pressed }) => [
            styles.chatButton,
            pressed && styles.chatButtonPressed,
          ]}
        >
          <MessageCircle size={16} color="#52525B" strokeWidth={2} />
          <Text style={styles.chatButtonText}>Chat with {friendName}</Text>
        </Pressable>

        {/* Friend Activities Section */}
        <View style={styles.activitiesSection}>
          <Text style={styles.activitiesTitle}>Things {friendName} is up to</Text>
          
          {mockFriendActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {mockFriendActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() => {
                    console.log('Activity tapped:', activity.id);
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No upcoming activities</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  backButton: {
    padding: 4,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 32, // Same width as back button for centering
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F9FAFB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    alignItems: 'center',
  },
  profileCardPressed: {
    opacity: 0.7,
  },
  profilePhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
    backgroundColor: '#F4F4F5',
  },
  profileTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  chevronRight: {
    transform: [{ rotate: '180deg' }],
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 8,
  },
  chatButtonPressed: {
    opacity: 0.7,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#52525B',
  },
  activitiesSection: {
    marginTop: 8,
  },
  activitiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#18181B',
    marginBottom: 16,
  },
  activitiesList: {
    gap: 12,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#A1A1AA',
  },
});

