# Quick Task Global Usage Fix

**Date:** December 30, 2024  
**Issue:** Quick Task usage was tracked per-app instead of globally across all monitored apps.

## Problem

### Incorrect Implementation (Before)
```typescript
// WRONG: Per-app usage tracking
const quickTaskUsageHistory: Map<string, number[]> = new Map();

// Instagram usage: [timestamp1]
// TikTok usage: [timestamp2]
// Result: User can use Quick Task 2 times on Instagram AND 2 times on TikTok
```

### Correct Specification
**"2 uses per 15-minute window" is GLOBAL across ALL monitored apps.**

- If user uses Quick Task on Instagram → 1 use consumed globally
- If user then uses Quick Task on TikTok → 2 uses consumed globally
- User cannot use Quick Task again on ANY app until 15-minute window expires

## Solution

### Changed Data Structure

**Before (Per-App):**
```typescript
const quickTaskUsageHistory: Map<string, number[]> = new Map();
// {
//   'com.instagram.android': [timestamp1, timestamp2],
//   'com.zhiliaoapp.musically': [timestamp3]
// }
```

**After (Global):**
```typescript
const quickTaskUsageHistory: number[] = [];
// [timestamp1, timestamp2, timestamp3]
// All usages from all apps in one array
```

### Updated Functions

#### 1. `getQuickTaskRemaining()`

**Before:**
```typescript
function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
  // Get usage history for THIS app only
  const history = quickTaskUsageHistory.get(packageName) || [];
  const recentUsages = history.filter(ts => currentTimestamp - ts < windowMs);
  const remaining = Math.max(0, maxUses - recentUsages.length);
  return remaining;
}
```

**After:**
```typescript
function getQuickTaskRemaining(packageName: string, currentTimestamp: number): number {
  // Filter GLOBAL history (all apps)
  const recentUsages = quickTaskUsageHistory.filter(ts => currentTimestamp - ts < windowMs);
  
  // Update GLOBAL history
  if (recentUsages.length !== quickTaskUsageHistory.length) {
    quickTaskUsageHistory.length = 0;
    quickTaskUsageHistory.push(...recentUsages);
  }
  
  // Calculate remaining uses GLOBALLY
  const remaining = Math.max(0, maxUses - recentUsages.length);
  return remaining;
}
```

#### 2. `recordQuickTaskUsage()`

**Before:**
```typescript
function recordQuickTaskUsage(packageName: string, timestamp: number): void {
  const history = quickTaskUsageHistory.get(packageName) || [];
  history.push(timestamp);
  quickTaskUsageHistory.set(packageName, history);
}
```

**After:**
```typescript
function recordQuickTaskUsage(packageName: string, timestamp: number): void {
  // Add to GLOBAL history (not per-app)
  quickTaskUsageHistory.push(timestamp);
  
  console.log('[OS Trigger Brain] Quick Task usage recorded (GLOBAL)', {
    packageName,
    timestamp,
    totalUsagesGlobal: quickTaskUsageHistory.length,
    note: 'Usage is GLOBAL across all apps',
  });
}
```

#### 3. `resetTrackingState()`

**Added:**
```typescript
export function resetTrackingState(): void {
  // ... other resets ...
  quickTaskTimers.clear();
  quickTaskUsageHistory.length = 0; // Clear global usage history
  console.log('[OS Trigger Brain] Tracking state reset (including Quick Task state)');
}
```

## Behavior Examples

### Example 1: Global Quota Consumption

**Settings:**
- Max uses: 2 per 15-minute window
- Quick Task duration: 3 minutes

**Timeline:**
```
09:00 - User opens Instagram
        → Quick Task dialog appears (2 uses remaining)
        → User clicks Quick Task
        → Usage recorded: [timestamp_09:00]
        → Global remaining: 1

09:05 - User opens TikTok
        → Quick Task dialog appears (1 use remaining)
        → User clicks Quick Task
        → Usage recorded: [timestamp_09:00, timestamp_09:05]
        → Global remaining: 0

09:10 - User opens YouTube
        → Quick Task dialog DOES NOT appear (0 uses remaining)
        → Breathing screen appears instead
        → Must complete full intervention

09:15 - First usage expires (09:00 + 15min)
        → Usage history: [timestamp_09:05]
        → Global remaining: 1

09:16 - User opens Instagram again
        → Quick Task dialog appears (1 use remaining)
        → Can use Quick Task again
```

### Example 2: Cross-App Quota Sharing

**Scenario:** User has 2 uses per 15 minutes

```
Step 1: Use Quick Task on Instagram
  - quickTaskUsageHistory = [t1]
  - Remaining globally: 1

Step 2: Use Quick Task on TikTok
  - quickTaskUsageHistory = [t1, t2]
  - Remaining globally: 0

Step 3: Try to open Facebook
  - Check remaining: 0
  - No Quick Task option available
  - Must complete full intervention

Step 4: Try to open Instagram again
  - Check remaining: 0
  - No Quick Task option available
  - Even though Instagram was used 10 minutes ago
  - Global quota is exhausted
```

### Example 3: Window Expiration

**Scenario:** 15-minute rolling window

```
09:00 - Instagram Quick Task used
        quickTaskUsageHistory = [09:00]
        
09:05 - TikTok Quick Task used
        quickTaskUsageHistory = [09:00, 09:05]
        
09:10 - YouTube opened
        Remaining: 0 (both usages within 15min)
        No Quick Task available
        
09:16 - Facebook opened
        Filter history: currentTime (09:16) - 15min = 09:01
        09:00 < 09:01 → expired, removed
        09:05 > 09:01 → still valid
        quickTaskUsageHistory = [09:05]
        Remaining: 1
        Quick Task available!
        
09:21 - Instagram opened
        Filter history: currentTime (09:21) - 15min = 09:06
        09:05 < 09:06 → expired, removed
        quickTaskUsageHistory = []
        Remaining: 2
        Full quota restored!
```

## What Stays Per-App

While usage history is global, these remain **per-app**:

### 1. Quick Task Timers (Per-App) ✅
```typescript
const quickTaskTimers: Map<string, { expiresAt: number }> = new Map();
```

**Why:** Each app needs its own protection timer.

**Example:**
- Instagram Quick Task active → Instagram protected for 3 minutes
- TikTok Quick Task active → TikTok protected for 3 minutes
- Both can be active simultaneously with different expiration times

### 2. Intention Timers (Per-App) ✅
```typescript
const intentionTimers: Map<string, { expiresAt: number }> = new Map();
```

**Why:** Each app has its own intention duration after intervention.

**Example:**
- Complete Instagram intervention → Instagram gets 30-minute intention timer
- Complete TikTok intervention → TikTok gets its own 30-minute timer
- Independent expiration

### 3. Interventions In Progress (Per-App) ✅
```typescript
const interventionsInProgress: Set<string> = new Set();
```

**Why:** Track which apps currently have active interventions.

**Example:**
- Instagram intervention active → 'com.instagram.android' in set
- Switch to TikTok → Instagram intervention abandoned, TikTok intervention starts
- Only one intervention active at a time per app

## UI Impact

### Quick Task Dialog

**Before (Wrong):**
```
Quick Task dialog for Instagram:
"You have 2 Quick Tasks remaining" (per Instagram)

Quick Task dialog for TikTok:
"You have 2 Quick Tasks remaining" (per TikTok)
```

**After (Correct):**
```
Quick Task dialog for Instagram:
"You have 2 Quick Tasks remaining" (globally)

[User uses Quick Task on Instagram]

Quick Task dialog for TikTok:
"You have 1 Quick Task remaining" (globally)

[User uses Quick Task on TikTok]

Open YouTube:
No Quick Task dialog - breathing screen appears
(0 uses remaining globally)
```

### QuickTaskDialogScreen

The screen already uses `quickTaskRemaining` from `BEGIN_INTERVENTION` action:

```typescript
// In QuickTaskDialogScreen.tsx
const { quickTaskRemaining } = interventionState;

// Display:
<Text>You have {quickTaskRemaining} Quick Tasks remaining</Text>
```

**No changes needed** - the value is already calculated globally by `getQuickTaskRemaining()`.

## Testing

### Test 1: Global Quota Consumption
```
1. Open Instagram → Quick Task (2 remaining)
2. Click Quick Task → Success
3. Open TikTok → Quick Task (1 remaining)
4. Click Quick Task → Success
5. Open YouTube → No Quick Task (0 remaining)
   ✅ Expected: Breathing screen appears
```

### Test 2: Quota Restoration
```
1. Use Quick Task on Instagram (09:00)
2. Use Quick Task on TikTok (09:05)
3. Wait until 09:16 (first usage expires)
4. Open Facebook → Quick Task available (1 remaining)
   ✅ Expected: Can use Quick Task again
```

### Test 3: Cross-App Quota Sharing
```
1. Use Quick Task on Instagram
2. Immediately open Instagram again
   ✅ Expected: No intervention (Quick Task timer protects it)
3. Open TikTok
   ✅ Expected: Quick Task available but with 1 less remaining
```

### Test 4: Timer Independence
```
1. Use Quick Task on Instagram (3min timer)
2. Use Quick Task on TikTok (3min timer)
3. Wait 3 minutes
4. Open Instagram → Intervention triggers
   ✅ Expected: Instagram timer expired
5. Open TikTok → Intervention triggers
   ✅ Expected: TikTok timer expired
6. Both apps protected independently during their timer duration
```

## Key Insights

### Global vs Per-App Summary

| Feature | Scope | Reason |
|---------|-------|--------|
| **Usage History** | GLOBAL | Limit total Quick Task uses across all apps |
| **Quick Task Timer** | Per-App | Each app needs independent protection window |
| **Intention Timer** | Per-App | Each app has independent intention duration |
| **Intervention State** | Per-App | Each app has independent intervention flow |

### Why Global Usage Makes Sense

1. **Prevents Abuse:** User can't bypass intervention by switching between apps
2. **Fair Resource Allocation:** Quick Task is a limited resource shared across all apps
3. **Encourages Mindfulness:** Forces user to be selective about when to use Quick Task
4. **Simpler Mental Model:** "I have 2 Quick Tasks per 15 minutes, period"

### Why Timers Stay Per-App

1. **Technical Necessity:** Each app needs independent protection
2. **User Experience:** Completing intervention for Instagram shouldn't affect TikTok
3. **Fairness:** Each app gets its own intention duration after intervention

## Related Files

**Modified:**
- `src/os/osTriggerBrain.ts` - Changed usage history from `Map<string, number[]>` to `number[]`

**Unchanged (already correct):**
- `app/screens/conscious_process/QuickTaskDialogScreen.tsx` - Uses `quickTaskRemaining` from state
- `src/core/intervention/transitions.js` - Passes `quickTaskRemaining` in `BEGIN_INTERVENTION`

## Migration Notes

**No data migration needed** - usage history is ephemeral (only tracks last 15 minutes).

When app restarts, usage history starts fresh. This is acceptable because:
- Quick Task is meant for immediate needs
- 15-minute window is short-term
- No need to persist across app restarts

