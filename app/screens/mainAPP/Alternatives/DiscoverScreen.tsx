/**
 * DiscoverScreen
 *
 * Curated starter-pack activities. Users can browse and save to My List.
 * spec: alternatives_tab_spec_v1.md §5.3
 *
 * Section behaviour:
 *   - Sections start COLLAPSED (cards hidden)
 *   - Tap section header row → toggle cards visibility
 *   - Tap WHY chevron (when section open) → expand/collapse WHY text
 * Group-by options: All (flat) | Triggers | Context | Type
 */

import {
    getDiscoverActivities,
    saveActivity,
} from '@/src/core/alternatives/alternativesStorage';
import {
    groupActivities,
    searchActivities,
} from '@/src/core/alternatives/groupingHelpers';
import { TRIGGER_COPY } from '@/src/core/alternatives/triggerCopy';
import type { Activity, GroupBy, Trigger } from '@/src/core/alternatives/types';
import {
    BookmarkPlus,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Search,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type DiscoverActivity = Activity & { isSaved: boolean };
type GroupMode = GroupBy | null;

const GROUP_OPTIONS: { key: GroupMode; label: string }[] = [
    { key: null, label: 'All' },
    { key: 'TRIGGERS', label: 'Triggers' },
    { key: 'CONTEXT', label: 'Context' },
    { key: 'TYPE', label: 'Type' },
];

export default function DiscoverScreen() {
    const [activities, setActivities] = useState<DiscoverActivity[]>([]);
    const [query, setQuery] = useState('');
    const [groupMode, setGroupMode] = useState<GroupMode>('TRIGGERS');
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedWhy, setExpandedWhy] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        const result = await getDiscoverActivities();
        setActivities(result);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Reset expanded state when groupMode changes
    useEffect(() => {
        setExpandedSections(new Set());
        setExpandedWhy(new Set());
    }, [groupMode]);

    const handleSave = async (activity: DiscoverActivity) => {
        if (activity.isSaved || saving.has(activity.id)) return;
        setSaving((prev) => new Set(prev).add(activity.id));
        try {
            await saveActivity({ ...activity, source: 'STARTER_PACK' });
            setActivities((prev) =>
                prev.map((a) => (a.id === activity.id ? { ...a, isSaved: true } : a))
            );
            if (__DEV__) {
                console.log('[AlternativesScreen] saved_from_discover', { id: activity.id });
            }
        } finally {
            setSaving((prev) => {
                const next = new Set(prev);
                next.delete(activity.id);
                return next;
            });
        }
    };

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const toggleWhy = (e: any, key: string) => {
        e.stopPropagation?.();
        setExpandedWhy((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const filtered = useMemo(() => searchActivities(activities, query), [activities, query]);

    const sections = useMemo(() => {
        if (groupMode === null) return null;
        return groupActivities(filtered, groupMode);
    }, [filtered, groupMode]);

    return (
        <View style={styles.root}>
            {/* Search */}
            <View style={styles.searchRow}>
                <Search size={16} color="#71717A" strokeWidth={2} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search activities…"
                    placeholderTextColor="#52525B"
                    value={query}
                    onChangeText={setQuery}
                    clearButtonMode="while-editing"
                />
            </View>

            {/* Group-by */}
            <View style={styles.groupByRow}>
                <Text style={styles.groupByLabel}>View:</Text>
                {GROUP_OPTIONS.map((opt) => {
                    const active = groupMode === opt.key;
                    return (
                        <Pressable
                            key={String(opt.key)}
                            style={[styles.groupByChip, active && styles.groupByChipActive]}
                            onPress={() => setGroupMode(opt.key)}
                        >
                            <Text style={[styles.groupByChipText, active && styles.groupByChipTextActive]}>
                                {opt.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── FLAT (All) mode ── */}
                {groupMode === null && (filtered as DiscoverActivity[]).map((activity) => (
                    <DiscoverCard
                        key={activity.id}
                        activity={activity}
                        onSave={() => handleSave(activity)}
                        isSaving={saving.has(activity.id)}
                    />
                ))}

                {/* ── GROUPED mode ── */}
                {sections && sections.map((section) => {
                    const whyData = groupMode === 'TRIGGERS'
                        ? TRIGGER_COPY[section.key as Trigger]
                        : null;
                    const isSectionOpen = expandedSections.has(section.key);
                    const isWhyOpen = expandedWhy.has(section.key);

                    return (
                        <View key={section.key}>
                            {/* Section header row */}
                            <Pressable
                                style={styles.sectionHeader}
                                onPress={() => toggleSection(section.key)}
                            >
                                <View style={styles.sectionHeaderLeft}>
                                    <View style={styles.sectionTitleRow}>
                                        <Text style={styles.sectionTitle}>{section.label}</Text>
                                        <Text style={styles.sectionCount}>
                                            {section.activities.length}
                                        </Text>
                                    </View>
                                    {/* WHY one-liner — only shown when section open */}
                                    {whyData && isSectionOpen && (
                                        <Pressable
                                            style={styles.whyRow}
                                            onPress={(e) => toggleWhy(e, section.key)}
                                        >
                                            <Text style={styles.sectionOneLiner} numberOfLines={isWhyOpen ? undefined : 1}>
                                                {isWhyOpen ? whyData.microWhy : whyData.collapsedOneLiner}
                                            </Text>
                                            {isWhyOpen
                                                ? <ChevronUp size={12} color="#52525B" />
                                                : <ChevronDown size={12} color="#52525B" />
                                            }
                                        </Pressable>
                                    )}
                                    {whyData && isSectionOpen && isWhyOpen && (
                                        <View style={styles.microWhyBullets}>
                                            {whyData.microWhyBullets.map((b, i) => (
                                                <Text key={i} style={styles.microWhyBullet}>· {b}</Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                {isSectionOpen
                                    ? <ChevronDown size={18} color="#71717A" />
                                    : <ChevronRight size={18} color="#71717A" />
                                }
                            </Pressable>

                            {/* Cards — only shown when section is open */}
                            {isSectionOpen && (section.activities as DiscoverActivity[]).map((activity) => (
                                <DiscoverCard
                                    key={activity.id}
                                    activity={activity}
                                    onSave={() => handleSave(activity)}
                                    isSaving={saving.has(activity.id)}
                                />
                            ))}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

function DiscoverCard({
    activity,
    onSave,
    isSaving,
}: {
    activity: DiscoverActivity;
    onSave: () => void;
    isSaving: boolean;
}) {
    const saved = activity.isSaved;
    return (
        <View style={styles.card}>
            <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{activity.title}</Text>
                {activity.instructions && (
                    <Text style={styles.cardInstructions} numberOfLines={2}>
                        {activity.instructions}
                    </Text>
                )}
                {activity.tags && activity.tags.length > 0 && (
                    <View style={styles.tagRow}>
                        {activity.tags.slice(0, 3).map((t) => (
                            <View key={t} style={styles.tagChip}>
                                <Text style={styles.tagChipText}>{t.replace('_', ' ')}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
            <Pressable
                style={[styles.saveBtn, saved && styles.saveBtnSaved]}
                onPress={onSave}
                disabled={saved || isSaving}
            >
                {saved ? (
                    <>
                        <CheckCircle size={14} color="#4ADE80" strokeWidth={2} />
                        <Text style={styles.saveBtnTextSaved}>Saved</Text>
                    </>
                ) : (
                    <>
                        <BookmarkPlus size={14} color="#8B7AE8" strokeWidth={2} />
                        <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                    </>
                )}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0A0A0F' },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#18181B',
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
    },
    searchInput: { flex: 1, color: '#FAFAFA', fontSize: 15 },
    groupByRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8,
        gap: 8,
    },
    groupByLabel: { color: '#71717A', fontSize: 13, fontWeight: '500' },
    groupByChip: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#18181B',
    },
    groupByChipActive: { backgroundColor: '#3B3B52' },
    groupByChipText: { color: '#71717A', fontSize: 13, fontWeight: '500' },
    groupByChipTextActive: { color: '#FAFAFA', fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 6,
        marginTop: 6,
        borderRadius: 10,
        gap: 8,
    },
    sectionHeaderLeft: { flex: 1 },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        color: '#FAFAFA',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    sectionCount: { color: '#52525B', fontSize: 12, fontWeight: '500' },
    whyRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
        marginTop: 4,
    },
    sectionOneLiner: { flex: 1, color: '#71717A', fontSize: 12, lineHeight: 18 },
    microWhyBullets: { marginTop: 4, paddingLeft: 2 },
    microWhyBullet: { color: '#71717A', fontSize: 12, lineHeight: 18 },
    card: {
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    cardBody: { flex: 1 },
    cardTitle: { color: '#FAFAFA', fontSize: 15, fontWeight: '600', marginBottom: 3 },
    cardInstructions: { color: '#A1A1AA', fontSize: 13, lineHeight: 18, marginBottom: 6 },
    tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tagChip: {
        backgroundColor: '#27272A',
        borderRadius: 6,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    tagChipText: { color: '#A1A1AA', fontSize: 11 },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#1C1C2E',
        borderWidth: 1,
        borderColor: '#3B3B52',
        marginTop: 2,
    },
    saveBtnSaved: { borderColor: '#166534', backgroundColor: '#052E16' },
    saveBtnText: { color: '#8B7AE8', fontSize: 13, fontWeight: '600' },
    saveBtnTextSaved: { color: '#4ADE80', fontSize: 13, fontWeight: '600' },
});
