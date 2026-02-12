# UX Issues Template

Use this template to log UX issues discovered during testing or reported by users.

---

## Issue Template

```markdown
### [Issue Title]

**Flow Location**: [Which flow/screen is affected]

**Reproduction Steps**:
1. [First step]
2. [Second step]
3. [Third step]
...

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Severity**: [Critical / High / Medium / Low]
- **Critical**: Blocks core functionality, no workaround
- **High**: Major impact on UX, workaround exists
- **Medium**: Noticeable but minor impact
- **Low**: Cosmetic or edge case

**Frequency**: [Always / Often / Sometimes / Rare]
- **Always**: 100% reproduction rate
- **Often**: > 50% reproduction rate
- **Sometimes**: 10-50% reproduction rate
- **Rare**: < 10% reproduction rate

**Evidence**:
- Logs: [Relevant logcat output or file path]
- Screenshots: [Path to screenshot or description]
- Video: [Path to screen recording or description]
- Device: [Device model and Android version]

**Related Code**:
- File: [Path to relevant file]
- Function: [Function or component name]
- Line: [Approximate line number]

**Proposed Fix**:
[Optional: Suggested solution or investigation direction]

**Notes**:
[Any additional context or observations]
```

---

## Example Issues

### Example 1: Quick Task Dialog Not Showing

**Flow Location**: Quick Task Flow → QuickTaskDialogScreen

**Reproduction Steps**:
1. Set monitored apps to include Instagram
2. Ensure quota > 0
3. Open Instagram from home screen
4. Observe no dialog appears

**Expected Behavior**:
QuickTaskDialogScreen should appear within 500ms of app opening

**Actual Behavior**:
No dialog appears, user proceeds directly to Instagram

**Severity**: Critical

**Frequency**: Sometimes

**Evidence**:
- Logs: `c:\Dev\BreakLoop\BreakLoop-Native\current_logs.txt`
- Relevant tags: `DECISION_GATE`, `QT_STATE`, `SS_BOOT`
- Device: Pixel 6, Android 13

**Related Code**:
- File: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
- Function: `handleMonitoredAppEntry`
- Line: ~1800

**Proposed Fix**:
Check if `isSystemSurfaceActive` flag is stuck in `true` state. Investigate watchdog recovery logic.

**Notes**:
Issue seems to occur after SystemSurface was previously force-closed by watchdog.

---

### Example 2: Post-QT Choice Shows After Switching Apps

**Flow Location**: Quick Task Flow → PostQuickTaskChoiceScreen

**Reproduction Steps**:
1. Start Quick Task on Instagram
2. Wait 2 minutes (timer duration)
3. Switch to Twitter before timer expires
4. Timer expires while on Twitter
5. Observe Post-QT dialog appears

**Expected Behavior**:
Post-QT dialog should NOT appear if user has left the app. Silent reset to IDLE.

**Actual Behavior**:
Post-QT dialog appears even though user is on different app

**Severity**: High

**Frequency**: Often

**Evidence**:
- Logs: See `QT_TIMER_EXPIRED` tag
- Expected log: `QT_TIMER_EXPIRED_AWAY`
- Actual log: `QT_TIMER_EXPIRED_FOREGROUND`

**Related Code**:
- File: `plugins/src/android/java/com/anonymous/breakloopnative/ForegroundDetectionService.kt`
- Function: `onQuickTaskTimerExpired`
- Line: ~2100

**Proposed Fix**:
Foreground detection logic may be using stale `currentForegroundApp` value. Need to capture foreground app at exact moment of timer expiry.

**Notes**:
This is a foreground gating bug. The PR8 fix should have addressed this, but may have regression.

---

### Example 3: Breathing Screen Stuck at 0

**Flow Location**: Intervention Flow → BreathingScreen

**Reproduction Steps**:
1. Trigger intervention flow
2. Wait for breathing countdown
3. Observe countdown reaches 0 but doesn't advance

**Expected Behavior**:
Screen should auto-advance to RootCauseScreen when countdown reaches 0

**Actual Behavior**:
Countdown shows 0 and stays stuck, no navigation

**Severity**: Critical

**Frequency**: Rare

**Evidence**:
- Logs: Check `interventionState` in React Native logs
- Expected: `state: 'breathing'` → `state: 'root-cause'`
- Actual: `state: 'breathing'` (stuck)

**Related Code**:
- File: `app/screens/conscious_process/BreathingScreen.tsx`
- Function: `useEffect` (timer tick)
- Line: ~83-96

**Proposed Fix**:
Race condition in `shouldTickBreathing` logic. May need to check if `breathingCount === 0` triggers `BREATHING_COMPLETE` action.

**Notes**:
Only observed once on Pixel 6. Could not reproduce reliably.

---

### Example 4: Hardware Back Button Works on QuickTaskDialog

**Flow Location**: Quick Task Flow → QuickTaskDialogScreen

**Reproduction Steps**:
1. Trigger Quick Task dialog
2. Press hardware back button
3. Observe dialog dismisses

**Expected Behavior**:
Hardware back button should be disabled. User must use on-screen buttons.

**Actual Behavior**:
Dialog dismisses and user returns to app (or home)

**Severity**: Medium

**Frequency**: Always

**Evidence**:
- No logs needed (behavioral issue)
- Device: Any Android device

**Related Code**:
- File: `app/screens/conscious_process/QuickTaskDialogScreen.tsx`
- Function: `useEffect` (BackHandler)
- Line: ~63-71

**Proposed Fix**:
BackHandler listener may not be registered correctly. Verify `addEventListener` returns `true` to prevent default behavior.

**Notes**:
This is a regression. Back button was previously disabled correctly.

---

## Issue Tracking

### Open Issues

| ID | Title | Severity | Frequency | Flow | Status |
|----|-------|----------|-----------|------|--------|
| - | - | - | - | - | - |

### Closed Issues

| ID | Title | Severity | Frequency | Flow | Resolution | Closed Date |
|----|-------|----------|-----------|------|------------|-------------|
| - | - | - | - | - | - | - |

---

## Investigation Checklist

When investigating a UX issue, check:

### Logs
- [ ] `DECISION_GATE` - Decision logic evaluation
- [ ] `QT_STATE` - Quick Task state transitions
- [ ] `QT_FINISH` - Quick Task completion/expiry
- [ ] `SS_BOOT` - SystemSurface launch
- [ ] `SS_LIFE` - SystemSurface lifecycle
- [ ] `INTENT` - Intent extras and wake reasons
- [ ] `SURFACE_FLAG` - Surface active flag changes
- [ ] `ENTRY_BLOCK` - Entry blocked reasons
- [ ] `ENTRY_START` - Entry allowed reasons

### State
- [ ] `isSystemSurfaceActive` flag
- [ ] `quickTaskMap[app]?.state`
- [ ] `activeQuickTaskSessionIdByApp[app]`
- [ ] `cachedQuotaState.remaining`
- [ ] `cachedIntentions[app]`
- [ ] `interventionState.state`

### Timing
- [ ] Surface launch time (< 500ms expected)
- [ ] Timer expiry accuracy (within 1s expected)
- [ ] Foreground detection latency (< 300ms expected)

### Edge Cases
- [ ] App switching during flow
- [ ] Service restart during flow
- [ ] Low memory conditions
- [ ] Rapid app switching (< 1s between apps)
- [ ] Configuration changes (rotation, theme)

---

## Common Patterns

### Stuck Surface
**Symptoms**: SystemSurface stays open, user cannot dismiss  
**Causes**: 
- Session mismatch (JS and Native out of sync)
- `safeEndSession()` not called
- Activity finish blocked by error

**Investigation**:
1. Check `SS_LIFE` logs for lifecycle events
2. Check if `onDestroy` was called
3. Check if `FINISH_SYSTEM_SURFACE` command was emitted
4. Check if watchdog triggered recovery

---

### Missing Surface
**Symptoms**: Expected surface doesn't appear  
**Causes**:
- `isSystemSurfaceActive` stuck in `true`
- DecisionGate blocked entry
- Intent extras missing or malformed
- React Native not initialized

**Investigation**:
1. Check `DECISION_GATE` logs for block reason
2. Check `SURFACE_FLAG` logs for flag state
3. Check `INTENT` logs for wake reason
4. Check `SS_BOOT` logs for React Native initialization

---

### Wrong Surface
**Symptoms**: Different surface appears than expected  
**Causes**:
- Wake reason mismatch
- Session ID collision
- State machine desync

**Investigation**:
1. Check `INTENT` logs for wake reason
2. Check `QT_STATE` logs for state transitions
3. Check session IDs in logs (should match)

---

### Premature Dismissal
**Symptoms**: Surface closes before user completes flow  
**Causes**:
- Timer expiry while surface open
- External finish request
- Service crash

**Investigation**:
1. Check `SS_LIFE` logs for finish reason
2. Check timer logs for expiry events
3. Check service logs for crashes

---

## Reporting Guidelines

### For Developers

When logging an issue:
1. **Reproduce first**: Verify you can reproduce the issue reliably
2. **Capture logs**: Use `adb logcat -v time > issue_logs.txt` during reproduction
3. **Isolate**: Identify the minimal steps to reproduce
4. **Classify**: Assign severity and frequency honestly
5. **Investigate**: Include initial findings or hypotheses

### For Testers

When reporting an issue:
1. **Be specific**: Exact steps, not general descriptions
2. **Include context**: What were you trying to do?
3. **Capture evidence**: Screenshots, screen recordings, or logs
4. **Note device**: Model and Android version matter
5. **Check duplicates**: Search existing issues first

---

## Priority Matrix

| Severity | Frequency | Priority |
|----------|-----------|----------|
| Critical | Always | P0 (Immediate) |
| Critical | Often | P0 (Immediate) |
| Critical | Sometimes | P1 (High) |
| Critical | Rare | P2 (Medium) |
| High | Always | P1 (High) |
| High | Often | P1 (High) |
| High | Sometimes | P2 (Medium) |
| High | Rare | P3 (Low) |
| Medium | Always | P2 (Medium) |
| Medium | Often | P2 (Medium) |
| Medium | Sometimes | P3 (Low) |
| Medium | Rare | P4 (Backlog) |
| Low | Any | P4 (Backlog) |

**P0**: Drop everything, fix immediately  
**P1**: Fix in current sprint  
**P2**: Fix in next sprint  
**P3**: Fix when time permits  
**P4**: Consider for future release
