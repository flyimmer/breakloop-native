/**
 * Alternatives grouping helpers
 *
 * Source: alternatives_tab_spec_v1.md §4
 *
 * Three group modes:
 *   TRIGGERS  — section per trigger (spec §86)
 *   CONTEXT   — derived from tags (spec §4.2)
 *   TYPE      — derived from tags (spec §4.3)
 */

import {
    TRIGGER_LABELS,
    TRIGGER_ORDER,
    type Activity,
    type ContextTag,
    type GroupBy,
} from './types';

// --------------------------------------------------------------------------
// Search
// --------------------------------------------------------------------------

/**
 * Filter activities by a search query.
 * Searches: title, instructions, otherLabel, notes, tags (joined).
 */
export function searchActivities(activities: Activity[], query: string): Activity[] {
    const q = query.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => {
        const haystack = [
            a.title,
            a.instructions,
            a.otherLabel,
            a.notes,
            ...(a.tags ?? []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });
}

// --------------------------------------------------------------------------
// Trigger grouping
// --------------------------------------------------------------------------

export interface GroupedSection {
    key: string; // trigger key or label
    label: string;
    activities: Activity[];
}

export function groupByTriggers(activities: Activity[]): GroupedSection[] {
    const map = new Map<string, Activity[]>();
    for (const t of TRIGGER_ORDER) {
        map.set(t, []);
    }
    for (const a of activities) {
        // Primary trigger = first in array
        const primary = a.triggers[0];
        if (primary) {
            map.get(primary)?.push(a);
        }
    }
    const sections: GroupedSection[] = [];
    for (const t of TRIGGER_ORDER) {
        const items = map.get(t) ?? [];
        if (items.length > 0) {
            sections.push({ key: t, label: TRIGGER_LABELS[t], activities: items });
        }
    }
    return sections;
}

// --------------------------------------------------------------------------
// Context grouping (spec §4.2)
// --------------------------------------------------------------------------

/** Priority list: first matching tag wins the primary context group */
const CONTEXT_PRIORITY: Array<{ tag: ContextTag; label: string }> = [
    { tag: 'no_phone', label: 'No phone' },
    { tag: 'outside', label: 'Outside' },
    { tag: 'social', label: 'Social / connection' },
    { tag: 'movement', label: 'Movement' },
    { tag: 'calm', label: 'Calm' },
    { tag: 'planning', label: 'Planning' },
    { tag: 'creative', label: 'Creative' },
    { tag: 'learning', label: 'Learning' },
    { tag: 'practical', label: 'Practical' },
    { tag: 'at_home', label: 'At home' },
    { tag: 'no_feed', label: 'No feed' },
];

function primaryContextLabel(activity: Activity): string {
    const tags = activity.tags ?? [];
    for (const { tag, label } of CONTEXT_PRIORITY) {
        if (tags.includes(tag)) return label;
    }
    return 'Other';
}

export function groupByContext(activities: Activity[]): GroupedSection[] {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
        const label = primaryContextLabel(a);
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(a);
    }
    // Sort sections by priority order
    const ORDER = [...CONTEXT_PRIORITY.map((c) => c.label), 'Other'];
    return [...map.entries()]
        .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
        .map(([label, acts]) => ({ key: label, label, activities: acts }));
}

// --------------------------------------------------------------------------
// Type grouping (spec §4.3)
// --------------------------------------------------------------------------

const TYPE_RULES: Array<{ tags: ContextTag[]; label: string }> = [
    { tags: ['calm'], label: 'Breathe / Calm' },
    { tags: ['movement'], label: 'Move' },
    { tags: ['social'], label: 'Connect' },
    { tags: ['planning'], label: 'Plan' },
    { tags: ['creative'], label: 'Create' },
    { tags: ['learning'], label: 'Learn' },
    { tags: ['practical'], label: 'Tidy / Practical' },
];

function primaryTypeLabel(activity: Activity): string {
    const tags = activity.tags ?? [];
    for (const { tags: ruleTags, label } of TYPE_RULES) {
        if (ruleTags.some((t) => tags.includes(t))) return label;
    }
    return 'Rest / Recover';
}

export function groupByType(activities: Activity[]): GroupedSection[] {
    const map = new Map<string, Activity[]>();
    for (const a of activities) {
        const label = primaryTypeLabel(a);
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(a);
    }
    return [...map.entries()].map(([label, acts]) => ({
        key: label,
        label,
        activities: acts,
    }));
}

// --------------------------------------------------------------------------
// Unified grouping dispatcher
// --------------------------------------------------------------------------

export function groupActivities(
    activities: Activity[],
    groupBy: GroupBy
): GroupedSection[] {
    switch (groupBy) {
        case 'TRIGGERS':
            return groupByTriggers(activities);
        case 'CONTEXT':
            return groupByContext(activities);
        case 'TYPE':
            return groupByType(activities);
    }
}
