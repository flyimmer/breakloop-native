# OS Trigger Logic Test Scenarios

**Contract Version:** V1 (Updated January 5, 2026)  
**Purpose:** Comprehensive test scenarios for OS Trigger Brain logic

---

## Test Configuration

**Monitored Apps:**
- Instagram (`com.instagram.android`)
- TikTok (`com.zhiliaoapp.musically`)

**Settings:**
- Intervention breathing duration: 5 seconds
- Quick Task duration: 3 minutes (180 seconds)
- Quick Task uses per window: 1 use per 15 minutes (global)

---

## Scenario 1: First Launch (No Previous State)

**Initial State:**
- Instagram: Never opened before
- `t_intention = 0` (not set)
- `t_quickTask = 0` (not active)
- `n_quickTask = 1` (1 use available)

**Action:** User opens Instagram

**Expected Logic Flow:**
1. Check `t_intention` → 0 (not set)
2. Check `n_quickTask` → 1 (available)
3. Check `t_quickTask` → 0 (not active)
4. **Result:** Show Quick Task dialog

**Expected Logs:**
```
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✓ n_quickTask != 0 (uses remaining: 1)
[OS Trigger Brain] ✗ t_quickTask = 0 (no active timer)
[OS Trigger Brain] → SHOW QUICK TASK DIALOG
```

---

## Scenario 2: Valid Intention Timer

**Initial State:**
- Instagram: `t_intention = 120s` (2 minutes remaining)
- `t_quickTask = 0`
- `n_quickTask = 1`

**Action:** User opens Instagram

**Expected Logic Flow:**
1. Check `t_intention` → 120s (valid)
2. **Result:** SUPPRESS everything

**Expected Logs:**
```
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] ✓ t_intention VALID (per-app)
[OS Trigger Brain] → SUPPRESS EVERYTHING
[OS Trigger Brain] → Remaining: 120s
```

---

## Scenario 3: Expired Intention Timer

**Initial State:**
- User in Instagram with `t_intention = 30s`
- After 30 seconds, timer expires
- `n_quickTask = 0` (no uses remaining)

**Action:** Timer expires while user still in Instagram

**Expected Logic Flow:**
1. Periodic check detects expiration
2. Delete `t_intention`
3. Re-evaluate logic:
   - Check `t_intention` → 0 (just deleted)
   - Check `n_quickTask` → 0 (no uses)
4. **Result:** START INTERVENTION

**Expected Logs:**
```
[OS Trigger Brain] Intention timer expired for FOREGROUND app — re-evaluating logic
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✗ n_quickTask = 0 (no uses remaining)
[OS Trigger Brain] → START INTERVENTION FLOW
```

---

## Scenario 4: Active Quick Task Timer

**Initial State:**
- Instagram: `t_intention = 0`
- `t_quickTask = 180s` (3 minutes remaining)
- `n_quickTask = 0` (used up, but timer still active)

**Action:** User opens Instagram

**Expected Logic Flow:**
1. Check `t_intention` → 0
2. Check `n_quickTask` → 0 (but we still check `t_quickTask`)
3. Check `t_quickTask` → 180s (active)
4. **Result:** SUPPRESS (Quick Task active)

**Expected Logs:**
```
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✓ n_quickTask != 0 (uses remaining: 0)
[OS Trigger Brain] ✓ t_quickTask ACTIVE (per-app)
[OS Trigger Brain] → SUPPRESS EVERYTHING
[OS Trigger Brain] → Remaining: 180s
```

**Note:** Even if `n_quickTask = 0`, an active `t_quickTask` still suppresses intervention.

---

## Scenario 5: Quick Task Dialog → User Activates Quick Task

**Initial State:**
- Instagram: `t_intention = 0`, `t_quickTask = 0`
- `n_quickTask = 1` (1 use available)
- Quick Task dialog is showing

**Action:** User clicks "Quick Task" button

**Expected Behavior:**
1. Set `t_quickTask = 180s` for Instagram
2. Record usage: `n_quickTask` decrements to 0
3. Hide Quick Task dialog
4. Launch Instagram

**Result After:**
- Instagram: `t_quickTask = 180s` (active)
- `n_quickTask = 0` (used up)
- User can use Instagram freely for 3 minutes

---

## Scenario 6: Quick Task Dialog → User Chooses "Continue"

**Initial State:**
- Instagram: `t_intention = 0`, `t_quickTask = 0`
- `n_quickTask = 1` (1 use available)
- Quick Task dialog is showing

**Action:** User clicks "Continue" button

**Expected Behavior:**
1. Hide Quick Task dialog
2. Start intervention flow:
   - Delete `t_intention` (already 0)
   - Mark intervention as in-progress
   - Dispatch `BEGIN_INTERVENTION`
3. Navigate to breathing screen

**Result:**
- Intervention starts
- `n_quickTask` remains 1 (not used)

---

## Scenario 7: Quick Task Expires

**Initial State:**
- User in Instagram with `t_quickTask = 180s`
- After 3 minutes, timer expires

**Action:** Timer expires while user still in Instagram

**Expected Behavior:**
1. Native layer detects expiration
2. Wake System Surface with `QUICK_TASK_EXPIRED` reason
3. JavaScript shows QuickTaskExpiredScreen
4. User clicks "Close & Go Home"
5. Clear `t_intention` for Instagram (reset to 0)
6. Navigate to home screen

**Expected Logs:**
```
[QuickTaskExpired] User clicked Close & Go Home
[QuickTaskExpired] Clearing t_intention for app: com.instagram.android
[OS Trigger Brain] Intention timer cleared for app: com.instagram.android
```

---

## Scenario 8: Per-App Independence

**Initial State:**
- Instagram: `t_intention = 120s`, `t_quickTask = 0`
- TikTok: `t_intention = 0`, `t_quickTask = 0`
- `n_quickTask = 1` (global)

**Action 1:** User opens Instagram

**Expected Result:**
- Check `t_intention` → 120s (valid)
- **SUPPRESS**

**Action 2:** User switches to TikTok

**Expected Result:**
- Check `t_intention` → 0 (TikTok has no timer)
- Check `n_quickTask` → 1 (available)
- Check `t_quickTask` → 0 (not active)
- **Show Quick Task dialog**

**Key Point:** Instagram's `t_intention` does NOT affect TikTok's evaluation.

---

## Scenario 9: Global n_quickTask

**Initial State:**
- Instagram: `t_intention = 0`, `t_quickTask = 0`
- TikTok: `t_intention = 0`, `t_quickTask = 0`
- `n_quickTask = 1` (global, 1 use available)

**Action 1:** User opens Instagram, activates Quick Task

**Result:**
- Instagram: `t_quickTask = 180s`
- `n_quickTask = 0` (used up)

**Action 2:** User switches to TikTok

**Expected Result:**
- Check `t_intention` → 0
- Check `n_quickTask` → 0 (no uses remaining)
- **START INTERVENTION** (no Quick Task dialog)

**Key Point:** Using Quick Task on Instagram consumes the global quota for TikTok.

---

## Scenario 10: Heartbeat Event (Same App)

**Initial State:**
- User in Instagram
- Instagram: `t_intention = 0`

**Action:** Accessibility service reports Instagram foreground again (heartbeat)

**Expected Result:**
- Detect same app (heartbeat event)
- **Skip all logic** (no intervention, no Quick Task dialog)

**Expected Logs:**
```
[OS Trigger Brain] App entered foreground: com.instagram.android
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
(Skip logic - heartbeat event)
```

---

## Scenario 11: Background Intention Timer Expiry

**Initial State:**
- Instagram: `t_intention = 30s`
- User in different app (e.g., Chrome)

**Action:** Instagram's `t_intention` expires while user in Chrome

**Expected Behavior:**
1. Periodic check detects expiration
2. Delete `t_intention` for Instagram
3. Log: "Intention timer expired for BACKGROUND app — deleting timer"
4. **Do NOT trigger intervention** (user not in Instagram)

**When User Returns to Instagram:**
- Check `t_intention` → 0 (was deleted)
- Evaluate nested logic
- May show Quick Task dialog or start intervention

---

## Summary Table

| Scenario | t_intention | t_quickTask | n_quickTask | Result |
|----------|-------------|-------------|-------------|--------|
| 1. First Launch | 0 | 0 | 1 | Show Quick Task dialog |
| 2. Valid Intention | 120s | 0 | 1 | SUPPRESS |
| 3. Expired Intention (in-app) | 0 (expired) | 0 | 0 | START INTERVENTION |
| 4. Active Quick Task | 0 | 180s | 0 | SUPPRESS |
| 5. QT Dialog → Activate | 0 | 0 → 180s | 1 → 0 | Launch app |
| 6. QT Dialog → Continue | 0 | 0 | 1 | START INTERVENTION |
| 7. Quick Task Expires | 0 (reset) | 0 (expired) | 0 | Show expired screen |
| 8. Per-App (Instagram) | 120s | 0 | 1 | SUPPRESS |
| 8. Per-App (TikTok) | 0 | 0 | 1 | Show Quick Task dialog |
| 9. Global Quota (Instagram) | 0 | 0 → 180s | 1 → 0 | Launch app |
| 9. Global Quota (TikTok) | 0 | 0 | 0 | START INTERVENTION |
| 10. Heartbeat | 0 | 0 | 1 | Skip (no action) |
| 11. Background Expiry | 0 (deleted) | 0 | 1 | Delete timer only |

---

## Testing Checklist

- [ ] First launch shows Quick Task dialog
- [ ] Valid `t_intention` suppresses intervention
- [ ] Expired `t_intention` (in-app) triggers intervention
- [ ] Active `t_quickTask` suppresses intervention
- [ ] Quick Task activation works correctly
- [ ] Quick Task "Continue" starts intervention
- [ ] Quick Task expiry shows expired screen and resets `t_intention`
- [ ] Per-app independence (Instagram timer doesn't affect TikTok)
- [ ] Global `n_quickTask` (using on Instagram affects TikTok)
- [ ] Heartbeat events are skipped
- [ ] Background timer expiry only deletes timer (no intervention)

---

## Related Documentation

- `Trigger_logic_priority.md` - Priority chain documentation
- `OS_TRIGGER_LOGIC_REFACTOR_SUMMARY.md` - Implementation changes
- `NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
