# OS Trigger Brain - Step 5E Implementation Summary

## What Was Implemented

**Step 5E: Intention Timer Semantics (OS Trigger Contract v1.1)**

### Core Changes

1. **Added Per-App Intention Timer State**
   - `intentionTimers: Map<string, { expiresAt: number }>`
   - Stores t_monitored (intention timer) for each monitored app independently
   - Timers persist in memory across app exits

2. **Intention Timer Decision Logic** (in `handleForegroundAppChange`)
   
   **Priority 1: Check Intention Expiration (FIRST)**
   - If intention timer exists AND has expired:
     - Log "Intention timer expired — intervention required"
     - Return early (intervention takes precedence)
     - Will trigger intervention immediately

   **Priority 2: Check App Switch Interval**
   - If `timeSinceExit < intervalMs`:
     - Log "Re-entry within app switch interval — no intervention"
     - If intention timer exists: Log "Existing intention timer remains valid"
     - **Key**: Intention timer is NOT cleared or invalidated
   
   - If `timeSinceExit >= intervalMs` OR no previous exit:
     - Log "App switch interval elapsed — intervention eligible"
     - If intention timer exists: Log "Existing intention timer will be overwritten"
     - **Key**: New intervention will replace old intention

3. **New Public Functions**
   - `setIntentionTimer(packageName, durationMs, currentTimestamp)` - Set timer after user completes intervention
   - `getIntentionTimer(packageName)` - Get timer for debugging/testing
   - `checkBackgroundIntentionExpiration(currentTimestamp)` - Detect expiration for background apps

4. **Background Expiration Detection**
   - `checkBackgroundIntentionExpiration()` checks all apps NOT in foreground
   - Logs when background timer expires
   - Timer remains in map (will trigger intervention on next entry)

### How It Matches the Contract

✅ **Rule 1**: Leaving a monitored app does NOT invalidate t_monitored
   - Implementation: No code clears intention timers on exit

✅ **Rule 2**: t_monitored remains valid across app switches, brief exits, and re-entry
   - Implementation: Timers persist in Map, checked on re-entry

✅ **Rule 3**: New intervention triggered ONLY when monitored app enters AND t_appSwitchInterval elapsed
   - Implementation: App switch interval check (lines 93-144)

✅ **Rule 4**: New intervention overwrites existing t_monitored
   - Implementation: Logged at line 124-128, will happen when setIntentionTimer() called

✅ **Rule 5**: If t_appSwitchInterval NOT elapsed, existing t_monitored remains valid
   - Implementation: Lines 106-113 explicitly log timer remains valid

✅ **Rule 6**: If t_monitored expires:
   - Foreground: intervention triggers immediately (lines 77-86, early return)
   - Background: intervention triggers on next entry (checkBackgroundIntentionExpiration)

✅ **Rule 7**: t_appSwitchInterval decides when new conscious decision required
   - Implementation: Primary decision logic (lines 89-144)

✅ **Rule 8**: t_monitored decides how long last conscious decision remains valid
   - Implementation: Expiration check at lines 75-87

### Decision Flow

```
Monitored App Enters Foreground
  ↓
Check: Intention Timer Expired?
  YES → Log "expired — intervention required" → RETURN (trigger intervention)
  NO  → Continue
  ↓
Check: Last Exit Timestamp Exists?
  NO  → Log "no previous exit — intervention eligible" (first launch)
  YES → Continue
  ↓
Check: Time Since Exit < App Switch Interval?
  YES → Log "Re-entry within interval — no intervention"
        IF intention exists: Log "remains valid"
  NO  → Log "App switch interval elapsed — intervention eligible"
        IF intention exists: Log "will be overwritten"
```

### Logs Added

**Intention Expiration:**
- `[OS Trigger Brain] Intention timer expired — intervention required`
- `[OS Trigger Brain] Background intention timer expired — intervention on next entry`

**Intention Preservation:**
- `[OS Trigger Brain] Existing intention timer remains valid`

**Intention Overwrite:**
- `[OS Trigger Brain] Existing intention timer will be overwritten by new intervention`

**Intention Set:**
- `[OS Trigger Brain] Intention timer set`

### Testing Scenarios

**Scenario 1: Quick Re-entry (within 5 min)**
1. Open Instagram → intervention
2. Set intention timer (e.g., 30 min)
3. Exit Instagram
4. Re-open Instagram within 5 min → "no intervention", "intention remains valid"

**Scenario 2: Slow Re-entry (after 5 min)**
1. Open Instagram → intervention
2. Set intention timer (e.g., 30 min)
3. Exit Instagram
4. Wait 6 minutes
5. Re-open Instagram → "intervention eligible", "intention will be overwritten"

**Scenario 3: Intention Expires While In App**
1. Open Instagram → intervention
2. Set intention timer (e.g., 2 min)
3. Stay in Instagram for 3 min → "intention expired — intervention required"

**Scenario 4: Intention Expires While Out**
1. Open Instagram → intervention
2. Set intention timer (e.g., 2 min)
3. Exit Instagram
4. Wait 3 minutes (background check) → "background intention expired"
5. Re-open Instagram → "intention expired — intervention required"

### Next Steps

- **Step 5F**: Wire `BEGIN_INTERVENTION` dispatch at TODO markers
- **Step 5G**: Wire `setIntentionTimer()` when user completes intervention flow
- **Step 5H**: Set up periodic `checkBackgroundIntentionExpiration()` calls

---

*Implemented: December 27, 2025*
*Contract: OS Trigger Contract v1.1*

