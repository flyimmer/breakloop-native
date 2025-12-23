import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommunityScreen from '../screens/mainAPP/CommunityScreen';
import InboxScreen from '../screens/mainAPP/InboxScreen';
import InsightsScreen from '../screens/mainAPP/InsightsScreen';
import SettingsScreen from '../screens/mainAPP/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppNavigation = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8B7AE8', // primary color - vibrant when active
        tabBarInactiveTintColor: '#A1A1AA', // textSecondary - softer when inactive
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarStyle: {
          ...styles.tabBar,
          // Dynamic height based on safe area bottom inset + extra spacing
          height: 60 + insets.bottom + 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 16,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false, // Prevent system font scaling from breaking layout
      }}
    >
      <Tab.Screen 
        name="Insights" 
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="📊" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="Community" 
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="👥" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="Inbox" 
        component={InboxScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="📬" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon="⚙️" color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Custom tab icon component with active state indicator
const TabIcon = ({ icon, color, focused }: { icon: string; color: string; focused?: boolean }) => {
  return (
    <View style={styles.iconContainer}>
      <Text style={{ 
        fontSize: 30, 
        opacity: focused ? 1 : 0.65,
        transform: [{ scale: focused ? 1.05 : 1 }] // Subtle scale on active
      }}> 
        {icon}
      </Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    // Base height for tab content (icon + label + padding)
    // Actual height is dynamically calculated: 60 + insets.bottom
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF', // Clean white surface
    borderTopWidth: 0, // Remove border for cleaner look
    // Subtle gradient effect via shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  tabBarItem: {
    paddingVertical: 4,
    gap: 4, // Space between icon and label
  },
  tabBarIcon: {
    marginBottom: 0, // Reset, using gap instead
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600', // Bolder for better readability
    letterSpacing: 0.2,
    marginTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B7AE8', // primary color
  },
});

export default AppNavigation;
