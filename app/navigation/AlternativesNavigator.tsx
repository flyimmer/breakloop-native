/**
 * AlternativesNavigator
 *
 * Stack navigator for the Alternatives bottom tab.
 * Default route: AlternativesTabHost (hosts My List / Discover sub-tabs).
 * Modal routes: ActivityDetail, AddEditActivity.
 */

import ActivityDetailSheet from '@/app/screens/mainAPP/Alternatives/ActivityDetailSheet';
import AddEditActivityModal from '@/app/screens/mainAPP/Alternatives/AddEditActivityModal';
import AlternativesTabHost from '@/app/screens/mainAPP/Alternatives/AlternativesTabHost';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

export type AlternativesStackParamList = {
    AlternativesTabHost: undefined;
    ActivityDetail: { activityId: string; fromDiscover?: boolean };
    AddEditActivity: { activityId?: string }; // undefined = add mode
};

const Stack = createNativeStackNavigator<AlternativesStackParamList>();

export default function AlternativesNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="AlternativesTabHost" component={AlternativesTabHost} />
            <Stack.Screen
                name="ActivityDetail"
                component={ActivityDetailSheet}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name="AddEditActivity"
                component={AddEditActivityModal}
                options={{ presentation: 'modal' }}
            />
        </Stack.Navigator>
    );
}
