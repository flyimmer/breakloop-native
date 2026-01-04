# OS Trigger Logic Test Scenarios

This document provides comprehensive test scenarios to validate the OS Trigger Brain implementation against the OS Trigger Contract specification.

## Test Setup

**Monitored Apps:** Instagram, TikTok
**Configuration:**
- `t_appSwitchInterval`: 5 minutes (300 seconds)
- `t_intention`: 2 minutes (120 seconds) when set
- `t_quickTask`: 3 minutes (180 seconds) when activated
- `n_quickTask`: 1 use per 15-minute window

---

## Scenario 1: First Launch (No Previous State)

**Setup:**
- User has never opened Instagram before
- No timers exist

**Steps:**
1. User opens Instagram

**Expected Behavior:**
- ✓ t_appSwitchInterval: No previous exit → treat as elapsed
- ✓ Intervention flow starts immediately
- ✓ t_intention deleted (none existed)
- ✓ User sees breathing screen

**Validation:**
```
[OS Trigger Brain] First entry for this app (no previous exit)
[OS Trigger Brain] ✓ t_appSwitchInterval ELAPSED (HIGHEST PRIORITY)
[OS Trigger Brain] → START INTERVENTION (app switch interval elapsed)
[OS Trigger Brain] t_intention deleted (intervention starting)
[OS Trigger Brain] BEGIN_INTERVENTION dispatched
```

---

## Scenario 2: Re-entry Within t_appSwitchInterval

**Setup:**
- User opens Instagram → intervention → sets t_intention (2 min)
- User exits Instagram after 30 seconds
- User re-opens Instagram after 1 minute (within 5-minute interval)

**Steps:**
1. User opens Instagram (1 minute after exit)

**Expected Behavior:**
- ✗ t_appSwitchInterval: NOT elapsed (1 min < 5 min)
- → Apply nested logic
- ✓ t_intention VALID (still has 90 seconds remaining)
- → SUPPRESS everything
- User can use Instagram freely

**Validation:**
```
[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✓ t_intention VALID (per-app)
[OS Trigger Brain] → SUPPRESS EVERYTHING
[OS Trigger Brain] → Remaining: 90s
```

---

## Scenario 3: Re-entry After t_appSwitchInterval Elapsed

**Setup:**
- User opens Instagram → intervention → sets t_intention (2 min)
- User exits Instagram
- User re-opens Instagram after 6 minutes (> 5-minute interval)

**Steps:**
1. User opens Instagram (6 minutes after exit)

**Expected Behavior:**
- ✓ t_appSwitchInterval ELAPSED (6 min > 5 min)
- → START INTERVENTION immediately (bypass nested logic)
- ✓ t_intention deleted (even though it already expired)
- User sees breathing screen

**Validation:**
```
[OS Trigger Brain] ✓ t_appSwitchInterval ELAPSED (HIGHEST PRIORITY)
[OS Trigger Brain] → START INTERVENTION (app switch interval elapsed)
[OS Trigger Brain] t_intention deleted (intervention starting)
[OS Trigger Brain] BEGIN_INTERVENTION dispatched
```

**Key Point:** t_appSwitchInterval has HIGHER priority than t_intention. Even if t_intention was still valid, intervention would start.

---

## Scenario 4: Quick Task Available (n_quickTask > 0)

**Setup:**
- User opens Instagram (first time or after interval elapsed)
- No t_intention exists
- n_quickTask = 1 (one use remaining)
- No active t_quickTask timer

**Steps:**
1. User opens Instagram

**Expected Behavior:**
- ✓ t_appSwitchInterval ELAPSED (or first entry)
- → START INTERVENTION
- Wait, this is wrong! Let me re-read the spec...

Actually, when t_appSwitchInterval elapsed, intervention starts DIRECTLY. The nested logic (including Quick Task dialog) is only evaluated when t_appSwitchInterval is NOT elapsed.

Let me correct this scenario:

**Corrected Setup:**
- User opens Instagram
- User exits after 30 seconds
- User re-opens Instagram after 1 minute (within 5-minute interval)
- No t_intention exists (expired or never set)
- n_quickTask = 1 (one use remaining)
- No active t_quickTask timer

**Steps:**
1. User opens Instagram (1 minute after exit)

**Expected Behavior:**
- ✗ t_appSwitchInterval NOT elapsed (1 min < 5 min)
- → Apply nested logic
- ✗ t_intention = 0 (expired or not set)
- ✓ n_quickTask != 0 (1 use remaining)
- ✗ t_quickTask = 0 (no active timer)
- → SHOW QUICK TASK DIALOG
- User sees Quick Task dialog with "Use Quick Task" option

**Validation:**
```
[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✓ n_quickTask != 0 (uses remaining: 1)
[OS Trigger Brain] ✗ t_quickTask = 0 (no active timer)
[OS Trigger Brain] → SHOW QUICK TASK DIALOG
```

---

## Scenario 5: Quick Task Active (t_quickTask != 0)

**Setup:**
- User opens Instagram
- User activates Quick Task (3-minute timer starts)
- User exits Instagram
- User re-opens Instagram after 1 minute (within Quick Task window)

**Steps:**
1. User opens Instagram (1 minute after activating Quick Task)

**Expected Behavior:**
- ✗ t_appSwitchInterval NOT elapsed
- → Apply nested logic
- ✗ t_intention = 0 (Quick Task doesn't create t_intention)
- ✓ n_quickTask = 0 (usage consumed)
- Wait, this is wrong too. Let me reconsider...

Actually, n_quickTask is the REMAINING uses. After using Quick Task once, n_quickTask becomes 0 (no uses left). But t_quickTask timer is still active.

**Corrected Expected Behavior:**
- ✗ t_appSwitchInterval NOT elapsed
- → Apply nested logic
- ✗ t_intention = 0
- Check n_quickTask... wait, the spec says check n_quickTask first, then t_quickTask.

Let me re-read the nested logic from Screenshot 3:

```
if t_intention = 0:
  if n_quickTask != 0:
    if t_quickTask != 0: suppress
    else: show Quick Task dialog
  else: start intervention
```

So when n_quickTask = 0 (no uses remaining), we go straight to intervention, EVEN IF t_quickTask is active!

This seems wrong. Let me check the spec again...

Actually, looking at the spec in Screenshot 2:
- "During t_quickTask: User may freely switch apps and return to monitored apps. No intervention process shall start."

This suggests t_quickTask should suppress intervention regardless of n_quickTask.

But Screenshot 3 shows the nested logic where n_quickTask is checked BEFORE t_quickTask.

**I need clarification from the user on this edge case:**
- When user has used all Quick Task quota (n_quickTask = 0), but t_quickTask timer is still active, what should happen?
  - Option A: t_quickTask suppresses intervention (user can still use the app)
  - Option B: Intervention starts (n_quickTask = 0 takes priority)

For now, I'll implement according to Screenshot 3 (nested logic), which means Option B.

**Expected Behavior (per Screenshot 3 nested logic):**
- ✗ t_appSwitchInterval NOT elapsed
- → Apply nested logic
- ✗ t_intention = 0
- ✗ n_quickTask = 0 (no uses remaining)
- → START INTERVENTION
- User sees breathing screen (even though t_quickTask is active)

**Validation:**
```
[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✗ n_quickTask = 0 (no uses remaining)
[OS Trigger Brain] → START INTERVENTION FLOW
```

---

## Scenario 6: Quick Task Active with Remaining Uses

**Setup:**
- User has n_quickTask = 2 (two uses remaining, premium user)
- User opens Instagram, activates Quick Task
- User exits Instagram
- User re-opens Instagram after 1 minute (within Quick Task window)

**Steps:**
1. User opens Instagram (1 minute after activating Quick Task)

**Expected Behavior:**
- ✗ t_appSwitchInterval NOT elapsed
- → Apply nested logic
- ✗ t_intention = 0
- ✓ n_quickTask != 0 (1 use remaining after first use)
- ✓ t_quickTask ACTIVE (2 minutes remaining)
- → SUPPRESS EVERYTHING
- User can use Instagram freely

**Validation:**
```
[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✓ n_quickTask != 0 (uses remaining: 1)
[OS Trigger Brain] ✓ t_quickTask ACTIVE (per-app)
[OS Trigger Brain] → SUPPRESS EVERYTHING
[OS Trigger Brain] → Remaining: 120s
```

---

## Scenario 7: Per-App Isolation (Instagram vs TikTok)

**Setup:**
- User opens Instagram → sets t_intention (2 min)
- User switches to TikTok (also monitored)

**Steps:**
1. User switches to TikTok

**Expected Behavior:**
- TikTok has NO t_intention (independent from Instagram)
- Check TikTok's t_appSwitchInterval (independent from Instagram)
- If TikTok's interval elapsed → intervention starts for TikTok
- Instagram's t_intention does NOT affect TikTok

**Validation:**
```
[OS Trigger Brain] Monitored app entered foreground: TikTok
[OS Trigger Brain] ✓ t_appSwitchInterval ELAPSED (first entry for TikTok)
[OS Trigger Brain] → START INTERVENTION (app switch interval elapsed)
[OS Trigger Brain] BEGIN_INTERVENTION dispatched for TikTok
```

**Key Point:** Each app is treated individually. Instagram's t_intention does not suppress TikTok's intervention.

---

## Scenario 8: t_intention Expires While User Is In App

**Setup:**
- User opens Instagram → sets t_intention (2 min)
- User stays in Instagram for 3 minutes (t_intention expires while in app)

**Steps:**
1. Periodic timer check detects t_intention expired for foreground app

**Expected Behavior:**
- t_intention deleted
- Re-evaluate using nested logic (evaluateTriggerLogic)
- Check n_quickTask, t_quickTask, etc.
- Likely outcome: intervention starts (unless Quick Task available)

**Validation:**
```
[OS Trigger Brain] Intention timer expired for FOREGROUND app — re-evaluating logic
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✗ t_intention = 0 (expired or not set)
[OS Trigger Brain] ✗ n_quickTask = 0 (no uses remaining)
[OS Trigger Brain] → START INTERVENTION FLOW
```

---

## Scenario 9: Quick Task Expires

**Setup:**
- User activates Quick Task on Instagram (3-minute timer)
- User stays in Instagram for 4 minutes (Quick Task expires)

**Steps:**
1. Quick Task timer expires
2. System shows "QuickTaskExpiredScreen"
3. User dismisses screen and returns to home
4. User opens Instagram again

**Expected Behavior (on re-opening Instagram):**
- t_appSwitchInterval reset to 0 (per spec: "When t_quickTask expires, t_appSwitchInterval is reset to 0")
- t_intention reset to 0 (per spec)
- Check if this is first entry or interval elapsed
- Likely outcome: intervention starts or Quick Task dialog (if n_quickTask allows)

**Validation:**
```
[OS Trigger Brain] First entry for this app (no previous exit)
[OS Trigger Brain] ✓ t_appSwitchInterval ELAPSED (HIGHEST PRIORITY)
[OS Trigger Brain] → START INTERVENTION (app switch interval elapsed)
```

---

## Scenario 10: Global n_quickTask Across Apps

**Setup:**
- User has n_quickTask = 1 (one use remaining)
- User opens Instagram, uses Quick Task
- User exits Instagram
- User opens TikTok (different monitored app)

**Steps:**
1. User opens TikTok (within t_appSwitchInterval)

**Expected Behavior:**
- TikTok checks n_quickTask (GLOBAL)
- n_quickTask = 0 (already used on Instagram)
- → START INTERVENTION (no Quick Task dialog for TikTok)

**Validation:**
```
[OS Trigger Brain] ✗ t_appSwitchInterval NOT elapsed
[OS Trigger Brain] Evaluating nested trigger logic
[OS Trigger Brain] ✗ t_intention = 0
[OS Trigger Brain] ✗ n_quickTask = 0 (no uses remaining)
[OS Trigger Brain] → START INTERVENTION FLOW
```

**Key Point:** n_quickTask is GLOBAL across all monitored apps. Using Quick Task on Instagram consumes quota for TikTok too.

---

## Edge Cases to Test

### Edge Case 1: Heartbeat Events
- User stays in Instagram (no app switch)
- Periodic foreground events fire
- Expected: Skip all logic (no intervention, no dialog)

### Edge Case 2: Launcher Bounces
- User switches from Instagram to TikTok via launcher
- Launcher briefly gains focus
- Expected: Launcher ignored, direct switch from Instagram to TikTok

### Edge Case 3: Cross-App Intervention Blocking
- User opens Instagram → intervention starts (breathing screen)
- User switches to TikTok (also monitored)
- Expected: TikTok intervention BLOCKED (Instagram intervention in progress)
- User must complete Instagram intervention first

### Edge Case 4: t_intention Expires in Background
- User opens Instagram → sets t_intention (2 min)
- User switches to non-monitored app (Chrome)
- 3 minutes pass (t_intention expires while Instagram in background)
- User returns to Instagram
- Expected: t_intention deleted, intervention logic re-evaluated

---

## Summary of Priority Rules

**When monitored app enters foreground:**

1. **Skip heartbeat events** (same app, no actual switch)

2. **Check t_appSwitchInterval (HIGHEST PRIORITY)**
   - If ELAPSED → START INTERVENTION directly (bypass nested logic)
   - If NOT elapsed → Apply nested logic below

3. **Nested Logic (only when t_appSwitchInterval NOT elapsed):**
   - Check t_intention
     - If VALID → SUPPRESS
   - If t_intention = 0:
     - Check n_quickTask
       - If != 0:
         - Check t_quickTask
           - If ACTIVE → SUPPRESS
           - If = 0 → SHOW QUICK TASK DIALOG
       - If = 0 → START INTERVENTION

**Key Principles:**
- t_appSwitchInterval has HIGHER priority than t_intention
- Each app is treated individually (per-app timers)
- n_quickTask is GLOBAL across all apps
- When intervention starts, t_intention is deleted
