# Intervention App Independence - Developer Reference

## Core Principle

**Each monitored app gets its own independent intervention flow.**

When a user switches from one monitored app to another during an active intervention, the old intervention is **abandoned** and a new intervention starts fresh for the new app.

## Implementation

### 1. State Machine Layer

**File:** `src/core/intervention/transitions.js`

```javascript
case 'BEGIN_INTERVENTION':
  // Always reset state, even if intervention already active
  return {
    ...context,
    state: 'breathing',
    targetApp: action.app,           // Update to new app
    breathingCount: action.breathingDuration,
    selectedCauses: [],              // Reset to empty
    selectedAlternative: null,       // Reset to null
    actionTimer: 0,                  // Reset to 0
  };
```

**Key Points:**
- `BEGIN_INTERVENTION` always resets all intervention state
- No conditional logic based on current state
- Previous app's state is completely discarded

### 2. OS Trigger Layer

**File:** `src/os/osTriggerBrain.ts`

```typescript
function triggerIntervention(packageName: string, timestamp: number): void {
  // Check if intervention already in progress for THIS SPECIFIC app
  if (interventionsInProgress.has(packageName)) {
    return; // Don't trigger duplicate intervention for same app
  }

  // Clear ALL in-progress interventions (for different apps)
  if (interventionsInProgress.size > 0) {
    const oldApps = Array.from(interventionsInProgress);
    interventionsInProgress.clear();
    console.log('[OS Trigger Brain] Clearing previous intervention(s) for app switch', {
      oldApps,
      newApp: packageName,
    });
  }

  // Mark THIS app as in-progress
  interventionsInProgress.add(packageName);
  
  // ... dispatch BEGIN_INTERVENTION
}
```

**Key Points:**
- Only ONE app can have active intervention at a time
- Previous app's in-progress flag is cleared
- New app gets fresh intervention

## State Lifecycle

### Normal Flow (No App Switch)

```
Instagram opens
  → BEGIN_INTERVENTION(Instagram)
  → interventionsInProgress = {Instagram}
  → User completes intervention
  → interventionsInProgress = {}
```

### App Switch During Intervention

```
Instagram opens
  → BEGIN_INTERVENTION(Instagram)
  → interventionsInProgress = {Instagram}
  → User selects root causes: [Boredom, Anxiety]
  
TikTok opens (intervention still active)
  → triggerIntervention(TikTok) called
  → interventionsInProgress.clear()  // Clear Instagram
  → interventionsInProgress = {TikTok}
  → BEGIN_INTERVENTION(TikTok)
  → State reset: selectedCauses = []  // Boredom, Anxiety discarded
  → targetApp = TikTok
```

## What Gets Reset

When switching apps during intervention:

| State Variable | Reset To | Notes |
|---------------|----------|-------|
| `state` | `'breathing'` | Always restart from breathing |
| `targetApp` | New app package | Update to new app |
| `breathingCount` | New duration | Restart countdown |
| `selectedCauses` | `[]` | Empty array |
| `selectedAlternative` | `null` | No selection |
| `actionTimer` | `0` | Timer reset |

## What Persists

Per-app data that persists independently:

- **Intention timers**: Each app has its own timer
- **Exit timestamps**: Tracked per app for app-switch interval logic
- **Intervention history**: (Future feature) Could track per-app intervention patterns

## Edge Cases

### 1. Rapid App Switching

```
Instagram → TikTok → YouTube → Instagram (all within seconds)
```

**Behavior:** Each switch triggers fresh intervention
**Result:** User sees 4 separate breathing countdowns

### 2. Switch to Non-Monitored App

```
Instagram (intervention active) → Chrome (not monitored)
```

**Behavior:** Instagram intervention remains active
**Result:** Returning to Instagram continues or restarts based on intention timer

### 3. Switch During Action Timer

```
Instagram (alternative activity timer running) → TikTok
```

**Behavior:** Instagram timer abandoned, TikTok starts fresh
**Result:** Instagram timer does NOT continue, TikTok gets new intervention

## Testing

**Quick Test:**
1. Open Instagram → Breathing starts
2. Wait for Root Cause screen
3. Select "Boredom"
4. Switch to TikTok (without clicking Continue)
5. **Verify:** TikTok shows breathing countdown, then empty root cause screen

**Expected Log:**
```
[OS Trigger Brain] Clearing previous intervention(s) for app switch {
  oldApps: ['com.instagram.android'],
  newApp: 'com.zhiliaoapp.musically'
}
```

## Common Pitfalls

### ❌ Don't Do This

```javascript
// BAD: Conditional reset based on app
case 'BEGIN_INTERVENTION':
  if (context.targetApp === action.app) {
    // Don't reset if same app
    return context;
  }
  // Reset only if different app
  return { ...context, ... };
```

**Why:** Creates complex state transitions, hard to reason about

### ✅ Do This

```javascript
// GOOD: Always reset
case 'BEGIN_INTERVENTION':
  return {
    ...context,
    state: 'breathing',
    targetApp: action.app,
    selectedCauses: [],
    // ... always reset everything
  };
```

**Why:** Simple, predictable, easy to test

## Related Documentation

- `docs/APP_SWITCH_INTERVENTION_FIX.md` - Detailed fix documentation
- `docs/APP_SWITCH_FIX_SUMMARY.md` - Quick summary
- `docs/TEST_APP_SWITCH_INTERVENTION.md` - Test plan
- `CLAUDE.md` - Full architecture documentation

## Questions?

**Q: Why not pause the old intervention and resume later?**  
A: Simplicity. Pausing/resuming adds complexity and potential bugs. Clean reset is easier to understand and test.

**Q: What if user wants to continue Instagram intervention after TikTok?**  
A: They can't. Each app switch is treated as a new conscious decision requiring fresh intervention.

**Q: Does this affect intention timers?**  
A: No. Each app's intention timer is independent and persists across interventions.

**Q: Can two apps have interventions at the same time?**  
A: No. Only ONE app can have active intervention. Previous intervention is always abandoned.

## Date

December 29, 2024

