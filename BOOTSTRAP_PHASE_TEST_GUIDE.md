# Bootstrap Phase Fix - Test Guide

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
   - Close BreakLoop app
   - Open Instagram
   - **Expected:** Breathing screen appears (intervention UI)
   - **Bug (before fix):** Home screen appears immediately

## What to Look For

### ✅ Success Indicators

1. **No home screen flash** - SystemSurfaceActivity doesn't finish immediately
2. **Breathing screen appears** - InterventionFlow renders correctly
3. **Smooth transition** - No UI flicker or jarring experience

### ❌ Failure Indicators

1. **Home screen appears** - Activity finished prematurely
2. **Black screen** - React Native didn't load
3. **App crash** - Check logs for errors

## Log Analysis

### Expected Log Sequence

```
[OS Trigger Brain] Monitored app entered foreground: com.instagram.android
[OS Trigger Brain] → START INTERVENTION FLOW
[SystemSession] dispatchSystemEvent: { type: 'START_INTERVENTION', app: 'com.instagram.android' }
[SystemSurfaceRoot] Bootstrap phase - waiting for session establishment
[SystemSession] Starting INTERVENTION session for app: com.instagram.android
[SystemSession] Bootstrap phase complete - session established
[SystemSurfaceRoot] Rendering InterventionFlow for app: com.instagram.android
```

### Bug Pattern (Before Fix)

```
[SystemSurfaceRoot] Rendering null (no session)
[SystemSurfaceRoot] Session is null - finishing SystemSurfaceActivity
[SystemSession] dispatchSystemEvent: { type: 'START_INTERVENTION', ... } (TOO LATE)
```

## Detailed Test Scenarios

### Scenario 1: Cold Start Intervention

**Steps:**
1. Force stop BreakLoop app
2. Open Instagram
3. Verify breathing screen appears

**Expected:**
- SystemSurfaceActivity launches
- Bootstrap phase (brief, no UI)
- Breathing screen appears
- Countdown starts

### Scenario 2: Quick Task Flow

**Steps:**
1. Open Instagram
2. Choose "Quick Task" from dialog
3. Use Instagram for duration
4. Wait for Quick Task to expire

**Expected:**
- Quick Task dialog appears
- After expiration, intervention starts
- No home screen flash

### Scenario 3: Intention Timer

**Steps:**
1. Open Instagram
2. Complete intervention
3. Set intention timer (e.g., 5 minutes)
4. Close Instagram
5. Open Instagram again within 5 minutes

**Expected:**
- Instagram opens normally (no intervention)
- No SystemSurfaceActivity launch

### Scenario 4: Multiple Monitored Apps

**Steps:**
1. Add Instagram and TikTok to monitored apps
2. Open Instagram → Complete intervention
3. Open TikTok → Verify intervention appears

**Expected:**
- Each app gets independent intervention
- No cross-app interference

## Debugging Tips

### Check Bootstrap State

Add temporary logging in SystemSurfaceRoot:

```typescript
console.log('[DEBUG] Bootstrap:', bootstrapState, 'Session:', session);
```

### Check Session Events

Add temporary logging in OS Trigger Brain:

```typescript
console.log('[DEBUG] Dispatching START_INTERVENTION for:', packageName);
```

### Check Activity Lifecycle

Monitor native logs:

```bash
adb logcat | grep "SystemSurfaceActivity"
```

Look for:
- `SystemSurfaceActivity created`
- `SystemSurfaceActivity destroyed` (should NOT appear immediately)

## Performance Verification

### Bootstrap Duration

The bootstrap phase should be **very brief** (< 100ms):
- React Native is already initialized
- OS Trigger Brain runs immediately
- Session event dispatches synchronously

If bootstrap takes > 500ms, investigate:
- React Native initialization issues
- OS Trigger Brain not running
- Event listener not connected

## Rollback Plan

If the fix causes issues:

1. **Revert changes:**
   ```bash
   git checkout HEAD~1 -- src/contexts/SystemSessionProvider.tsx
   git checkout HEAD~1 -- app/roots/SystemSurfaceRoot.tsx
   ```

2. **Rebuild:**
   ```bash
   npm run android
   ```

3. **Report issue** with logs and reproduction steps

## Success Criteria

- ✅ SystemSurfaceActivity no longer finishes immediately
- ✅ Intervention UI appears correctly
- ✅ No home screen flash
- ✅ Bootstrap phase is imperceptible to user
- ✅ All existing flows work (Quick Task, Alternative Activity)
- ✅ No performance regression

## Next Steps After Testing

1. **Verify on multiple devices** (different Android versions)
2. **Test edge cases** (low memory, slow device, etc.)
3. **Monitor crash reports** (if any)
4. **Update documentation** if needed
5. **Consider adding telemetry** for bootstrap duration
