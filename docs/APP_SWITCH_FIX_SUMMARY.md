# App Switch Intervention Fix - Summary

## Problem

When switching from one monitored app (Instagram) to another (TikTok) during an active intervention, the intervention state was NOT reset. This caused:

- Wrong app name displayed in intervention UI
- Root cause selections from Instagram carried over to TikTok
- Confusing mixed state between different apps

## Solution

**Three-layer fix:**

1. **Intervention State Machine** (`src/core/intervention/transitions.js`)
   - `BEGIN_INTERVENTION` now always resets intervention state
   - Clears `selectedCauses`, `selectedAlternative`, `actionTimer`
   - Updates `targetApp` to new app

2. **Navigation Handler** (`app/App.tsx`)
   - Now watches both `state` AND `targetApp` for changes
   - Detects app switches and forces navigation to Breathing screen
   - Ensures user always starts from beginning for new app

3. **OS Trigger Brain** (`src/os/osTriggerBrain.ts`)
   - `triggerIntervention()` now clears ALL in-progress interventions before starting new one
   - Ensures only ONE app can have active intervention at a time

## Result

✅ Each monitored app gets its own independent intervention flow  
✅ No state mixing between apps  
✅ Correct app name displayed in UI  
✅ Navigation always resets to breathing screen on app switch  
✅ Clean user experience when switching apps

## Files Changed

- `src/core/intervention/transitions.js` - State machine reset logic
- `app/App.tsx` - Navigation handler watches state AND targetApp
- `src/os/osTriggerBrain.ts` - In-progress intervention tracking
- `docs/APP_SWITCH_INTERVENTION_FIX.md` - Detailed documentation
- `docs/TEST_APP_SWITCH_INTERVENTION.md` - Test plan

## Testing

See `docs/TEST_APP_SWITCH_INTERVENTION.md` for complete test plan.

**Quick Test:**
1. Open Instagram → Intervention starts
2. Select "Boredom" as root cause
3. Switch to TikTok (without continuing)
4. Verify: TikTok intervention starts fresh with NO selected causes

## Log Verification

When switching apps, you should see:

```
[OS Trigger Brain] Clearing previous intervention(s) for app switch {
  oldApps: ['com.instagram.android'],
  newApp: 'com.zhiliaoapp.musically'
}
```

## Date

December 29, 2024

