/**
 * ActivityDetailSheet
 *
 * Modal screen: full detail view for any activity.
 * spec: alternatives_tab_spec_v1.md §5.2
 *
 * Shows: title, trigger chips, instructions (full), tag chips
 * Actions:
 *   - "Do this now" → markUsed + micro-confirmation
 *   - "Save to My List" (only when fromDiscover=true)
 *   - "Edit" (only USER_CREATED) / "Duplicate" (STARTER_PACK)
 */

import type { AlternativesStackParamList } from '@/app/navigation/AlternativesNavigator';
import { getMyListActivities, markUsed, saveActivity } from '@/src/core/alternatives/alternativesStorage';
import { STARTER_PACK_ACTIVITIES } from '@/src/core/alternatives/starterPack';
import { TRIGGER_LABELS, type Activity } from '@/src/core/alternatives/types';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<AlternativesStackParamList>;
type Route = RouteProp<AlternativesStackParamList, 'ActivityDetail'>;

export default function ActivityDetailSheet() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { activityId, fromDiscover } = route.params;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [didIt, setDidIt] = useState(false);

    useEffect(() => {
        const load = async () => {
            // Look in My List first
            const myList = await getMyListActivities();
            let found: Activity | undefined = myList.find((a) => a.id === activityId);
            // Fallback: starter pack (for Discover detail, though not navigated yet in Phase 1)
            if (!found) {
                found = STARTER_PACK_ACTIVITIES.find((a) => a.id === activityId);
            }
            if (found) setActivity(found);
        };
        load();
    }, [activityId]);

    const handleDoItNow = async () => {
        await markUsed(activityId);
        setDidIt(true);
    };

    const handleSaveToMyList = async () => {
        if (!activity) return;
        await saveActivity({ ...activity, id: activityId, source: 'STARTER_PACK' });
        navigation.goBack();
    };

    if (!activity) return null;

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{activity.title}</Text>
                <Pressable
                    onPress={() => navigation.goBack()}
                    hitSlop={12}
                    style={styles.closeBtn}
                >
                    <X size={22} color="#71717A" strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Trigger chips */}
                <View style={styles.chipRow}>
                    {activity.triggers.map((t) => (
                        <View key={t} style={styles.triggerChip}>
                            <Text style={styles.triggerChipText}>{TRIGGER_LABELS[t]}</Text>
                        </View>
                    ))}
                </View>

                {/* Instructions */}
                {activity.instructions ? (
                    <Text style={styles.instructions}>{activity.instructions}</Text>
                ) : (
                    <Text style={styles.noInstructions}>No instructions yet.</Text>
                )}

                {/* Tag chips */}
                {activity.tags && activity.tags.length > 0 && (
                    <View style={styles.tagSection}>
                        <Text style={styles.tagSectionLabel}>Tags</Text>
                        <View style={styles.chipRow}>
                            {activity.tags.map((t) => (
                                <View key={t} style={styles.tagChip}>
                                    <Text style={styles.tagChipText}>{t.replace('_', ' ')}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Effort */}
                {activity.effort && (
                    <Text style={styles.effort}>
                        Effort: {activity.effort.charAt(0) + activity.effort.slice(1).toLowerCase()}
                    </Text>
                )}
            </ScrollView>

            {/* Micro-confirmation overlay */}
            {didIt && (
                <View style={styles.confirmation}>
                    <Text style={styles.confirmationText}>
                        Nice. Put the phone down and start. 🙌
                    </Text>
                    <Pressable
                        style={styles.doneBtn}
                        onPress={() => {
                            setDidIt(false);
                            navigation.goBack();
                        }}
                    >
                        <Text style={styles.doneBtnText}>Done</Text>
                    </Pressable>
                </View>
            )}

            {/* Action buttons */}
            {!didIt && (
                <View style={styles.actions}>
                    <Pressable style={styles.primaryBtn} onPress={handleDoItNow}>
                        <Text style={styles.primaryBtnText}>Do this now</Text>
                    </Pressable>

                    {fromDiscover && (
                        <Pressable style={styles.secondaryBtn} onPress={handleSaveToMyList}>
                            <Text style={styles.secondaryBtnText}>Save to My List</Text>
                        </Pressable>
                    )}

                    {!fromDiscover && activity.source === 'USER_CREATED' && (
                        <Pressable
                            style={styles.secondaryBtn}
                            onPress={() => {
                                navigation.goBack();
                                navigation.navigate('AddEditActivity', { activityId: activity.id });
                            }}
                        >
                            <Text style={styles.secondaryBtnText}>Edit</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0F0F17' },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        gap: 12,
    },
    headerTitle: {
        flex: 1,
        color: '#FAFAFA',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.3,
        lineHeight: 30,
    },
    closeBtn: { paddingTop: 4 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    triggerChip: {
        backgroundColor: '#27254A',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#3B3B6E',
    },
    triggerChipText: { color: '#A78BFA', fontSize: 13, fontWeight: '600' },
    instructions: {
        color: '#D4D4D8',
        fontSize: 16,
        lineHeight: 26,
        marginBottom: 20,
    },
    noInstructions: { color: '#52525B', fontSize: 15, marginBottom: 20 },
    tagSection: { marginBottom: 16 },
    tagSectionLabel: {
        color: '#71717A',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    tagChip: {
        backgroundColor: '#1C1C1C',
        borderRadius: 6,
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#27272A',
    },
    tagChipText: { color: '#A1A1AA', fontSize: 12 },
    effort: { color: '#71717A', fontSize: 13 },
    actions: {
        flexDirection: 'column',
        gap: 10,
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#1C1C1C',
    },
    primaryBtn: {
        backgroundColor: '#8B7AE8',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#FAFAFA', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#3B3B52',
    },
    secondaryBtnText: { color: '#A1A1AA', fontSize: 15, fontWeight: '600' },
    confirmation: {
        backgroundColor: '#0F1F0F',
        margin: 16,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#166534',
        alignItems: 'center',
        gap: 16,
    },
    confirmationText: {
        color: '#4ADE80',
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 26,
    },
    doneBtn: {
        backgroundColor: '#166534',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 40,
    },
    doneBtnText: { color: '#FAFAFA', fontSize: 15, fontWeight: '700' },
});
