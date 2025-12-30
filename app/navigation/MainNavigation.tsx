import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarChart3, Inbox, Settings, Users } from 'lucide-react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CommunityStackNavigator from './CommunityStackNavigator';
import InboxScreen from '../screens/mainAPP/InboxScreen';
import InsightsScreen from '../screens/mainAPP/InsightsScreen';
import SettingsScreen from '../screens/mainAPP/Settings/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppNavigation = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8B7AE8', // Brand purple for active
        tabBarInactiveTintColor: '#D4D4D8', // Very light gray for inactive
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarStyle: {
          ...styles.tabBar,
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 8,
          paddingTop: 8,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
      }}
    >
      <Tab.Screen 
        name="Insights" 
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <BarChart3 
              size={24} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Community" 
        component={CommunityStackNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Users 
              size={24} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Inbox" 
        component={InboxScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Inbox 
              size={24} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Settings 
              size={24} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: 8,
    backgroundColor: '#FEFEFE', // Soft off-white background
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5', // Very subtle separation
    // Soft elevation for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 4,
  },
  tabBarItem: {
    paddingVertical: 4,
    gap: 4, // Tight space between icon and label
  },
  tabBarIcon: {
    marginBottom: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600', // Slightly bolder weight for better presence
    letterSpacing: 0.2,
    marginTop: 2,
  },
});

export default AppNavigation;
