import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ActivityStatus = 'CONFIRMED' | 'HOST' | 'PENDING';

export interface Activity {
  id: string;
  title: string;
  dateLabel: string; // e.g., "Sat, Nov 16"
  time: string; // e.g., "8:00 AM"
  location: string;
  participantName?: string; // e.g., "SARAH" or "WEI (YOU)"
  hostName: string; // e.g., "Hosted by Sarah" or "Hosted by Wei (You)"
  status?: ActivityStatus;
}

interface ActivityCardProps {
  activity: Activity;
  onPress?: () => void;
}

export default function ActivityCard({ activity, onPress }: ActivityCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Card Header: Title and Status Badge */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {activity.title}
        </Text>
        {activity.status && (
          <View
            style={[
              styles.statusBadge,
              activity.status === 'CONFIRMED' && styles.statusBadgeConfirmed,
              activity.status === 'HOST' && styles.statusBadgeHost,
              activity.status === 'PENDING' && styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                activity.status === 'HOST' && styles.statusBadgeTextDark,
                (activity.status === 'CONFIRMED' || activity.status === 'PENDING') && styles.statusBadgeTextLight,
              ]}
            >
              {activity.status}
            </Text>
          </View>
        )}
      </View>

      {/* Date & Time Row */}
      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>🕐</Text>
        <Text style={styles.infoText}>
          {activity.dateLabel} • {activity.time}
        </Text>
      </View>

      {/* Location Row */}
      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>📍</Text>
        <Text style={styles.infoText}>{activity.location}</Text>
      </View>

      {/* Host Line */}
      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>👥</Text>
        <Text style={styles.infoText}>{activity.hostName}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', // Pure white for cards
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    // Very subtle border and shadow
    borderWidth: 1,
    borderColor: '#F9FAFB', // Barely visible border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#27272A', // Near-black
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6, // Smaller badge
  },
  statusBadgeConfirmed: {
    backgroundColor: '#A7F3D0', // Softer green (lighter)
  },
  statusBadgeHost: {
    backgroundColor: '#3F3F46', // Near-black for HOST badge
  },
  statusBadgePending: {
    backgroundColor: '#FDE68A', // Softer amber (lighter)
  },
  statusBadgeText: {
    fontSize: 11, // Smaller text
    fontWeight: '500', // Lighter weight
    letterSpacing: 0.2,
  },
  statusBadgeTextLight: {
    color: '#3F3F46', // Near-black text on light background
  },
  statusBadgeTextDark: {
    color: '#FFFFFF', // White text on dark background
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#71717A', // Medium gray for secondary text
    lineHeight: 20,
  },
});

