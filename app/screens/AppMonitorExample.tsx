/**
 * AppMonitorExample.tsx
 * 
 * Example component demonstrating how to use the useAppMonitor hook.
 * 
 * This is a standalone example - integrate it into your app as needed.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useAppMonitor } from '../hooks/useAppMonitor';

interface AppEvent {
  packageName: string;
  timestamp: number;
}

export function AppMonitorExample() {
  const [events, setEvents] = useState<AppEvent[]>([]);

  const { currentApp, isMonitoring, startMonitoring, stopMonitoring, error } = useAppMonitor({
    onAppChanged: (packageName, timestamp) => {
      console.log('📱 Foreground app changed:', packageName);
      
      // Add to events list (keep last 20 events)
      setEvents((prev) => [
        { packageName, timestamp },
        ...prev.slice(0, 19),
      ]);
    },
  });

  const handleStart = async () => {
    await startMonitoring();
    if (!error) {
      Alert.alert('Success', 'Monitoring started successfully');
    }
  };

  const handleStop = async () => {
    await stopMonitoring();
    Alert.alert('Stopped', 'Monitoring stopped');
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Grant Permission',
      'To use app monitoring, you need to grant "Usage Access" permission.\n\n' +
      'Steps:\n' +
      '1. Go to Settings → Apps → Special app access → Usage access\n' +
      '2. Find "BreakLoop" in the list\n' +
      '3. Toggle "Permit usage access" ON',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>App Monitor Demo</Text>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={[styles.statusValue, isMonitoring && styles.statusActive]}>
            {isMonitoring ? '✅ Monitoring' : '❌ Stopped'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Current App:</Text>
          <Text style={styles.statusValue} numberOfLines={1}>
            {currentApp || 'Unknown'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, isMonitoring && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={isMonitoring}
        >
          <Text style={styles.buttonText}>Start Monitoring</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger, !isMonitoring && styles.buttonDisabled]}
          onPress={handleStop}
          disabled={!isMonitoring}
        >
          <Text style={styles.buttonText}>Stop Monitoring</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleOpenSettings}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>

      {/* Events Log */}
      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>Recent Events ({events.length})</Text>
        <ScrollView style={styles.eventsList}>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>
              No events yet. Start monitoring and switch between apps to see events.
            </Text>
          ) : (
            events.map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <Text style={styles.eventPackage}>{event.packageName}</Text>
                <Text style={styles.eventTime}>{formatTime(event.timestamp)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to use:</Text>
        <Text style={styles.instructionsText}>
          1. Tap "Grant Permission" and enable usage access{'\n'}
          2. Tap "Start Monitoring"{'\n'}
          3. Switch to other apps (Instagram, Chrome, etc.){'\n'}
          4. Return to this app to see detected events
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  statusSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    color: '#999',
    flex: 1,
    textAlign: 'right',
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  errorBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  buttonSection: {
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#2196F3',
  },
  buttonDanger: {
    backgroundColor: '#f44336',
  },
  buttonSecondary: {
    backgroundColor: '#9E9E9E',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  eventsSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  eventsList: {
    flex: 1,
  },
  eventItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  eventPackage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
  instructions: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1976D2',
  },
  instructionsText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
});

