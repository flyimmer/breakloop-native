# Phase 4.1 Quick Reference Card

**Status:** ✅ Implemented and Building  
**Build Command:** `npx expo prebuild --clean && npx expo run:android`

---

## What Changed (TL;DR)

**Before:** JavaScript decided Quick Task entry → race conditions, duplicate dialogs, immediate quits  
**After:** Native decides Quick Task entry → single authority, edge-triggered, deterministic

---

## Build Process (Correct Way)

### Using the Plugin System ✅

```bash
# Step 1: Clean prebuild (regenerates Android project)
npx expo prebuild --clean

# Step 2: Build and run
npx expo run:android
```

**What the plugin does:**
- Copies Kotlin files from `plugins/src/android/` → `android/app/src/main/`
- Registers services and activities in AndroidManifest.xml
- Adds required permissions
- Registers AppMonitorPackage in MainApplication.kt

**DO NOT** manually edit files in `android/app/src/main/java/` - they are auto-generated!

---

## Key Log Patterns to Look For

### ✅ Good (Phase 4.1 Working)

```
[ForegroundDetection] 🎯 MONITORED APP DETECTED: com.instagram.android
[ForegroundDetection] ✅ DECISION: Quick Task available (quota: 1)
[ForegroundDetection] 📤 Emitted QUICK_TASK_DECISION: SHOW_QUICK_TASK_DIALOG
[System Brain] 📨 QUICK_TASK_DECISION event received
[System Brain] ✅ EXECUTING NATIVE COMMAND: Show Quick Task dialog
[System Brain] NO re-evaluation, NO suppression, NO fallback
```

### ❌ Bad (Phase 4.1 Not Working)

```
[Decision Engine] OS Trigger Brain: QUICK_TASK
[Decision Engine] Quick Task suppressed for app entry
[Decision Engine] UNEXPECTED: OS Trigger Brain returned QUICK_TASK in Phase 4.1
```

---

## Quick Test (30 seconds)

1. Open Instagram from home screen
2. **Expected:** Quick Task dialog appears (if quota > 0)
3. **Expected:** No immediate quit to home
4. **Expected:** Dialog appears ONCE (no duplicates)

**If it works:** Phase 4.1 is successful! 🎉  
**If it doesn't:** Check logs for patterns above

---

## Emergency Rollback

If Phase 4.1 causes critical issues:

```bash
# 1. Revert Kotlin files in plugins/src/android/
git checkout plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt
git checkout plugins/src/android/java/com/anonymous/breakloopnative/AppMonitorModule.kt

# 2. Revert JS files
git checkout src/systemBrain/

# 3. Rebuild
npx expo prebuild --clean
npx expo run:android
```

---

## Architecture Summary

### Entry Decision Flow

```
User opens Instagram
  ↓
Native: Check isSystemSurfaceActive? (no)
Native: Check lastDecisionApp? (not Instagram)
Native: Check hasValidQuickTaskTimer? (no)
Native: Check cachedQuickTaskQuota > 0? (yes)
  ↓
Native: DECISION = SHOW_QUICK_TASK_DIALOG
Native: Set lastDecisionApp = "instagram"
Native: Emit QUICK_TASK_DECISION event
  ↓
JS: Receive event (COMMAND)
JS: Set phase = DECISION
JS: Notify Native (SystemSurface launching)
JS: Launch SystemSurface
  ↓
User sees Quick Task dialog
```

### Quota Sync Flow

```
User clicks "Quick Task" button
  ↓
JS: transitionQuickTaskToActive()
JS: Decrement quota (add to usage history)
JS: syncQuotaToNative(state)
  ↓
Native: cachedQuickTaskQuota updated
  ↓
Next app entry uses new quota
```

---

## Critical Invariants

1. **Edge-Triggered:** Native decides ONCE per app entry
2. **Command:** JS executes without re-evaluation
3. **Guards:** `isSystemSurfaceActive` and `lastDecisionApp` prevent duplicates
4. **Quota Sync:** Native cache updated on startup, usage, settings change
5. **Lifecycle:** Native notified when SystemSurface launches/finishes

---

## Files Modified (Phase 4.1)

### Native (Kotlin)
- `plugins/src/android/.../ForegroundDetectionService.kt`
- `plugins/src/android/.../AppMonitorModule.kt`

### JavaScript (TypeScript)
- `src/systemBrain/decisionEngine.ts`
- `src/systemBrain/eventHandler.ts`
- `src/systemBrain/index.ts`
- `src/systemBrain/publicApi.ts`
- `src/contexts/SystemSessionProvider.tsx`

---

## Next Steps After Build

1. ✅ Build completes successfully
2. ✅ App installs on device/emulator
3. ✅ Enable Accessibility Service
4. ✅ Add Instagram/TikTok to monitored apps
5. ✅ Run test scenarios from `PHASE_4_1_TEST_GUIDE.md`
6. ✅ Verify no regressions
7. ✅ Proceed to Phase 4.2

---

## Documentation

- **Implementation Details:** `PHASE_4_1_IMPLEMENTATION_COMPLETE.md`
- **Test Guide:** `PHASE_4_1_TEST_GUIDE.md` (7 scenarios)
- **Summary:** `PHASE_4_1_SUMMARY.md`
- **This Card:** `PHASE_4_1_QUICK_REFERENCE.md`

---

## Success Criteria

Phase 4.1 succeeds if:
1. ✅ Native decides once per entry (edge-triggered)
2. ✅ JS obeys without reinterpretation (command)
3. ✅ No immediate quit to home
4. ✅ No duplicate dialogs
5. ✅ No stale suppression

**Anchor:** Native decides once, JS obeys.
