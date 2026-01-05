# Context Mismatch Fix - Test Guide

## Quick Test

1. **Build and install** the app:
   ```bash
   npm run android
   ```

2. **Enable Accessibility Service**:
   - Open Android Settings → Accessibility
   - Enable "BreakLoop Foreground Detection"

3. **Add Instagram to monitored apps**:
   - Open BreakLoop app
   - Go to Settings → Monitored Apps
   - Add Instagram (com.instagram.android)

4. **Test the fix**:
   - Close BreakLoop app completely
   - Open Instagram
   - **Expected:** Breathing screen appears (intervention UI)
   - **Bug (before fix):** Instagram hangs with no UI

## Expected Log Sequence

When you open Instagram, you should see:

```
[RuntimeContext] Detected context: SYSTEM_SURFACE
[App] Rendering for runtime context: SYSTEM_SURFACE
[App] ✅ Connected OS Trigger Brain to SystemSession dispatcher (SYSTEM_SURFACE context)
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: {"triggeringApp":"com.instagram.android","wakeReason":"MONITORED_APP_FOREGROUND"}
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] Monitored app entered foreground: {"packageName":"com.instagram.android",...}
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] dispatchSystemEvent: {"type":"START_INTERVENTION","app":"com.instagram.android"}
[SystemSession] Starting INTERVENTION session for app: com.instagram.android
[SystemSession] Bootstrap phase complete - session established
[SystemSurfaceRoot] ✅ Bootstrap initialization complete
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

## Key Indicators

### ✅ Success
- Log shows `SYSTEM_SURFACE` context detected
- Log shows "Connected OS Trigger Brain (SYSTEM_SURFACE context)"
- Log shows "Bootstrap initialization starting"
- Log shows "Intent extras" with Instagram package name
- Log shows "Running OS Trigger Brain in SystemSurface context"
- Log shows "Bootstrap phase complete - session established"
- Breathing screen appears
- No hang, no home screen flash

### ❌ Failure (Old Bug)
- Log shows `START_INTERVENTION` dispatched in MAIN_APP context
- Log shows "Bootstrap phase - waiting for session establishment" (repeats forever)
- Instagram hangs with no UI
- Home screen may appear

## Comparison: Before vs After

### Before Fix (Context Mismatch)

```
[App] Rendering for runtime context: MAIN_APP
[App] Connected OS Trigger Brain to SystemSession dispatcher
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] Starting INTERVENTION session for app: com.instagram.android  ← WRONG CONTEXT
[RuntimeContext] Detected context: SYSTEM_SURFACE
[App] Rendering for runtime context: SYSTEM_SURFACE
[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment  ← STUCK HERE
[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment
[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment
... (repeats forever)
```

### After Fix (Correct Context)

```
[RuntimeContext] Detected context: SYSTEM_SURFACE
[App] Rendering for runtime context: SYSTEM_SURFACE
[App] ✅ Connected OS Trigger Brain (SYSTEM_SURFACE context)  ← CORRECT CONTEXT
[SystemSurfaceRoot] 🚀 Bootstrap initialization starting...
[SystemSurfaceRoot] 📋 Intent extras: {triggeringApp, wakeReason}
[SystemSurfaceRoot] 🧠 Running OS Trigger Brain in SystemSurface context...
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] Starting INTERVENTION session  ← CORRECT CONTEXT
[SystemSession] Bootstrap phase complete - session established  ← SUCCESS
[SystemSurfaceRoot] Rendering InterventionFlow  ← UI APPEARS
```

## Troubleshooting

### Issue: Still hangs with no UI

**Check:**
1. Verify native method was added: `getSystemSurfaceIntentExtras()`
2. Check logs for "Bootstrap initialization starting"
3. Check logs for "Intent extras"
4. If Intent extras are null, native layer may not be passing them correctly

### Issue: Home screen appears immediately

**Check:**
1. Verify bootstrap phase is working (log shows "Bootstrap phase - waiting")
2. Check if bootstrap initialization completes
3. Check if session is created after bootstrap

### Issue: Error "getSystemSurfaceIntentExtras is not a function"

**Fix:**
1. Rebuild the app: `npm run android`
2. Kotlin changes require full rebuild

## Advanced Testing

### Test Multiple Apps

1. Add Instagram and TikTok to monitored apps
2. Open Instagram → Verify intervention appears
3. Complete or dismiss intervention
4. Open TikTok → Verify intervention appears
5. Each app should get independent intervention

### Test Quick Task Flow

1. Open Instagram
2. Choose "Quick Task" from dialog
3. Use Instagram for duration
4. Wait for Quick Task to expire
5. Verify intervention starts after expiration

### Test Intention Timer

1. Open Instagram
2. Complete intervention
3. Set intention timer (e.g., 5 minutes)
4. Close Instagram
5. Open Instagram again within 5 minutes
6. Verify Instagram opens normally (no intervention)

## Performance Check

Bootstrap initialization should be **very fast** (< 100ms):
- React Native is already initialized
- Reading Intent extras is synchronous
- OS Trigger Brain runs immediately

If bootstrap takes > 500ms, investigate:
- React Native initialization issues
- Native module communication delays
- OS Trigger Brain performance

## Success Criteria

- ✅ SystemSurfaceActivity no longer hangs
- ✅ Intervention UI appears correctly
- ✅ No home screen flash
- ✅ Session created in correct context
- ✅ Bootstrap completes in < 100ms
- ✅ All existing flows work (Quick Task, Alternative Activity)

## Next Steps

After successful testing:
1. Test on multiple devices (different Android versions)
2. Test edge cases (low memory, slow device)
3. Monitor crash reports
4. Update documentation if needed
5. Consider adding telemetry for bootstrap duration
