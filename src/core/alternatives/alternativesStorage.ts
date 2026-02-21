/**
 * Alternatives Storage Service
 *
 * AsyncStorage-backed CRUD for user activities.
 * Storage key: 'alternatives_v1'
 *
 * On first load: if storage is empty, seeds starter pack activities
 * into the Discover tab data (starter pack is NOT auto-added to My List).
 *
 * Terminology:
 *  - "My List" = USER_CREATED activities stored here
 *  - "Discover" = STARTER_PACK_ACTIVITIES (static, never stored; just seeded once to track "saved" state)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STARTER_PACK_ACTIVITIES } from './starterPack';
import type { Activity } from './types';

const STORAGE_KEY = 'alternatives_v1';
// Tracks which starter-pack IDs have been saved to My List
const SAVED_FROM_DISCOVER_KEY = 'alternatives_saved_ids_v1';

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

async function readActivities(): Promise<Activity[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
            return JSON.parse(raw) as Activity[];
        }
        return [];
    } catch (e) {
        console.error('[AlternativesStorage] Failed to read activities:', e);
        return [];
    }
}

async function writeActivities(activities: Activity[]): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    } catch (e) {
        console.error('[AlternativesStorage] Failed to write activities:', e);
    }
}

async function readSavedDiscoverIds(): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(SAVED_FROM_DISCOVER_KEY);
        if (raw) {
            const arr = JSON.parse(raw) as string[];
            return new Set(arr);
        }
        return new Set();
    } catch {
        return new Set();
    }
}

async function writeSavedDiscoverIds(ids: Set<string>): Promise<void> {
    try {
        await AsyncStorage.setItem(
            SAVED_FROM_DISCOVER_KEY,
            JSON.stringify([...ids])
        );
    } catch (e) {
        console.error('[AlternativesStorage] Failed to write saved ids:', e);
    }
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Returns all activities in My List (user-created + saved-from-discover).
 * Does NOT include raw starter pack.
 */
export async function getMyListActivities(): Promise<Activity[]> {
    return readActivities();
}

/**
 * Returns all starter-pack activities with an `isSaved` flag indicating
 * whether the user has already saved them to My List.
 */
export async function getDiscoverActivities(): Promise<
    Array<Activity & { isSaved: boolean }>
> {
    const savedIds = await readSavedDiscoverIds();
    return STARTER_PACK_ACTIVITIES.map((a) => ({
        ...a,
        isSaved: savedIds.has(a.id),
    }));
}

/**
 * Save a new activity to My List.
 * If it originates from the starter pack, also records it in savedDiscoverIds.
 */
export async function saveActivity(activity: Activity): Promise<void> {
    const activities = await readActivities();
    // Prevent duplicates
    if (activities.some((a) => a.id === activity.id)) {
        return;
    }
    activities.push({ ...activity, updatedAt: Date.now() });
    await writeActivities(activities);

    if (activity.source === 'STARTER_PACK') {
        const ids = await readSavedDiscoverIds();
        ids.add(activity.id);
        await writeSavedDiscoverIds(ids);
    }
    if (__DEV__) {
        console.log('[AlternativesStorage] activity_added', {
            id: activity.id,
            source: activity.source,
            triggers: activity.triggers,
        });
    }
}

/** Update an existing activity (id must exist). */
export async function updateActivity(activity: Activity): Promise<void> {
    const activities = await readActivities();
    const idx = activities.findIndex((a) => a.id === activity.id);
    if (idx === -1) {
        console.warn('[AlternativesStorage] updateActivity: id not found', activity.id);
        return;
    }
    activities[idx] = { ...activity, updatedAt: Date.now() };
    await writeActivities(activities);
}

/** Delete an activity from My List. */
export async function deleteActivity(id: string): Promise<void> {
    let activities = await readActivities();
    activities = activities.filter((a) => a.id !== id);
    await writeActivities(activities);

    // Also remove from saved-discover set if applicable
    const ids = await readSavedDiscoverIds();
    if (ids.has(id)) {
        ids.delete(id);
        await writeSavedDiscoverIds(ids);
    }
    if (__DEV__) {
        console.log('[AlternativesStorage] activity_deleted', { id });
    }
}

/** Toggle isFavorite on an activity. */
export async function toggleFavorite(id: string): Promise<void> {
    const activities = await readActivities();
    const idx = activities.findIndex((a) => a.id === id);
    if (idx === -1) return;
    activities[idx] = {
        ...activities[idx],
        isFavorite: !activities[idx].isFavorite,
        updatedAt: Date.now(),
    };
    await writeActivities(activities);
    if (__DEV__) {
        console.log('[AlternativesStorage] favorite_toggled', {
            id,
            isFavorite: activities[idx].isFavorite,
        });
    }
}

/** Set lastUsedAt = now for an activity. */
export async function markUsed(id: string): Promise<void> {
    const activities = await readActivities();
    const idx = activities.findIndex((a) => a.id === id);
    if (idx === -1) return;
    activities[idx] = {
        ...activities[idx],
        lastUsedAt: Date.now(),
        updatedAt: Date.now(),
    };
    await writeActivities(activities);
    if (__DEV__) {
        console.log('[AlternativesStorage] do_this_now', { id });
    }
}
