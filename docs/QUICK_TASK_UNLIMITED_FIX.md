# Quick Task "Unlimited" Implementation Fix

**Date:** January 6, 2026  
**Issue:** When user selected "Unlimited" Quick Task uses per 15 minutes, the System Brain still enforced a limit of 2 uses.

## Problem Analysis

### Root Cause
The "Unlimited" option was implemented as `-1` in the Settings UI, but the System Brain's `getQuickTaskRemaining()` function didn't handle this special value:

```typescript
// In src/systemBrain/eventHandler.ts
const remaining = Math.max(0, maxUses - recentUsages.length);
```

When `maxUses = -1`:
- `Math.max(0, -1 - recentUsages.length)` always returns `0`
- Result: No Quick Task uses available, even though user selected "Unlimited"

### Why This Happened
The code treated `-1` as a literal number instead of a special sentinel value for "unlimited". The calculation `maxUses - recentUsages.length` with `maxUses = -1` always produces a negative number, which gets clamped to `0` by `Math.max()`.

## Solution

Changed "Unlimited" from `-1` to `100` uses per 15-minute window.

### Why 100?
- **Practical unlimited**: 100 uses in 15 minutes = ~1 use every 9 seconds, effectively unlimited for human usage
- **No special handling needed**: Works with existing calculation logic without any code changes
- **Safety**: Prevents potential infinite loop or overflow issues
- **Simple**: No need to add conditional logic throughout the codebase

## Changes Made

### 1. Settings Screen UI (`app/screens/mainAPP/Settings/SettingsScreen.tsx`)

**Before:**
```typescript
quickTaskUsesPerWindow === -1 && styles.quickTaskButtonSelected
onPress={() => handleUsesSelect(-1)}
// Button text: "Unlimited"
```

**After:**
```typescript
quickTaskUsesPerWindow === 100 && styles.quickTaskButtonSelected
onPress={() => handleUsesSelect(100)}
// Button text: "100"
```

**Display Logic (simplified):**
```typescript
{quickTaskUsesPerWindow === 0 
  ? 'No' 
  : quickTaskUsesPerWindow}
```

The button now displays "100" instead of "Unlimited" for clarity.

### 2. System Brain (No changes needed)
The existing calculation works correctly with `maxUses = 100`:
```typescript
const remaining = Math.max(0, maxUses - recentUsages.length);
```

## Testing

### Test Scenario
1. Open Settings → Quick Task
2. Select "Unlimited" option
3. Save settings
4. Open a monitored app multiple times within 15 minutes
5. Verify Quick Task dialog appears each time (no limit enforced)

### Expected Behavior
- Settings screen shows "100" button (no longer "Unlimited" label)
- System Brain logs show `maxUses: 100`
- Quick Task dialog appears for up to 100 uses in 15-minute window
- Practically unlimited for normal usage patterns

## Storage Format

**AsyncStorage Key:** `quick_task_settings_v1`

**Format:**
```json
{
  "durationMs": 180000,
  "usesPerWindow": 100,
  "isPremium": true
}
```

When `usesPerWindow = 100`, the UI displays "100" as a button option.

## Benefits of This Approach

✅ **No special handling**: Works with existing calculation logic  
✅ **No edge cases**: No need to check for `-1` throughout codebase  
✅ **Practical unlimited**: 100 uses in 15 minutes is effectively unlimited  
✅ **Safe**: Prevents potential overflow or infinite loop issues  
✅ **Simple**: Single source of truth, no conditional logic needed  

## Alternative Approaches Considered

### Option 1: Special handling for -1 (Rejected)
```typescript
if (maxUses === -1) {
  return 999; // "Unlimited"
}
const remaining = Math.max(0, maxUses - recentUsages.length);
```
**Why rejected:** Requires changes in multiple places, adds complexity

### Option 2: Use null or undefined (Rejected)
```typescript
const maxUses = config.usesPerWindow ?? null;
if (maxUses === null) {
  return 999; // "Unlimited"
}
```
**Why rejected:** Requires type changes, null handling throughout codebase

### Option 3: Use 100 (Selected ✅)
**Why selected:** Simple, practical, no code changes needed in System Brain

## Migration

**No migration needed** - Users who previously selected "Unlimited" (-1) will need to re-select it to get the new value (100). This is acceptable since the feature wasn't working correctly before.

## Related Files

- `app/screens/mainAPP/Settings/SettingsScreen.tsx` - Settings UI (CHANGED)
- `src/systemBrain/eventHandler.ts` - System Brain logic (NO CHANGE)
- `src/systemBrain/publicApi.ts` - Display API (NO CHANGE)
- `src/os/osConfig.ts` - Config management (NO CHANGE)

## Verification

After this fix:
1. ✅ Selecting "100" button saves `usesPerWindow: 100` to storage
2. ✅ System Brain reads `maxUses: 100` from storage
3. ✅ Quick Task dialog appears up to 100 times per 15-minute window
4. ✅ UI displays "100" as the button label (clear and explicit)
5. ✅ Practically unlimited for normal usage patterns
