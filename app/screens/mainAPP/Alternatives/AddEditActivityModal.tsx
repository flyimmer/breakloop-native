/**
 * AddEditActivityModal
 *
 * Minimal form for creating or editing a user activity.
 * spec: alternatives_tab_spec_v1.md §5.4
 *
 * Required: Title + Trigger(s)
 * Optional: Instructions, Tags
 * Edit mode: pre-fills from existing activity + shows Delete
 */

import type { AlternativesStackParamList } from '@/app/navigation/AlternativesNavigator';
import {
    deleteActivity,
    getMyListActivities,
    saveActivity,
    updateActivity,
} from '@/src/core/alternatives/alternativesStorage';
import {
    TRIGGER_LABELS,
    TRIGGER_ORDER,
    type Activity,
    type ContextTag,
    type Trigger,
} from '@/src/core/alternatives/types';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Simple collision-resistant ID — good enough for local storage */
function generateId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type Nav = NativeStackNavigationProp<AlternativesStackParamList>;
type Route = RouteProp<AlternativesStackParamList, 'AddEditActivity'>;

const AVAILABLE_TAGS: ContextTag[] = [
    'no_phone', 'outside', 'at_home', 'social', 'movement',
    'calm', 'planning', 'creative', 'learning', 'practical', 'no_feed',
];

export default function AddEditActivityModal() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { activityId } = route.params;
    const isEdit = !!activityId;

    const [title, setTitle] = useState('');
    const [selectedTriggers, setSelectedTriggers] = useState<Trigger[]>([]);
    const [instructions, setInstructions] = useState('');
    const [selectedTags, setSelectedTags] = useState<ContextTag[]>([]);
    const [otherLabel, setOtherLabel] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!activityId) return;
        const load = async () => {
            const list = await getMyListActivities();
            const found = list.find((a) => a.id === activityId);
            if (found) {
                setTitle(found.title);
                setSelectedTriggers(found.triggers);
                setInstructions(found.instructions ?? '');
                setSelectedTags(found.tags ?? []);
                setOtherLabel(found.otherLabel ?? '');
            }
        };
        load();
    }, [activityId]);

    const toggleTrigger = (t: Trigger) => {
        setSelectedTriggers((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
        );
    };

    const toggleTag = (t: ContextTag) => {
        setSelectedTags((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
        );
    };

    const isValid =
        title.trim().length > 0 &&
        selectedTriggers.length > 0 &&
        (!selectedTriggers.includes('OTHER') || otherLabel.trim().length > 0);

    const handleSave = async () => {
        if (!isValid || isSaving) return;
        setIsSaving(true);
        try {
            const now = Date.now();
            const activity: Activity = {
                id: isEdit ? activityId! : generateId(),
                title: title.trim(),
                triggers: selectedTriggers,
                instructions: instructions.trim() || undefined,
                isFavorite: false,
                source: 'USER_CREATED',
                createdAt: isEdit ? now : now, // will be overwritten from existing on update
                updatedAt: now,
                tags: selectedTags.length > 0 ? selectedTags : undefined,
                otherLabel: selectedTriggers.includes('OTHER') ? otherLabel.trim() : undefined,
            };
            if (isEdit) {
                await updateActivity(activity);
            } else {
                await saveActivity(activity);
            }
            navigation.goBack();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete activity', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (activityId) {
                        await deleteActivity(activityId);
                        navigation.goBack();
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    {isEdit ? 'Edit activity' : 'New activity'}
                </Text>
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
                keyboardShouldPersistTaps="handled"
            >
                {/* Title */}
                <Text style={styles.fieldLabel}>Title *</Text>
                <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Walk around the block"
                    placeholderTextColor="#52525B"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={80}
                />

                {/* Triggers */}
                <Text style={styles.fieldLabel}>Trigger(s) *</Text>
                <View style={styles.chipGrid}>
                    {TRIGGER_ORDER.map((t) => {
                        const active = selectedTriggers.includes(t);
                        return (
                            <Pressable
                                key={t}
                                style={[styles.chip, active && styles.chipActive]}
                                onPress={() => toggleTrigger(t)}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                    {TRIGGER_LABELS[t]}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Other label */}
                {selectedTriggers.includes('OTHER') && (
                    <>
                        <Text style={styles.fieldLabel}>Label for "Other" *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="e.g. FOMO, waiting, work tension…"
                            placeholderTextColor="#52525B"
                            value={otherLabel}
                            onChangeText={setOtherLabel}
                            maxLength={60}
                        />
                    </>
                )}

                {/* Instructions */}
                <Text style={styles.fieldLabel}>Instructions (optional)</Text>
                <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="1–3 lines about what to do…"
                    placeholderTextColor="#52525B"
                    value={instructions}
                    onChangeText={setInstructions}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />

                {/* Tags */}
                <Text style={styles.fieldLabel}>Tags (optional)</Text>
                <View style={styles.chipGrid}>
                    {AVAILABLE_TAGS.map((t) => {
                        const active = selectedTags.includes(t);
                        return (
                            <Pressable
                                key={t}
                                style={[styles.tagChip, active && styles.tagChipActive]}
                                onPress={() => toggleTag(t)}
                            >
                                <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                                    {t.replace('_', ' ')}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Footer actions */}
            <View style={styles.footer}>
                {isEdit && (
                    <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                )}
                <Pressable
                    style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isValid || isSaving}
                >
                    <Text style={styles.saveBtnText}>
                        {isSaving ? 'Saving…' : 'Save activity'}
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0F0F17' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    headerTitle: {
        flex: 1,
        color: '#FAFAFA',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    closeBtn: { padding: 4 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
    fieldLabel: {
        color: '#A1A1AA',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#18181B',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FAFAFA',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#27272A',
    },
    textArea: {
        minHeight: 80,
        paddingTop: 14,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#18181B',
        borderWidth: 1,
        borderColor: '#27272A',
    },
    chipActive: {
        backgroundColor: '#27254A',
        borderColor: '#8B7AE8',
    },
    chipText: { color: '#71717A', fontSize: 14, fontWeight: '500' },
    chipTextActive: { color: '#A78BFA', fontWeight: '600' },
    tagChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#18181B',
        borderWidth: 1,
        borderColor: '#27272A',
    },
    tagChipActive: {
        backgroundColor: '#1A2A1A',
        borderColor: '#4ADE80',
    },
    tagChipText: { color: '#71717A', fontSize: 13 },
    tagChipTextActive: { color: '#4ADE80', fontWeight: '600' },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#1C1C1C',
    },
    saveBtn: {
        flex: 1,
        backgroundColor: '#8B7AE8',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { color: '#FAFAFA', fontSize: 16, fontWeight: '700' },
    deleteBtn: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 14,
        backgroundColor: '#1A0A0A',
        borderWidth: 1,
        borderColor: '#7F1D1D',
    },
    deleteBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
