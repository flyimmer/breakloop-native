# Duplicate Event Filter Fix - SystemSurface Bootstrap

**Date:** January 5, 2026  
**Issue:** OS Trigger Brain filters Instagram as "duplicate event" during SystemSurface bootstrap  
**Root Cause:** `lastMeaningfulApp` state shared across React contexts causes duplicate filtering  
**Solution:** Force evaluation flag to bypass duplicate check during bootstrap

---

## Problem Summary

When Instagram was opened, the following occurred:

1. **MainActivity context** (line 76-90 in logs):
   - Instagram enters foreground
   - OS Trigger Brain evaluates
   - Tries to dispatch but **NO DISPATCHER** connected (correctly skipped in MAIN_APP)
   - Sets `lastMeaningfulApp = "com.instagram.android"`

2. **SystemSurfaceActivity launches** (line 110-127 in logs):
   - Bootstrap initialization runs
   - Calls `handleForegroundAppChange(instagram)`
   - OS Trigger Brain checks: `lastMeaningfulApp === instagram`
   - **Line 125:** `[OS Trigger Brain] Duplicate event filtered (same meaningful app)`
   - No intervention dispatched
   - Bootstrap never exits BOOTSTRAPPING state
   - **Result: Instagram hangs with no UI**

### The Core Issue

OS Trigger Brain module state (`lastMeaningfulApp`) is a **singleton** shared across both React contexts:
- MainActivity sets `lastMeaningfulApp = "instagram"`
- SystemSurfaceActivity tries to evaluate the same app
- Duplicate filter blocks re-evaluation
- No session created → bootstrap hangs forever

---

## Solution: Force Evaluation Flag

Implemented **Option A (Recommended)** from the requirements: explicit bypass mechanism via force flag.

### Why This Approach?

1. **Explicit and Clear**: The `force: true` flag makes intent obvious
2. **Surgical and Safe**: Only affects bootstrap call, MainApp unchanged
3. **Aligns with Architecture**:
   - SystemSurface = "one-time adjudicator" (must always evaluate)
   - MainApp = "continuous listener" (duplicate filtering applies)

---

## Implementation Details

### Change 1: Add Force Flag to OS Trigger Brain

**File:** [`src/os/osTriggerBrain.ts`](src/os/osTriggerBrain.ts)

**Function signature updated:**
```typescript
export function handleForegroundAppChange(
  app: { packageName: string; timestamp: number },
  options?: { force?: boolean }
): void {
  const { packageName, timestamp } = app;
  const force = options?.force ?? false;
  
  // ... rest of function
}
```

**Duplicate filter updated:**
```typescript
// Skip logic for heartbeat events (same app, no actual switch)
// EXCEPTION 1: If intention timer just expired, we MUST re-evaluate logic
// EXCEPTION 2: If force === true (SystemSurface bootstrap), we MUST re-evaluate
if (lastMeaningfulApp === packageName && !intentionJustExpired && !force) {
  // Duplicate event - skip
  console.log('[OS Trigger Brain] Duplicate event filtered (same meaningful app)');
  return;
}

if (lastMeaningfulApp === packageName && force) {
  console.log('[OS Trigger Brain] Duplicate event BUT force === true (SystemSurface bootstrap) - will re-evaluate logic');
}
```

**Key changes:**
- Added optional `options` parameter with `force` flag
- Updated duplicate check to include `&& !force`
- Added logging when force bypass is used

---

### Change 2: Use Force Flag in Bootstrap

**File:** [`app/roots/SystemSurfaceRoot.tsx`](app/roots/SystemSurfaceRoot.tsx)

**Bootstrap initialization updated:**
```typescript
// t10-t11: Run OS Trigger Brain in THIS context (SystemSurface)
// CRITICAL: Use force flag to bypass duplicate event filtering
handleForegroundAppChange(
  {
    packageName: triggeringApp,
    timestamp: Date.now(),
  },
  { force: true } // Bypass duplicate filter for bootstrap
);
```

**Why this works:**
- Bootstrap calls OS Trigger Brain with `force: true`
- Duplicate filter is bypassed
- OS Trigger Brain evaluates Instagram even though `lastMeaningfulApp === instagram`
- Session is created
- Bootstrap exits
- Intervention UI appears

---

## Expected Flow After Fix

```
1. MainActivity context:
   - Instagram enters foreground
   - OS Trigger Brain evaluates
   - No dispatcher → warning logged
   - lastMeaningfulApp = "instagram"
   - No session created (correct)

2. SystemSurfaceActivity launches:
   - Bootstrap reads Intent extras
   - Calls handleForegroundAppChange(instagram, {force: true})
   - Duplicate check: lastMeaningfulApp === instagram BUT force === true
   - Bypass duplicate filter (logged)
   - OS Trigger Brain evaluates
   - Dispatcher IS connected
   - Dispatches START_INTERVENTION
   - Session created: {kind: 'INTERVENTION', app: 'instagram'}
   - bootstrapState = 'READY'
   - Bootstrap exits
   - Intervention UI appears ✓
```

---

## Why This Doesn't Break MainApp

### MainApp Context (Continuous Listener)

**Never passes force flag:**
```typescript
// In App.tsx - foreground event listener
handleForegroundAppChange({
  packageName: event.packageName,
  timestamp: event.timestamp,
});
// No options parameter = force defaults to false
```

**Duplicate filtering still works:**
- User switches: Instagram → TikTok → Instagram
- First Instagram: Evaluated (new app)
- Second Instagram: Filtered as duplicate (correct)
- No redundant evaluations

### SystemSurface Context (One-Time Adjudicator)

**Only uses force flag during bootstrap:**
```typescript
// In SystemSurfaceRoot.tsx - bootstrap initialization
handleForegroundAppChange(
  { packageName: triggeringApp, timestamp: Date.now() },
  { force: true }
);
```

**After bootstrap:**
- No more calls to `handleForegroundAppChange()` in SystemSurface context
- Force flag only used once
- Normal duplicate filtering resumes if needed

---

## Comparison: Before vs After

### Before (Duplicate Filter Bug)

```
Log sequence:
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] WARN No dispatcher set - cannot trigger
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] Duplicate event filtered (same meaningful app) ❌
[SystemSurfaceRoot] ✅ Bootstrap initialization complete
[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment ← STUCK
```

**Result:** Hang forever, no UI

### After (Force Flag Fix)

```
Log sequence:
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] WARN No dispatcher set - cannot trigger
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] Duplicate event BUT force === true (SystemSurface bootstrap) - will re-evaluate logic ✓
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] Starting INTERVENTION session for app: com.instagram.android
[SystemSession] Bootstrap phase complete - session established ✓
[SystemSurfaceRoot] Rendering InterventionFlow ✓
```

**Result:** Intervention UI appears correctly

---

## Files Modified

1. **`src/os/osTriggerBrain.ts`**
   - Added optional `options` parameter to `handleForegroundAppChange()`
   - Added `force` flag that defaults to `false`
   - Updated duplicate check to include `&& !force` condition
   - Added logging when force bypass is used

2. **`app/roots/SystemSurfaceRoot.tsx`**
   - Pass `{ force: true }` when calling `handleForegroundAppChange()` during bootstrap
   - Added comment explaining why force flag is needed

---

## Testing

### Test Scenario
1. Build and install app: `npm run android`
2. Enable Accessibility Service
3. Add Instagram to monitored apps
4. Close BreakLoop app
5. Open Instagram

### Expected Result
- SystemSurfaceActivity launches
- Bootstrap initialization runs
- Log shows: "Duplicate event BUT force === true"
- Session created
- Bootstrap exits
- Breathing screen appears
- No hang, no home screen flash

### Expected Logs

```
[RuntimeContext] Detected context: SYSTEM_SURFACE
[App] ✅ Connected OS Trigger Brain (SYSTEM_SURFACE context)
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: {triggeringApp: "com.instagram.android", wakeReason: "MONITORED_APP_FOREGROUND"}
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] Duplicate event BUT force === true (SystemSurface bootstrap) - will re-evaluate logic
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] Starting INTERVENTION session for app: com.instagram.android
[SystemSession] Bootstrap phase complete - session established
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

---

## Why This Is The Right Fix

### 1. Targeted and Minimal
- Only 2 files modified
- ~10 lines of code added
- No architectural changes
- No global state mutations

### 2. Explicit and Clear
- Force flag makes intent obvious
- Easy to understand why it's needed
- Self-documenting code

### 3. Safe and Isolated
- MainApp behavior unchanged
- Duplicate filtering still works for continuous monitoring
- Only affects SystemSurface bootstrap (one-time use)

### 4. Aligns with Architecture
- SystemSurface = one-time adjudicator (must always evaluate)
- MainApp = continuous listener (duplicate filtering applies)
- Force flag explicitly distinguishes these two modes

### 5. No Side Effects
- No timers or delays
- No global resets
- No cross-context interference
- Pure functional approach

---

## Related Documents

- [`docs/system_surface_bootstrap.md`](docs/system_surface_bootstrap.md) - Authoritative bootstrap lifecycle
- [`CONTEXT_MISMATCH_FIX.md`](CONTEXT_MISMATCH_FIX.md) - Previous context mismatch fix
- [`BOOTSTRAP_PHASE_FIX.md`](BOOTSTRAP_PHASE_FIX.md) - Bootstrap phase implementation

---

## Conclusion

The duplicate event filter bug was caused by OS Trigger Brain's `lastMeaningfulApp` state being shared across React contexts. When SystemSurfaceActivity tried to evaluate Instagram during bootstrap, the duplicate filter incorrectly blocked re-evaluation.

The fix introduces an explicit `force` flag that bypasses duplicate filtering during SystemSurface bootstrap. This is a targeted, minimal change that preserves MainApp behavior while ensuring SystemSurface can always evaluate the triggering app.

The force flag approach is:
- **Explicit**: Intent is clear in code
- **Safe**: Only affects bootstrap, no side effects
- **Correct**: Aligns with "one-time adjudicator" vs "continuous listener" architecture
