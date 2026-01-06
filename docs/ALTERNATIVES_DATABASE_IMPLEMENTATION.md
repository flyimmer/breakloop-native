# Alternatives Database Implementation

**Date:** January 2025  
**Status:** ✅ Complete

## Overview

Implemented a comprehensive alternatives database with 36 predefined activities organized by root cause, replacing the previous placeholder data with the full database from the web reactive phone simulation.

## Changes Made

### 1. Documentation Created

**File:** `docs/alternatives-database.md`
- Complete reference of all 36 predefined alternatives
- Organized by 6 root causes (Loneliness, Boredom, Fatigue, No Goal, Self-Doubt, Anxiety)
- Includes activity details: ID, title, description, duration, type, tags, popularity, action steps
- Documents combination behavior and filtering logic

### 2. Database Implementation

**File:** `src/constants/alternativesDatabase.ts`
- TypeScript implementation of the alternatives database
- Type-safe `AlternativeActivity` interface
- 36 activities organized by root cause:
  - **Loneliness:** 7 activities (Hobby Class, Cook & Invite, Call Thomas, etc.)
  - **Boredom:** 8 activities (Make Tea Ritual, Tidy Up, Quick Sketch, etc.)
  - **Fatigue:** 5 activities (Power Nap, Do Nothing, Pomodoro Break, etc.)
  - **No Goal:** 5 activities (Values Check, Ideal Day, Space Prep, etc.)
  - **Self-Doubt:** 5 activities (Done List, Micro-Service, Tiny Skill, etc.)
  - **Anxiety:** 6 activities (5-4-3-2-1 Grounding, Box Breathing, Cold Splash, etc.)

**Key Functions:**
- `getAlternativesForCauses(selectedCauses)` - Get alternatives for selected root causes
- `filterAlternativesByContext(alternatives, context)` - Filter by time of day, weather, etc.

### 3. AlternativesScreen Integration

**File:** `app/screens/conscious_process/AlternativesScreen.tsx`

**Changes:**
- Imported alternatives database functions
- Added `useMemo` hook to compute filtered alternatives based on:
  - Selected root causes (from intervention state)
  - Context (night time filtering for social calls)
  - Already-saved activities (excluded from Discover tab)
- Updated `DiscoverTab` component to:
  - Accept `alternatives` prop
  - Display filtered alternatives from database
  - Show popularity (likes) instead of distance/points
  - Handle empty state when no alternatives match
  - Pass action steps to saved activities

**Behavior:**
- When user selects causes in Root Cause screen, Discover tab shows relevant alternatives
- Multiple causes combine alternatives (union, not intersection)
- Alternatives sorted by popularity (descending)
- Social call activities filtered out at night (10pm - 6am)
- Already-saved alternatives excluded from Discover tab

## Data Structure

### AlternativeActivity Type

```typescript
type AlternativeActivity = {
  id: string;                    // Unique identifier (e.g., 'l1', 'bo3', 'f1')
  title: string;                 // Display name
  description: string;           // Short description
  duration: string;              // e.g., "30m", "5m", "2h"
  type: 'calm' | 'creative' | 'leisure' | 'mental' | 'physical' | 'productive' | 'rest' | 'social';
  tags: string[];                // ['indoor'], ['outdoor'], ['social_call']
  popularity: number;            // Likes count for sorting
  actions: string[];             // Action steps (3-5 steps)
  causes: string[];              // Root causes this addresses
  isFriend?: boolean;            // Friend-specific activity flag
};
```

## Activity Statistics

- **Total Activities:** 36
- **Most Popular:** Power Nap (9,000 likes)
- **Activity Types:** 8 types (calm, creative, leisure, mental, physical, productive, rest, social)
- **Tags:** indoor, outdoor, social_call, daytime
- **Duration Range:** 2 minutes (Box Breathing) to 90 minutes (Cook & Invite)

## Root Cause Distribution

| Root Cause   | Activities | Most Popular Activity           |
|--------------|------------|---------------------------------|
| Loneliness   | 7          | Hobby Class (1,240 likes)       |
| Boredom      | 8          | Console Gaming (600 likes)      |
| Fatigue      | 5          | Power Nap (9,000 likes)         |
| No Goal      | 5          | Values Check (450 likes)        |
| Self-Doubt   | 5          | Done List (600 likes)           |
| Anxiety      | 6          | 5-4-3-2-1 Grounding (5,000 likes) |

## Context-Aware Filtering

### Night Time Filtering (10pm - 6am)
- Filters out activities with `social_call` tag
- Filters out activities with `daytime` tag
- Example: "Call Thomas" won't show at night

### Weather Filtering (Future)
- Will filter out `outdoor` activities when raining
- Currently not implemented (TODO)

## Combination Behavior

When user selects multiple root causes:
1. System combines all alternatives from selected causes
2. Removes duplicates (same activity ID)
3. Filters out already-saved alternatives in Discover tab
4. Applies context-aware filtering (time of day, weather)
5. Sorts by popularity (likes, descending)

## Future Enhancements

### Phase 1: Friend-Specific Activities
- Dynamic generation of "Call [Friend]" activities based on user's friends list
- Filter by friend availability/timezone
- Personalized descriptions

### Phase 2: Weather Integration
- Add weather API integration
- Filter outdoor activities when raining
- Suggest indoor alternatives

### Phase 3: AI Suggestions
- Replace placeholder AI suggestions with real Gemini API calls
- Context-aware generation based on:
  - Selected causes
  - User location
  - Time of day
  - Weather
  - User preferences/history

### Phase 4: User-Generated Content
- Allow users to create custom alternatives
- Share alternatives with community
- Rate and review alternatives

## Testing Checklist

- [x] Alternatives load correctly in Discover tab
- [x] Filtering by selected causes works
- [x] Night time filtering excludes social calls
- [x] Already-saved alternatives excluded from Discover
- [x] Popularity sorting works correctly
- [x] Empty state shows when no alternatives match
- [x] Save functionality works with new data structure
- [ ] Test with all 6 root causes individually
- [ ] Test with multiple cause combinations
- [ ] Test at different times of day
- [ ] Test save/unsave flow

## Migration Notes

### Breaking Changes
- Old `DISCOVER_ALTERNATIVES` constant replaced with database
- `distance` and `points` fields removed (not in new database)
- `popularity` field added (likes count)
- `actions` field added (action steps array)

### Backward Compatibility
- Saved activities from old format still work
- `SavedActivity` type updated to include optional `popularity` and `actions`
- Old saved activities won't have these fields (graceful degradation)

## References

- **Documentation:** `docs/alternatives-database.md`
- **Implementation:** `src/constants/alternativesDatabase.ts`
- **Usage:** `app/screens/conscious_process/AlternativesScreen.tsx`
- **Original Source:** Web reactive phone simulation (`src/App.js` lines 339-758)
