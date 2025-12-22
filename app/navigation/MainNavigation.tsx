import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import CommunityScreen from '../screens/CommunityScreen';
import InboxScreen from '../screens/InboxScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppNavigation = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default AppNavigation;
