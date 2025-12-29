# Intention Timer - Current Status

## Summary

The intention timer (`t_intention`) is now working correctly based on console logs. When a user selects a duration (e.g., "Just 1 min"), the timer is set and the user can use the monitored app for that duration.

## Evidence from Console Logs

```
[OS Trigger Brain] Intention timer set { durationSec: '60s', expiresAt: 1767011251838, expiresAtTime: '2025-12-29T12:27:31.838Z' }
[OS Trigger Brain] Intervention completed
[F3.5] Intervention complete (state → idle), finishing InterventionActivity

[OS Trigger Brain] Monitored app entered foreground: { packageName: 'com.instagram.android' }
[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '42s remaining' }

... (timer counts down)

[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '40s remaining' }
[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '38s remaining' }
[OS Trigger Brain] Valid intention timer exists — allowing app usage { remainingSec: '37s remaining' }
```

**Analysis:**
- Timer is set correctly (expires at 12:27:31)
- User is released to Instagram
- Timer is checked and found valid
- App usage is allowed
- Timer counts down properly (42s → 40s → 38s → 37s)

## Implementation Details

### Timer Check Logic (OS Trigger Brain)

When a monitored app enters foreground, the following checks happen in order:

1. **Expired timer check**: If `t_intention` exists and has expired → Trigger intervention
2. **Valid timer check**: If `t_intention` exists and is still valid → Allow app usage, no intervention ✅
3. **Heartbeat check**: If same app (heartbeat event) → Skip interval logic
4. **App switch interval check**: If no timer exists → Check `t_appSwitchInterval` logic

### Terminology Updates

All references to `t_monitored` have been updated to `t_intention` to match the OS Trigger Contract specification:

- `t_intention`: Timer set by user during intervention flow for how long they want to use the app
- `t_appSwitchInterval`: Setting that determines when a new conscious decision is required (restarts every time user closes/switches from app)

### Log Spam Reduction

The valid timer check now only logs on **actual entry** (not heartbeat events) to reduce log spam. Previously, it was logging multiple times per second as the OS sent many foreground change events.

## User Experience

### Expected Flow

```
1. User opens Instagram
2. Breathing screen (5 seconds)
3. Root Cause screen → "I really need to use it"
4. Intention Timer screen → User selects "Just 1 min"
5. Timer set: expires in 60 seconds
6. Intervention completes → User released to Instagram
7. User can use Instagram for 60 seconds ✅
8. Timer expires
9. Next Instagram entry → Intervention triggers
```

### What User Should See

- After selecting a duration, the intervention screen should close
- Instagram (or monitored app) should open and be usable
- No intervention should appear during the timer period
- After timer expires, opening the app again triggers a new intervention

## Potential Confusion

If the user reports "the monitored app starts immediately again," this could mean:

1. **The app opens (correct behavior)**: After selecting a timer, the monitored app SHOULD open - this is the expected behavior
2. **Intervention appears again (bug)**: If the intervention screen (breathing/root cause) appears immediately after selecting a timer, this would be a bug

Based on the console logs, the timer logic is working correctly. The intervention is NOT triggering during the timer period.

## Next Steps

If there's still an issue, we need to clarify:

1. What exactly does "starts immediately again" mean?
   - Does the intervention screen appear?
   - Or does the monitored app just open (which is correct)?

2. When does this happen?
   - Immediately after selecting a duration?
   - After the timer expires?
   - At some other time?

3. What do the console logs show?
   - Are there "BEGIN_INTERVENTION" logs when there shouldn't be?
   - Or only "Valid intention timer exists" logs (which is correct)?

## Files Modified

- `src/os/osTriggerBrain.ts`:
  - Updated terminology: `t_monitored` → `t_intention`
  - Reduced log spam: Only log on actual entry, not heartbeat
  - Timer logic working correctly

## Date

December 29, 2025

