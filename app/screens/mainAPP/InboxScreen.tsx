import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InboxTab = 'messages' | 'updates';

// Mock data for messages (private 1:1 conversations)
interface Conversation {
  id: string;
  friendName: string;
  friendPhoto: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

const mockConversations: Conversation[] = [
  {
    id: 'c1',
    friendName: 'Sarah',
    friendPhoto: 'https://i.pravatar.cc/150?img=47',
    lastMessage: 'You: Yes, starting in 5 mins!',
    timestamp: '6h ago',
    unread: false,
  },
];

// Mock data for updates (event/system signals)
interface Update {
  id: string;
  type: 'message' | 'join_request' | 'join_approved' | 'join_declined' | 'event_updated' | 'event_cancelled' | 'participant_left';
  title: string;
  context?: string;
  timestamp: string;
}

const mockUpdates: Update[] = [
  {
    id: 'u1',
    type: 'message',
    title: 'New message in Morning Walk',
    context: 'Sarah: "Running 5 mins late"',
    timestamp: '2h ago',
  },
  {
    id: 'u2',
    type: 'join_request',
    title: 'Join request for Coffee Meetup',
    context: 'Thomas wants to join',
    timestamp: '5h ago',
  },
];

const InboxScreen = () => {
  const [activeTab, setActiveTab] = useState<InboxTab>('messages');

  const renderTabButton = (tab: InboxTab, label: string) => {
    const isActive = activeTab === tab;
    return (
      <Pressable
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={() => setActiveTab(tab)}
      >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderMessagesTab = () => {
    if (mockConversations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No messages yet</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.listContainer}>
        {mockConversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            style={({ pressed }) => [
              styles.messageItem,
              pressed && styles.itemPressed,
            ]}
          >
            <Image
              source={{ uri: conversation.friendPhoto }}
              style={styles.profilePhoto}
            />
            <View style={styles.messageContent}>
              <Text style={styles.messageName}>{conversation.friendName}</Text>
              <Text style={styles.messagePreview} numberOfLines={1}>
                {conversation.lastMessage}
              </Text>
            </View>
            <Text style={styles.timestamp}>{conversation.timestamp}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const getUpdateIcon = (type: Update['type']) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'join_request':
        return '➕';
      case 'join_approved':
        return '✅';
      case 'join_declined':
        return '❌';
      case 'event_updated':
        return '✏️';
      case 'event_cancelled':
        return '🚫';
      case 'participant_left':
        return '👋';
      default:
        return '📌';
    }
  };

  const renderUpdatesTab = () => {
    if (mockUpdates.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No updates</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.listContainer}>
        {mockUpdates.map((update) => (
          <Pressable
            key={update.id}
            style={({ pressed }) => [
              styles.updateItem,
              pressed && styles.itemPressed,
            ]}
          >
            <Text style={styles.updateIcon}>{getUpdateIcon(update.type)}</Text>
            <View style={styles.updateContent}>
              <Text style={styles.updateTitle}>{update.title}</Text>
              {update.context && (
                <Text style={styles.updateContext} numberOfLines={1}>
                  {update.context}
                </Text>
              )}
              <Text style={styles.updateTimestamp}>{update.timestamp}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {renderTabButton('messages', 'Messages')}
        {renderTabButton('updates', 'Updates')}
      </View>

      {/* Content */}
      {activeTab === 'messages' ? renderMessagesTab() : renderUpdatesTab()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFB',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#7C6FD9',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#A1A1AA',
  },
  tabTextActive: {
    color: '#18181B',
  },
  listContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  // Message item styles
  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F6',
  },
  itemPressed: {
    backgroundColor: '#F4F4F6',
  },
  profilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E4E4E7',
  },
  messageContent: {
    flex: 1,
    marginLeft: 12,
  },
  messageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#18181B',
    marginBottom: 2,
  },
  messagePreview: {
    fontSize: 14,
    color: '#71717A',
  },
  timestamp: {
    fontSize: 12,
    color: '#A1A1AA',
    marginLeft: 8,
  },
  // Update item styles
  updateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F6',
  },
  updateIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#18181B',
    marginBottom: 2,
  },
  updateContext: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 4,
  },
  updateTimestamp: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  chevron: {
    fontSize: 24,
    color: '#E4E4E7',
    marginLeft: 8,
  },
});

export default InboxScreen;

