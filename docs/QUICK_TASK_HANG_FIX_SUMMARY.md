# Quick Task Hang Fix - Implementation Summary

**Issue:** App hangs after second Quick Task  
**Root Cause:** Launching SystemSurface just to immediately finish it  
**Fix:** System Brain performs silent cleanup without launching UI  
**Status:** ✅ Implemented, ready for testing

---

## 🎯 What Changed

### System Brain (`src/systemBrain/eventHandler.ts`)

**Quick Task Expiration → No UI Launch:**
```typescript
if (timerType === 'QUICK_TASK') {
  // Silent cleanup only - no SystemSurface launch
  console.log('[System Brain] ✓ Quick Task expired - silent cleanup only (no UI)');
  // Timer already cleared from state
  // User continues using app uninterrupted
}
```

**Intention Timer Expiration → Still Launches UI:**
```typescript
else {
  // Intention timer expiration launches intervention
  console.log('[System Brain] 🚨 Intention timer expired - launching intervention');
  await launchSystemSurface(packageName, 'INTENTION_EXPIRED_FOREGROUND');
}
```

### SystemSurface (`app/roots/SystemSurfaceRoot.tsx`)

**Added Warning for Dead Code Path:**
```typescript
} else if (wakeReason === 'QUICK_TASK_EXPIRED_FOREGROUND') {
  // ⚠️ DEAD CODE PATH - kept as safety net
  console.warn('[SystemSurfaceRoot] ⚠️ UNEXPECTED: Launched for QUICK_TASK_EXPIRED_FOREGROUND');
  console.warn('[SystemSurfaceRoot] System Brain should handle silent expiration without launching UI');
  finishSurfaceOnly();
  return;
}
```

---

## ✅ What This Fixes

1. **No More Zombie Activities** - SystemSurface not launched unnecessarily
2. **No More Ghost Overlays** - No rapid launch/finish cycles
3. **No More App Hangs** - Underlying app receives touch events normally
4. **Truly Silent Expiration** - "Silent" now means no UI, not "launch and finish"

---

## 🧪 Testing Checklist

Run these tests to verify the fix:

- [ ] **Test 1:** Second Quick Task after expiration (critical - this was the bug)
- [ ] **Test 2:** Silent expiration shows no SystemSurface launch in logs
- [ ] **Test 3:** Screen lock during Quick Task expiration
- [ ] **Test 4:** Intention timer still launches intervention (regression check)
- [ ] **Test 5:** Notification shade doesn't cancel intervention (previous fix)

---

## 📊 Expected Logs

**Silent Expiration (Correct):**
```
[System Brain] ✓ Quick Task expired - silent cleanup only (no UI)
[System Brain] Timer cleared, user continues using app uninterrupted
```

**Should NOT See:**
```
❌ [SystemSurfaceRoot] Intent extras
❌ [SystemSurfaceRoot] QUICK_TASK_EXPIRED_FOREGROUND
```

**If Regression Occurs:**
```
⚠️ [SystemSurfaceRoot] UNEXPECTED: Launched for QUICK_TASK_EXPIRED_FOREGROUND
```

---

## 🎓 Key Principle

> **"Silent" operations should be truly silent. If you don't need UI, don't launch it.**

This fix enforces semantic correctness: System Brain makes the decision, and if the decision is "no UI needed", then no Activity is launched.

---

**Files Modified:**
- `src/systemBrain/eventHandler.ts` (lines 239-254)
- `app/roots/SystemSurfaceRoot.tsx` (lines 266-277)

**Documentation:**
- `docs/QUICK_TASK_SILENT_EXPIRATION_FIX.md` (comprehensive)
- `docs/QUICK_TASK_HANG_FIX_SUMMARY.md` (this file)

**Next Step:** Build and test with `npm run android`
