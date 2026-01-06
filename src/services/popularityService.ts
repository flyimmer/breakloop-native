/**
 * Popularity Service
 * 
 * Manages global popularity tracking for alternative activities.
 * 
 * Architecture:
 * - Local storage: Tracks which activities the current user has liked
 * - Server storage: Tracks global popularity count per activity (future)
 * - When user saves activity → increment global popularity
 * - When user deletes activity → decrement global popularity
 * 
 * Current Implementation: LOCAL ONLY (Phase 1)
 * - Simulates global popularity using localStorage
 * - Ready to swap with real backend API
 * 
 * Future Implementation: SERVER-BASED (Phase 2)
 * - POST /api/alternatives/:id/like - Increment popularity
 * - DELETE /api/alternatives/:id/like - Decrement popularity
 * - GET /api/alternatives/popularity - Fetch all popularity counts
 * - WebSocket: Real-time popularity updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const POPULARITY_STORAGE_KEY = 'alternatives_popularity_v1';
const USER_LIKES_STORAGE_KEY = 'alternatives_user_likes_v1';

// Type definitions
export type PopularityData = {
  [activityId: string]: number; // activity ID → like count
};

export type UserLikes = {
  [activityId: string]: boolean; // activity ID → has user liked?
};

/**
 * Load global popularity data from storage
 * Phase 1: Uses localStorage (simulates global state)
 * Phase 2: Will fetch from server API
 */
export async function loadPopularityData(): Promise<PopularityData> {
  try {
    const stored = await AsyncStorage.getItem(POPULARITY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {};
  } catch (error) {
    console.error('[PopularityService] Failed to load popularity data:', error);
    return {};
  }
}

/**
 * Save global popularity data to storage
 * Phase 1: Uses localStorage (simulates global state)
 * Phase 2: Will sync to server API
 */
export async function savePopularityData(data: PopularityData): Promise<void> {
  try {
    await AsyncStorage.setItem(POPULARITY_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[PopularityService] Failed to save popularity data:', error);
  }
}

/**
 * Load user's liked activities from storage
 */
export async function loadUserLikes(): Promise<UserLikes> {
  try {
    const stored = await AsyncStorage.getItem(USER_LIKES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {};
  } catch (error) {
    console.error('[PopularityService] Failed to load user likes:', error);
    return {};
  }
}

/**
 * Save user's liked activities to storage
 */
export async function saveUserLikes(likes: UserLikes): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_LIKES_STORAGE_KEY, JSON.stringify(likes));
  } catch (error) {
    console.error('[PopularityService] Failed to save user likes:', error);
  }
}

/**
 * Increment popularity for an activity (user saved to My List)
 * 
 * Phase 1: Updates localStorage
 * Phase 2: Will call POST /api/alternatives/:id/like
 */
export async function incrementPopularity(activityId: string): Promise<number> {
  try {
    // Load current data
    const popularityData = await loadPopularityData();
    const userLikes = await loadUserLikes();

    // Check if user already liked this activity
    if (userLikes[activityId]) {
      console.warn('[PopularityService] User already liked activity:', activityId);
      return popularityData[activityId] || 0;
    }

    // Increment popularity
    const currentCount = popularityData[activityId] || 0;
    const newCount = currentCount + 1;
    popularityData[activityId] = newCount;

    // Mark as liked by user
    userLikes[activityId] = true;

    // Save both
    await Promise.all([
      savePopularityData(popularityData),
      saveUserLikes(userLikes),
    ]);

    console.log(`[PopularityService] Incremented popularity for ${activityId}: ${currentCount} → ${newCount}`);
    return newCount;

    // Phase 2: Replace with server API call
    // const response = await fetch(`${API_BASE_URL}/alternatives/${activityId}/like`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${userToken}` },
    // });
    // const { popularity } = await response.json();
    // return popularity;
  } catch (error) {
    console.error('[PopularityService] Failed to increment popularity:', error);
    throw error;
  }
}

/**
 * Decrement popularity for an activity (user deleted from My List)
 * 
 * Phase 1: Updates localStorage
 * Phase 2: Will call DELETE /api/alternatives/:id/like
 */
export async function decrementPopularity(activityId: string): Promise<number> {
  try {
    // Load current data
    const popularityData = await loadPopularityData();
    const userLikes = await loadUserLikes();

    // Check if user hasn't liked this activity
    if (!userLikes[activityId]) {
      console.warn('[PopularityService] User has not liked activity:', activityId);
      return popularityData[activityId] || 0;
    }

    // Decrement popularity (minimum 0)
    const currentCount = popularityData[activityId] || 0;
    const newCount = Math.max(0, currentCount - 1);
    popularityData[activityId] = newCount;

    // Mark as not liked by user
    delete userLikes[activityId];

    // Save both
    await Promise.all([
      savePopularityData(popularityData),
      saveUserLikes(userLikes),
    ]);

    console.log(`[PopularityService] Decremented popularity for ${activityId}: ${currentCount} → ${newCount}`);
    return newCount;

    // Phase 2: Replace with server API call
    // const response = await fetch(`${API_BASE_URL}/alternatives/${activityId}/like`, {
    //   method: 'DELETE',
    //   headers: { 'Authorization': `Bearer ${userToken}` },
    // });
    // const { popularity } = await response.json();
    // return popularity;
  } catch (error) {
    console.error('[PopularityService] Failed to decrement popularity:', error);
    throw error;
  }
}

/**
 * Get popularity for a specific activity
 */
export async function getPopularity(activityId: string): Promise<number> {
  try {
    const popularityData = await loadPopularityData();
    return popularityData[activityId] || 0;
  } catch (error) {
    console.error('[PopularityService] Failed to get popularity:', error);
    return 0;
  }
}

/**
 * Get all popularity data
 * Phase 2: Will fetch from server API
 */
export async function getAllPopularity(): Promise<PopularityData> {
  return await loadPopularityData();
}

/**
 * Check if user has liked an activity
 */
export async function hasUserLiked(activityId: string): Promise<boolean> {
  try {
    const userLikes = await loadUserLikes();
    return userLikes[activityId] === true;
  } catch (error) {
    console.error('[PopularityService] Failed to check user like:', error);
    return false;
  }
}

/**
 * Sync popularity data with server (Phase 2)
 * 
 * This function will:
 * 1. Fetch latest popularity counts from server
 * 2. Update local cache
 * 3. Return updated data
 */
export async function syncPopularityWithServer(): Promise<PopularityData> {
  // Phase 1: No-op (local only)
  console.log('[PopularityService] Server sync not implemented yet (Phase 1)');
  return await loadPopularityData();

  // Phase 2: Implement server sync
  // try {
  //   const response = await fetch(`${API_BASE_URL}/alternatives/popularity`);
  //   const popularityData = await response.json();
  //   await savePopularityData(popularityData);
  //   return popularityData;
  // } catch (error) {
  //   console.error('[PopularityService] Failed to sync with server:', error);
  //   return await loadPopularityData(); // Fallback to local cache
  // }
}
