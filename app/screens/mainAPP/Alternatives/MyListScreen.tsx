/**
 * MyListScreen
 *
 * User's saved + created activities.
 * spec: alternatives_tab_spec_v1.md §5.1
 *
 * Section behaviour:
 *   - Sections start COLLAPSED (cards hidden)
 *   - Tap section header row → toggle cards visibility
 *   - Tap WHY chevron (only visible when section is open) → expand/collapse WHY text
 * Group-by options: All (flat) | Triggers | Context | Type
 * Deep-link: auto-expands + scrolls to highlightTrigger section
 */

import type { AlternativesStackParamList } from '@/app/navigation/AlternativesNavigator';
import {
    deleteActivity,
    getMyListActivities,
    toggleFavorite,
} from '@/src/core/alternatives/alternativesStorage';
import {
    groupActivities,
    searchActivities,
} from '@/src/core/alternatives/groupingHelpers';
import { TRIGGER_COPY } from '@/src/core/alternatives/triggerCopy';
import { type Activity, type GroupBy, type Trigger } from '@/src/core/alternatives/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Pencil,
    Plus,
    Search,
    Star,
    Trash2,
} from 'lucide-react-native';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type Nav = NativeStackNavigationProp<AlternativesStackParamList>;

/** null = "All" (flat list, no grouping) */
type GroupMode = GroupBy | null;

const GROUP_OPTIONS: { key: GroupMode; label: string }[] = [
    { key: null, label: 'All' },
    { key: 'TRIGGERS', label: 'Triggers' },
    { key: 'CONTEXT', label: 'Context' },
    { key: 'TYPE', label: 'Type' },
];

interface Props {
    highlightTrigger: Trigger | null;
}

export default function MyListScreen({ highlightTrigger }: Props) {
    const navigation = useNavigation<Nav>();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [query, setQuery] = useState('');
    const [groupMode, setGroupMode] = useState<GroupMode>('TRIGGERS');
    /** Keys of sections whose CARDS are currently expanded */
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    /** Keys of sections whose WHY text is expanded (independent of above) */
    const [expandedWhy, setExpandedWhy] = useState<Set<string>>(new Set());
    const [highlightKey, setHighlightKey] = useState<string | null>(null);
    const sectionRefs = useRef<Record<string, number>>({});
    const scrollRef = useRef<ScrollView>(null);
    const highlightAnim = useRef(new Animated.Value(0)).current;

    const loadActivities = useCallback(async () => {
        const loaded = await getMyListActivities();
        setActivities(loaded);
    }, []);

    useEffect(() => { loadActivities(); }, [loadActivities]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', loadActivities);
        return unsub;
    }, [navigation, loadActivities]);

    // Deep-link: switch to Triggers, auto-expand + scroll + highlight target section
    useEffect(() => {
        if (!highlightTrigger) return;
        setGroupMode('TRIGGERS');
        // Auto-expand the target section
        setExpandedSections((prev) => new Set(prev).add(highlightTrigger));
        setHighlightKey(highlightTrigger);
        setTimeout(() => {
            const y = sectionRefs.current[highlightTrigger];
            if (y !== undefined && scrollRef.current) {
                scrollRef.current.scrollTo({ y, animated: true });
            }
            Animated.sequence([
                Animated.timing(highlightAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
                Animated.timing(highlightAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
            ]).start(() => setHighlightKey(null));
        }, 300);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightTrigger]);

    // Reset expanded sections when grouping changes
    useEffect(() => {
        setExpandedSections(new Set());
        setExpandedWhy(new Set());
    }, [groupMode]);

    const filtered = useMemo(() => searchActivities(activities, query), [activities, query]);

    const sections = useMemo(() => {
        if (groupMode === null) return null; // flat mode
        return groupActivities(filtered, groupMode);
    }, [filtered, groupMode]);

    const favorites = useMemo(
        () => activities.filter((a) => a.isFavorite).slice(0, 6),
        [activities]
    );

    const handleToggleFavorite = async (id: string) => {
        await toggleFavorite(id);
        loadActivities();
    };
    const handleDelete = async (id: string) => {
        await deleteActivity(id);
        loadActivities();
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
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Favorites row */}
                {favorites.length > 0 && (
                    <View style={styles.favSection}>
                        <Text style={styles.favTitle}>⭐ Favorites</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.favRow}
                        >
                            {favorites.map((a) => (
                                <Pressable
                                    key={a.id}
                                    style={styles.favChip}
                                    onPress={() =>
                                        navigation.navigate('ActivityDetail', { activityId: a.id })
                                    }
                                >
                                    <Text style={styles.favChipText} numberOfLines={2}>{a.title}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Empty state */}
                {activities.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyTitle}>Your list is empty</Text>
                        <Text style={styles.emptySubtitle}>
                            Tap + to add an activity, or browse Discover to save one.
                        </Text>
                    </View>
                )}

                {/* ── FLAT (All) mode ── */}
                {groupMode === null && filtered.map((activity) => (
                    <ActivityCard
                        key={activity.id}
                        activity={activity}
                        onPress={() => navigation.navigate('ActivityDetail', { activityId: activity.id })}
                        onFavorite={() => handleToggleFavorite(activity.id)}
                        onEdit={() => navigation.navigate('AddEditActivity', { activityId: activity.id })}
                        onDelete={() => handleDelete(activity.id)}
                    />
                ))}

                {/* ── GROUPED mode ── */}
                {sections && sections.map((section) => {
                    const whyData = groupMode === 'TRIGGERS'
                        ? TRIGGER_COPY[section.key as Trigger]
                        : null;
                    const isSectionOpen = expandedSections.has(section.key);
                    const isWhyOpen = expandedWhy.has(section.key);
                    const isHighlighted = section.key === highlightKey;

                    return (
                        <View
                            key={section.key}
                            onLayout={(e) => {
                                sectionRefs.current[section.key] = e.nativeEvent.layout.y;
                            }}
                        >
                            {/* Section header row — tap to expand/collapse cards */}
                            <Pressable
                                style={[
                                    styles.sectionHeader,
                                    isHighlighted && styles.sectionHeaderHighlight,
                                ]}
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
                                {/* Expand/collapse chevron */}
                                {isSectionOpen
                                    ? <ChevronDown size={18} color="#71717A" />
                                    : <ChevronRight size={18} color="#71717A" />
                                }
                            </Pressable>

                            {/* Activity cards — only shown when section is open */}
                            {isSectionOpen && section.activities.map((activity) => (
                                <ActivityCard
                                    key={activity.id}
                                    activity={activity}
                                    onPress={() =>
                                        navigation.navigate('ActivityDetail', { activityId: activity.id })
                                    }
                                    onFavorite={() => handleToggleFavorite(activity.id)}
                                    onEdit={() =>
                                        navigation.navigate('AddEditActivity', { activityId: activity.id })
                                    }
                                    onDelete={() => handleDelete(activity.id)}
                                />
                            ))}
                        </View>
                    );
                })}
            </ScrollView>

            {/* FAB */}
            <Pressable
                style={styles.fab}
                onPress={() => navigation.navigate('AddEditActivity', {})}
            >
                <Plus size={24} color="#FAFAFA" strokeWidth={2.5} />
            </Pressable>
        </View>
    );
}

function ActivityCard({
    activity,
    onPress,
    onFavorite,
    onEdit,
    onDelete,
}: {
    activity: Activity;
    onPress: () => void;
    onFavorite: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={onPress}
        >
            <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{activity.title}</Text>
                {activity.instructions && (
                    <Text style={styles.cardInstructions} numberOfLines={1}>
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
            <View style={styles.cardActions}>
                <Pressable onPress={(e) => { e.stopPropagation(); onFavorite(); }} hitSlop={8} style={styles.cardAction}>
                    <Star
                        size={16}
                        color={activity.isFavorite ? '#F59E0B' : '#52525B'}
                        fill={activity.isFavorite ? '#F59E0B' : 'transparent'}
                        strokeWidth={2}
                    />
                </Pressable>
                <Pressable onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={8} style={styles.cardAction}>
                    <Pencil size={15} color="#52525B" strokeWidth={2} />
                </Pressable>
                <Pressable onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={8} style={styles.cardAction}>
                    <Trash2 size={15} color="#52525B" strokeWidth={2} />
                </Pressable>
            </View>
        </Pressable>
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
    scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
    favSection: { marginBottom: 16 },
    favTitle: {
        color: '#A1A1AA',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    favRow: { gap: 8, paddingRight: 8 },
    favChip: {
        backgroundColor: '#1C1C2A',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        maxWidth: 130,
        borderWidth: 1,
        borderColor: '#3B3B52',
    },
    favChipText: { color: '#FAFAFA', fontSize: 13, fontWeight: '500' },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { color: '#FAFAFA', fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptySubtitle: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    // Section header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 6,
        marginTop: 6,
        borderRadius: 10,
        gap: 8,
    },
    sectionHeaderHighlight: {
        backgroundColor: '#1C1C2E',
        borderWidth: 1,
        borderColor: '#8B7AE8',
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
    sectionCount: {
        color: '#52525B',
        fontSize: 12,
        fontWeight: '500',
    },
    whyRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
        marginTop: 4,
    },
    sectionOneLiner: {
        flex: 1,
        color: '#71717A',
        fontSize: 12,
        lineHeight: 18,
    },
    microWhyBullets: { marginTop: 4, paddingLeft: 2 },
    microWhyBullet: { color: '#71717A', fontSize: 12, lineHeight: 18 },
    // Cards
    card: {
        backgroundColor: '#18181B',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    cardPressed: { opacity: 0.75 },
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
    cardActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 10, paddingTop: 2 },
    cardAction: { padding: 4 },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#8B7AE8',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8B7AE8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
});
