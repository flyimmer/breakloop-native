import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FullFriendProfileScreenProps {
  route: {
    params: {
      friendId: string;
      friendName: string;
      friendPhoto: string;
    };
  };
  navigation: any;
}

// Mock friend profile data
const mockFriendProfile = {
  displayName: 'Sarah Chen',
  aboutMe: 'Creative soul who finds peace in crafting and quiet moments. Always learning something new.',
  interests: 'Knitting, reading, cats, mindfulness, cozy cafes',
};

export default function FullFriendProfileScreen({ route, navigation }: FullFriendProfileScreenProps) {
  const { friendName, friendPhoto } = route.params;

  const handleBack = () => {
    navigation.goBack();
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
        {/* Profile Photo and Name */}
        <View style={styles.identitySection}>
          <Image
            source={{ uri: friendPhoto }}
            style={styles.profilePhoto}
          />
          <Text style={styles.displayName}>{mockFriendProfile.displayName}</Text>
        </View>

        {/* About Me */}
        {mockFriendProfile.aboutMe && (
          <View style={styles.profileField}>
            <Text style={styles.fieldLabel}>About Me</Text>
            <Text style={styles.fieldValue}>{mockFriendProfile.aboutMe}</Text>
          </View>
        )}

        {/* Interests */}
        {mockFriendProfile.interests && (
          <View style={styles.profileField}>
            <Text style={styles.fieldLabel}>Interests</Text>
            <Text style={styles.fieldValue}>{mockFriendProfile.interests}</Text>
          </View>
        )}
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
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  identitySection: {
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F4F4F5',
    marginBottom: 16,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  profileField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: 16,
    lineHeight: 24,
    color: '#52525B',
  },
});

