# Quick Task Silent Expiration Fix

**Date:** January 2026  
**Issue:** App hangs after second Quick Task due to zombie SystemSurfaceActivity  
**Root Cause:** Launching SystemSurface just to immediately finish it creates ghost overlay  
**Fix:** System Brain now performs silent cleanup without launching UI

---

## 🐛 Bug Description

**Symptom:**
- User opens monitored app (e.g., "xhs")
- Starts Quick Task → works fine
- Quick Task expires → silent cleanup
- Starts Quick Task again → **app hangs, cannot be operated**

**User Impact:**
- App becomes completely unresponsive
- User must force-close or restart
- Breaks core Quick Task functionality

---

## 🔍 Root Cause Analysis

### What Was Happening (Broken)

```
1. Quick Task timer expires while user is on app
2. System Brain emits TIMER_EXPIRED event
3. System Brain launches SystemSurfaceActivity with QUICK_TASK_EXPIRED_FOREGROUND
4. SystemSurfaceRoot receives wake reason
5. SystemSurfaceRoot immediately calls finishSurfaceOnly()
6. Activity launches and finishes in <100ms
7. Ghost overlay remains in WindowManager
8. Underlying app cannot receive touch events → HANG
```

### Why This Happened

**Architectural Violation:**
- "Silent expiration" means **no UI**, not "launch UI and finish immediately"
- Launching an Activity just to finish it creates race conditions with Android's WindowManager
- The rapid launch/finish cycle leaves zombie window layers that block input

**Key Insight:**
> If System Brain decides "no UI needed", then **do not launch SystemSurface at all**.

---

## ✅ The Fix

### System Brain Changes

**File:** `src/systemBrain/eventHandler.ts`

**Before (Broken):**
```typescript
if (currentForegroundApp === packageName) {
  // User is still on the app → launch SystemSurface for intervention
  console.log('[System Brain] 🚨 User still on expired app - launching intervention');
  
  const wakeReason = timerType === 'QUICK_TASK' 
    ? 'QUICK_TASK_EXPIRED_FOREGROUND' 
    : 'INTENTION_EXPIRED_FOREGROUND';
  
  await launchSystemSurface(packageName, wakeReason as any);
}
```

**After (Fixed):**
```typescript
if (currentForegroundApp === packageName) {
  if (timerType === 'QUICK_TASK') {
    // QUICK TASK EXPIRATION: Silent cleanup only (no UI)
    // "Silent" means NO SystemSurface launch
    console.log('[System Brain] ✓ Quick Task expired - silent cleanup only (no UI)');
    console.log('[System Brain] Timer cleared, user continues using app uninterrupted');
    // No SystemSurface launch - this is truly silent
  } else {
    // INTENTION TIMER EXPIRATION: Launch intervention
    console.log('[System Brain] 🚨 Intention timer expired - launching intervention');
    await launchSystemSurface(packageName, 'INTENTION_EXPIRED_FOREGROUND');
  }
}
```

**Key Changes:**
1. ✅ Quick Task expiration → **no SystemSurface launch**
2. ✅ Intention Timer expiration → **still launches intervention** (correct behavior)
3. ✅ Timer already cleared from state (line 215)
4. ✅ User continues using app uninterrupted

### SystemSurfaceRoot Changes

**File:** `app/roots/SystemSurfaceRoot.tsx`

**Before:**
```typescript
} else if (wakeReason === 'QUICK_TASK_EXPIRED_FOREGROUND') {
  // SILENT EXPIRATION: Pure side-effect, not a lifecycle event
  console.log('[SystemSurfaceRoot] Quick Task expired (silent) - finishing without UI');
  finishSurfaceOnly();
  return;
}
```

**After (Dead Code Path with Warning):**
```typescript
} else if (wakeReason === 'QUICK_TASK_EXPIRED_FOREGROUND') {
  // ⚠️ DEAD CODE PATH (as of fix for app hang bug)
  // System Brain should NOT launch SystemSurface for silent expiration
  // This case is kept as a safety net to prevent zombie Activities
  console.warn('[SystemSurfaceRoot] ⚠️ UNEXPECTED: Launched for QUICK_TASK_EXPIRED_FOREGROUND');
  console.warn('[SystemSurfaceRoot] System Brain should handle silent expiration without launching UI');
  console.warn('[SystemSurfaceRoot] Finishing immediately to prevent hang');
  
  finishSurfaceOnly();
  return;
}
```

**Why Keep Dead Code:**
- Safety net against future regressions
- Makes unexpected launches obvious in logs
- Prevents zombie Activities if bug reintroduced
- Costs nothing at runtime

---

## 🎯 What This Achieves

### 1. Eliminates Zombie Activities
- No more ghost overlays blocking input
- Clean lifecycle management
- No WindowManager race conditions

### 2. Respects Semantic Meaning
- "Silent expiration" truly means **no UI**
- System Brain makes decision, not SystemSurface
- Clear separation of concerns

### 3. Decouples Quick Task from Intervention
- Quick Task is an exception mechanism
- Intervention is a lifecycle flow
- No conflation of concepts

### 4. Prevents Future Regressions
- Dead code path logs unexpected launches
- Clear documentation of intent
- Defensive programming

---

## 🧪 Testing Strategy

### Critical Tests

**Test 1: Second Quick Task After Expiration**
```
1. Open monitored app (e.g., xhs)
2. Start Quick Task
3. Wait for expiration (silent)
4. Start Quick Task again
5. ✅ Expected: No hang, app remains responsive
```

**Test 2: Silent Expiration (No UI)**
```
1. Open monitored app
2. Start Quick Task
3. Stay on app until expiration
4. ✅ Expected: No SystemSurface launch in logs
5. ✅ Expected: User continues using app
```

**Test 3: Screen Lock During Expiration**
```
1. Open monitored app
2. Start Quick Task
3. Lock screen
4. Quick Task expires while screen is off
5. Unlock phone
6. ✅ Expected: No SystemSurface, user returns to last app
```

**Test 4: Intention Timer Still Works**
```
1. Open monitored app
2. Complete intervention, set intention timer
3. Stay on app until intention expires
4. ✅ Expected: SystemSurface launches with intervention flow
```

### Log Verification

**Silent Expiration Logs (Expected):**
```
[System Brain] ✓ Quick Task expired - silent cleanup only (no UI)
[System Brain] Timer cleared, user continues using app uninterrupted
```

**No SystemSurface Launch:**
```
❌ Should NOT see: [SystemSurfaceRoot] Intent extras
❌ Should NOT see: [SystemSurfaceRoot] QUICK_TASK_EXPIRED_FOREGROUND
```

**If Dead Code Path Triggers (Regression):**
```
⚠️ [SystemSurfaceRoot] UNEXPECTED: Launched for QUICK_TASK_EXPIRED_FOREGROUND
⚠️ [SystemSurfaceRoot] System Brain should handle silent expiration without launching UI
```

---

## 📋 Architectural Principles

### Semantic Clarity
- **Silent** = No UI, not "launch and finish immediately"
- System Brain makes semantic decisions
- SystemSurface only renders decisions

### Lifecycle Separation
- Quick Task = Exception mechanism (silent)
- Intention Timer = Lifecycle flow (with UI)
- No conflation of concepts

### Defensive Programming
- Keep dead code path with warnings
- Log unexpected behavior
- Fail gracefully

### Android Best Practices
- Don't launch Activities unnecessarily
- Respect WindowManager lifecycle
- Avoid rapid launch/finish cycles

---

## 🔄 Related Fixes

This fix completes the Quick Task bug fix series:

1. **Navigation Coupling** → Decoupled finish from navigation
2. **Silent Expiration UI** → Removed UI launch for silent expiration (this fix)
3. **System UI Misclassification** → Fixed notification shade cancelling intervention

All three fixes work together to create a robust Quick Task system.

---

## 📝 Implementation Checklist

- [x] Modified System Brain to skip SystemSurface launch for Quick Task expiration
- [x] Added warning logs to dead code path in SystemSurfaceRoot
- [x] Verified no linter errors
- [x] Documented architectural principles
- [x] Created comprehensive test plan
- [ ] Run Test 1: Second Quick Task after expiration
- [ ] Run Test 2: Silent expiration (no UI)
- [ ] Run Test 3: Screen lock during expiration
- [ ] Run Test 4: Intention timer still works
- [ ] Verify logs show silent cleanup
- [ ] Verify no SystemSurface launch in logs

---

## 🎓 Lessons Learned

### Key Takeaway
> "Silent" operations should be truly silent. If you don't need UI, don't launch it.

### Anti-Pattern Identified
```typescript
// ❌ WRONG: Launch Activity just to finish it
await launchSystemSurface(app, 'SILENT_OPERATION');
// ... SystemSurface immediately finishes

// ✅ CORRECT: Don't launch at all
silentCleanup();
```

### Design Principle
**Make semantic decisions at the boundary, not mid-flow.**
- System Brain decides: "Do we need UI?"
- If no → don't launch
- If yes → launch with explicit reason

---

## 🔗 Related Documentation

- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Mechanical vs semantic events
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - SystemSurface lifecycle
- `docs/OS_Trigger_Contract V1.md` - Quick Task timer rules

---

**Status:** ✅ Fix implemented, ready for testing  
**Next Step:** Run comprehensive test suite to verify all scenarios
