# Post-Quick Task Choice Screen - Fix Complete

## Summary

Successfully fixed the Post-Quick Task Choice screen bugs by implementing proper state synchronization between in-memory cache and persisted AsyncStorage state.

## Implementation Date

January 8, 2026

## Bugs Fixed

### Bug 1: Choice Screen Reappears After "Quit"

**Problem:** User presses "Quit this app" but choice screen reappears when reopening Instagram.

**Root Cause:** `clearExpiredQuickTaskInMemory()` deleted flag from in-memory cache, but System Brain reloaded stale state from AsyncStorage on next event, resurrecting the deleted flag.

**Fix:** Added `mergeWithInMemoryCache()` function that treats in-memory cache as authoritative overlay. Deleted flags stay deleted even if persistence still has them.

### Bug 2: Instagram Hangs

**Problem:** Instagram becomes unresponsive after choice screen interaction.

**Root Cause:** Stale flag retriggers POST_QUICK_TASK_CHOICE wake reason, causing SystemSurface to launch with invalid session state (session = null but activity alive).

**Fix:** Same merge logic ensures stale flags don't retrigger wake reasons.

## Architecture

### Key Principle (Locked)

**Once UI mutates System Brain state in memory, persistence must never resurrect deleted flags.**

### State Synchronization Model

```
Persisted State (AsyncStorage)
        ↓
    Load on each event
        ↓
    Merge with in-memory cache
        ↓
    In-memory overrides WIN
        ↓
    Use merged state
        ↓
    Save naturally on event completion
```

### Two Types of State

| State Type | Path | Example |
|------------|------|---------|
| System/OS events | Native → HeadlessTask | FOREGROUND_CHANGED, TIMER_EXPIRED |
| Explicit UI intent | In-memory mutation + merge | clearExpiredQuickTask, suppressQuickTaskForApp |

## Implementation

### Files Modified

1. **`src/systemBrain/stateManager.ts`**
   - Added `mergeWithInMemoryCache()` function
   - Updated `loadTimerState()` to merge with in-memory cache
   - Added dev assertion for debugging (optional)

2. **`src/systemBrain/eventHandler.ts`**
   - Verified `setInMemoryStateCache()` is called after load
   - Ensures in-memory cache reflects merged state

### No Changes Needed

- `app/screens/conscious_process/PostQuickTaskChoiceScreen.tsx` - Already correct
- No native code changes
- No AsyncStorage calls from UI
- No new events or native methods

## How It Works

### Complete Flow

1. **User presses "Quit":**
   - `clearExpiredQuickTaskInMemory(targetApp)` deletes flag from `inMemoryStateCache`
   - Session ends, user goes to home

2. **User opens Instagram again:**
   - Native emits `FOREGROUND_CHANGED` to System Brain HeadlessTask
   - System Brain calls `loadTimerState()`
   - `loadTimerState()` loads persisted state (still has old flag)
   - `loadTimerState()` calls `mergeWithInMemoryCache()`
   - **Merge detects flag is missing in memory → deletes it from merged state**
   - System Brain uses merged state (flag is gone)
   - Decision engine sees no expired flag → shows Quick Task dialog (correct)
   - System Brain calls `saveTimerState()` → persists merged state (flag deleted)

3. **Next time:**
   - Persisted state no longer has the flag
   - Merge is a no-op
   - Everything stays consistent

### Merge Logic

```typescript
export function mergeWithInMemoryCache(persistedState: TimerState): TimerState {
  if (!inMemoryStateCache) {
    return persistedState;
  }
  
  const mergedExpiredQuickTasks = { ...persistedState.expiredQuickTasks };
  
  // For each app in persisted state, check if it was deleted in memory
  for (const app in persistedState.expiredQuickTasks) {
    if (!inMemoryStateCache.expiredQuickTasks[app]) {
      // Flag exists in persistence but NOT in memory → was deleted by UI
      delete mergedExpiredQuickTasks[app];
      console.log('[SystemBrain] Merge: Deleted stale expiredQuickTask flag:', app);
    }
  }
  
  // Add any new flags from memory (defensive)
  for (const app in inMemoryStateCache.expiredQuickTasks) {
    if (!mergedExpiredQuickTasks[app]) {
      mergedExpiredQuickTasks[app] = inMemoryStateCache.expiredQuickTasks[app];
    }
  }
  
  return {
    ...persistedState,
    expiredQuickTasks: mergedExpiredQuickTasks,
  };
}
```

## Key Architectural Rules (Locked)

1. In-memory cache is authoritative overlay on persisted state
2. Persisted state is baseline; in-memory mutations override it
3. Merge happens on every load to ensure consistency
4. Persistence naturally updates on next save cycle
5. NO UI → AsyncStorage writes
6. NO native indirection for UI intent
7. NO resurrection of deleted flags

## Testing Results

**Expected Behavior:**
1. Open Instagram
2. Start Quick Task (10 seconds)
3. Wait for expiration while IN Instagram
4. Choice screen appears ✅
5. Press "Quit this app" ✅
6. Open Instagram again
7. Quick Task dialog appears (quota = 98) ✅
8. Choice screen does NOT reappear ✅
9. Instagram does NOT hang ✅

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
- `docs/POST_QUICK_TASK_CHOICE_LOGIC_FIX.md` - Original fix documentation
- `c:\Users\Wei Zhang\.cursor\plans\fix_post-quick_task_choice_state_clearing_(correct)_a5a2f2ba.plan.md` - Implementation plan

## Final Anchor Sentence (Locked Permanently)

**Explicit user intent inside SystemSurface must update System Brain state synchronously in memory — never via native or headless indirection.**
