import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import CommunityScreen from '../screens/mainAPP/CommunityScreen';
import FriendOverviewScreen from '../screens/mainAPP/FriendOverviewScreen';
import FullFriendProfileScreen from '../screens/mainAPP/FullFriendProfileScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  FriendOverview: {
    friendId: string;
    friendName: string;
    friendPhoto: string;
  };
  FullFriendProfile: {
    friendId: string;
    friendName: string;
    friendPhoto: string;
  };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="CommunityHome" component={CommunityScreen} />
      <Stack.Screen name="FriendOverview" component={FriendOverviewScreen} />
      <Stack.Screen name="FullFriendProfile" component={FullFriendProfileScreen} />
    </Stack.Navigator>
  );
}

