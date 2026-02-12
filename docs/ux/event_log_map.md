# Event Log Map

This document maps log tags and events to their meaning, and documents key state variables and their reset/refill behavior.

---

## Log Tags Reference

### Core System Tags

#### `DECISION_GATE`
**Purpose**: Logs DecisionGate evaluation results  
**When**: Every monitored app entry  
**Key Events**:
- `[DECISION_GATE] app=X action=Y reason=Z` - Decision result

**Example**:
```
[DECISION_GATE] app=com.instagram.android action=START_QUICK_TASK reason=START_QUICK_TASK
[DECISION_GATE] app=com.instagram.android action=NoAction reason=T_INTENTION_ACTIVE_120000ms
```

**What to Look For**:
- `action=NoAction` → Entry was blocked
- `reason=` → Why entry was allowed/blocked
- Common reasons: `START_QUICK_TASK`, `START_INTERVENTION`, `ALREADY_ACTIVE_SESSION`, `T_INTENTION_ACTIVE`, `QUOTA_ZERO`

---

#### `QT_STATE`
**Purpose**: Logs Quick Task state transitions  
**When**: State changes (IDLE → OFFERING → ACTIVE → POST_CHOICE)  
**Key Events**:
- `[STATE_WRITE] app=X state=Y → Z` - State transition
- `[QT_ACCEPT] app=X sid=Y` - User confirmed Quick Task
- `[INTENTION] Set for X until=Y` - Intention timer set
- `[INTENTION] Cleared for X reason=Y` - Intention timer cleared
- `[PRESERVE_SET] app=X value=Y` - Intervention preservation flag set
- `[PRESERVE_READ] app=X value=Y` - Intervention preservation flag read

**Example**:
```
[QT_STATE] [STATE_WRITE] app=com.instagram.android state=IDLE → OFFERING
[QT_STATE] [QT_ACCEPT] app=com.instagram.android sid=1234567890
[QT_STATE] [STATE_WRITE] app=com.instagram.android state=OFFERING → ACTIVE
```

**What to Look For**:
- State transitions should follow valid paths (IDLE → OFFERING → ACTIVE → POST_CHOICE → IDLE)
- Session IDs should match across related events
- Intention timers should have matching Set/Cleared pairs

---

#### `QT_FINISH`
**Purpose**: Logs Quick Task completion and expiry  
**When**: Timer expires or user manually finishes  
**Key Events**:
- `[QT_FINISH] Manual → PostChoice (Quota=X)` - User finished, quota remaining
- `[QT_FINISH] Manual → ForceReEval (Quota=0)` - User finished, quota exhausted
- `[QT_FINISH] ignored duplicate` - Duplicate finish call (idempotent guard)
- `[QT_FINISH] ignored session_mismatch` - Session ID mismatch (safety guard)

**Example**:
```
[QT_FINISH] [QT_FINISH] Manual → PostChoice (Quota=1)
[QT_FINISH] [QT_FINISH] Manual → ForceReEval (Quota=0)
```

**What to Look For**:
- Quota value determines next step (PostChoice vs ForceReEval)
- Session mismatches indicate stale state or race condition
- Duplicates indicate double-finish attempts (should be rare)

---

#### `SS_BOOT`
**Purpose**: Logs SystemSurface boot sequence  
**When**: SystemSurfaceActivity launches  
**Key Events**:
- `[onCreate] instanceId=X wakeReason=Y app=Z` - Activity created
- `UI_MOUNTED instanceId=X reason=Y app=Z` - React Native UI mounted
- `onNewIntent wakeReason=X app=Y` - New intent received (singleTask reuse)

**Example**:
```
[SS_BOOT] [onCreate] instanceId=123456 wakeReason=SHOW_QUICK_TASK app=com.instagram.android isDebug=true pid=12345 taskId=67
[SS_BOOT] UI_MOUNTED instanceId=123456 reason=SHOW_QUICK_TASK app=com.instagram.android
```

**What to Look For**:
- `onCreate` → `UI_MOUNTED` should happen within 500ms
- `wakeReason` should match expected flow (SHOW_QUICK_TASK, SHOW_INTERVENTION, SHOW_POST_QUICK_TASK_CHOICE)
- `instanceId` should be consistent across related events

---

#### `SS_LIFE`
**Purpose**: Logs SystemSurface lifecycle events  
**When**: Activity lifecycle callbacks  
**Key Events**:
- `[onCreate] instanceId=X wakeReason=Y app=Z` - Activity created
- `[onNewIntent] instanceId=X wakeReason=Y app=Z` - New intent received
- `[onPause] instanceId=X isFinishing=Y` - Activity paused
- `[onStop] instanceId=X isFinishing=Y` - Activity stopped
- `[LIFE] onDestroy reason=X isFinishing=Y` - Activity destroyed
- `[emitNewIntent] DELEGATED_TO_MODULE success=true` - New intent emitted to JS

**Example**:
```
[SS_LIFE] [onCreate] instanceId=123456 wakeReason=SHOW_QUICK_TASK app=com.instagram.android taskId=67
[SS_LIFE] [onPause] instanceId=123456 isFinishing=false
[SS_LIFE] [onStop] instanceId=123456 isFinishing=true
[SS_LIFE] [LIFE] onDestroy reason=ACTIVITY_DESTROYED isFinishing=true
```

**What to Look For**:
- Lifecycle should follow normal Android pattern: onCreate → onPause → onStop → onDestroy
- `isFinishing=true` indicates normal closure
- `isFinishing=false` in onStop indicates abnormal state (user switched away)

---

#### `INTENT`
**Purpose**: Logs Intent extras for SystemSurface launches  
**When**: SystemSurfaceActivity receives Intent  
**Key Events**:
- `[INTENT] wakeReason=X app=Y sessionId=Z instanceId=W` - Intent received

**Example**:
```
[INTENT] [INTENT] wakeReason=SHOW_QUICK_TASK app=com.instagram.android sessionId=1234567890 instanceId=123456
```

**What to Look For**:
- `wakeReason` should be one of: SHOW_QUICK_TASK, SHOW_INTERVENTION, SHOW_POST_QUICK_TASK_CHOICE
- `sessionId` should be unique per surface launch
- `app` should match the monitored app that triggered the flow

---

#### `SURFACE_FLAG`
**Purpose**: Logs `isSystemSurfaceActive` flag changes  
**When**: Surface opens or closes  
**Key Events**:
- `[SURFACE_FLAG] setActive=true reason=X` - Surface opened
- `[SURFACE_FLAG] setActive=false reason=X` - Surface closed

**Example**:
```
[SURFACE_FLAG] [SURFACE_FLAG] setActive=true reason=ON_CREATE pid=12345
[SURFACE_FLAG] [SURFACE_FLAG] setActive=false reason=ON_DESTROY pid=12345
```

**What to Look For**:
- Flag should be `true` only while SystemSurface is active
- Flag stuck in `true` indicates surface didn't close properly
- Reason should match lifecycle event (ON_CREATE, ON_DESTROY, etc.)

---

### Entry and Blocking Tags

#### `ENTRY_START`
**Purpose**: Logs allowed app entries  
**When**: DecisionGate allows entry (START_QUICK_TASK or START_INTERVENTION)  
**Key Events**:
- `[ENTRY_START] app=X action=Y reason=Z` - Entry allowed

**Example**:
```
[ENTRY_START] app=com.instagram.android action=START_QUICK_TASK reason=START_QUICK_TASK
```

---

#### `ENTRY_BLOCK`
**Purpose**: Logs blocked app entries  
**When**: DecisionGate blocks entry  
**Key Events**:
- `[ENTRY_BLOCK] app=X reason=Y` - Entry blocked

**Example**:
```
[ENTRY_BLOCK] app=com.instagram.android reason=T_INTENTION_ACTIVE_120000ms
[ENTRY_BLOCK] app=com.instagram.android reason=ALREADY_ACTIVE_SESSION
```

**Common Block Reasons**:
- `T_INTENTION_ACTIVE_Xms` - Intention timer active (X ms remaining)
- `ALREADY_ACTIVE_SESSION` - Quick Task already active
- `QT_OFFERING_ACTIVE` - Quick Task dialog already shown
- `POST_CHOICE_ACTIVE` - Post-QT dialog already shown
- `SURFACE_ACTIVE` - SystemSurface already open
- `NOT_MONITORED` - App not in monitored list

---

#### `ENTRY_IGNORED`
**Purpose**: Logs ignored app entries (duplicate/debounce)  
**When**: Entry suppressed by debounce or duplicate detection  
**Key Events**:
- `[ENTRY_IGNORED] app=X reason=Y` - Entry ignored

**Example**:
```
[ENTRY_IGNORED] app=com.instagram.android reason=DEBOUNCE_300ms
```

---

### Foreground Detection Tags

#### `FG_RAW`
**Purpose**: Logs raw foreground app changes  
**When**: AccessibilityService detects app change  
**Key Events**:
- `[FG_RAW] pkg=X event=Y` - Raw accessibility event

**Example**:
```
[FG_RAW] pkg=com.instagram.android event=TYPE_WINDOW_STATE_CHANGED
```

**What to Look For**:
- High frequency (many events per second)
- Package name should match foreground app
- Event type usually TYPE_WINDOW_STATE_CHANGED

---

#### `FG_EVENT`
**Purpose**: Logs processed foreground events  
**When**: After debounce and filtering  
**Key Events**:
- `[FG_EVENT] pkg=X` - Processed foreground change

**Example**:
```
[FG_EVENT] pkg=com.instagram.android
```

---

### Service Lifecycle Tags

#### `SERVICE_LIFE`
**Purpose**: Logs ForegroundDetectionService lifecycle  
**When**: Service starts, stops, or restarts  
**Key Events**:
- `[SERVICE_LIFE] onServiceConnected` - Service started
- `[SERVICE_LIFE] onInterrupt` - Service interrupted
- `[SERVICE_LIFE] onDestroy` - Service destroyed
- `[MONITORED_APPS] Persisted to DataStore count=X` - Monitored apps saved
- `[MONITORED_APPS] Cache updated immediately count=X` - Monitored apps cache updated

**Example**:
```
[SERVICE_LIFE] onServiceConnected
[SERVICE_LIFE] [MONITORED_APPS] Cache updated immediately count=3
```

---

### Watchdog and Recovery Tags

#### `SS_WD`
**Purpose**: Logs SystemSurface watchdog events  
**When**: Watchdog monitors surface boot  
**Key Events**:
- `[SS_WD] BOOT_WATCHDOG_START timeout=X` - Watchdog started
- `[SS_WD] BOOT_WATCHDOG_CANCEL` - Watchdog cancelled (UI mounted)
- `[SS_WD] BOOT_WATCHDOG_TIMEOUT` - Watchdog timeout (force close)

**Example**:
```
[SS_WD] BOOT_WATCHDOG_START timeout=3000ms
[SS_WD] BOOT_WATCHDOG_CANCEL
```

**What to Look For**:
- Timeout indicates surface failed to mount (React Native issue)
- Cancel indicates normal boot (UI mounted in time)

---

#### `SURFACE_RECOVERY`
**Purpose**: Logs surface recovery actions  
**When**: Surface stuck or zombie state detected  
**Key Events**:
- `[SURFACE_RECOVERY] reason=X instanceId=Y` - Recovery triggered

**Example**:
```
[SURFACE_RECOVERY] [SURFACE_RECOVERY] reason=ACTIVITY_STOPPED_NOT_FINISHING instanceId=123456
```

---

### Canary Tags (Build Verification)

#### `SS_CANARY`
**Purpose**: Logs canary events to verify native code is running  
**When**: Key lifecycle events  
**Key Events**:
- `[SURFACE] Surface ACTIVE` - Surface opened
- `[SURFACE] Surface DESTROYED` - Surface destroyed
- `[LIFE] onCreate instanceId=X app=Y taskId=Z` - Activity created

**Example**:
```
[SS_CANARY] [SURFACE] Surface ACTIVE
[SS_CANARY] [LIFE] onCreate instanceId=123456 app=com.instagram.android taskId=67
```

---

#### `SS_BUILD`
**Purpose**: Logs build fingerprint for debugging  
**When**: Service or Activity starts  
**Key Events**:
- `[ACTIVITY_START] debug=X proc=Y pid=Z thread=W` - Activity build info
- `[SERVICE_START] debug=X proc=Y pid=Z thread=W` - Service build info

**Example**:
```
[SS_BUILD] [ACTIVITY_START] debug=true proc=com.anonymous.breakloopnative pid=12345 thread=main
```

---

### Development Tags

#### `QT_DEV`
**Purpose**: Development/debugging logs  
**When**: Debug code paths  
**Key Events**: Varies (ad-hoc debugging)

---

#### `QT_GUARD`
**Purpose**: Logs guard conditions and safety checks  
**When**: Guard conditions triggered  
**Key Events**: Varies (safety checks)

---

## State Variables Reference

### Quick Task State

#### `quickTaskMap[app]`
**Type**: `QuickTaskEntry`  
**Fields**:
- `state`: IDLE | OFFERING | ACTIVE | POST_CHOICE | INTERVENTION_ACTIVE
- `expiresAt`: Timestamp when timer expires (null if not active)
- `postChoiceShown`: Boolean flag
- `lastRecoveryLaunchAtMs`: Timestamp of last recovery attempt
- `suppressRecoveryUntilMs`: Timestamp until which recovery is suppressed
- `decisionStartedAtMs`: Timestamp when decision started

**Reset When**:
- User declines Quick Task → IDLE
- User finishes Quick Task → POST_CHOICE or IDLE (depending on quota)
- Timer expires while away → IDLE
- User switches to intervention → INTERVENTION_ACTIVE

**Refill When**: N/A (state machine, not quota)

---

#### `activeQuickTaskSessionIdByApp[app]`
**Type**: String (session ID)  
**Purpose**: Tracks ACTIVE session ID per app  
**Set When**: User confirms Quick Task (OFFERING → ACTIVE)  
**Cleared When**: 
- User finishes Quick Task
- Timer expires
- User switches to intervention

**Reset When**: State transitions to IDLE  
**Refill When**: N/A (session tracking, not quota)

---

#### `promptSessionIdByApp[app]`
**Type**: String (session ID)  
**Purpose**: Tracks OFFERING session ID per app  
**Set When**: DecisionGate returns START_QUICK_TASK  
**Cleared When**: User confirms, declines, or switches to intervention

**Reset When**: State transitions from OFFERING  
**Refill When**: N/A (session tracking, not quota)

---

#### `postChoiceSessionIdByApp[app]`
**Type**: String (session ID)  
**Purpose**: Tracks POST_CHOICE session ID per app  
**Set When**: Timer expires while in app  
**Cleared When**: User chooses "Close [App]" or "Continue"

**Reset When**: State transitions from POST_CHOICE  
**Refill When**: N/A (session tracking, not quota)

---

### Quota State

#### `cachedQuotaState`
**Type**: `QuotaState`  
**Fields**:
- `remaining`: Number of Quick Tasks remaining
- `windowStartMs`: Timestamp when current window started
- `windowDurationMs`: Duration of window in milliseconds
- `windowEndMs`: Timestamp when current window ends
- `maxPerWindow`: Maximum Quick Tasks per window

**Reset When**: 
- Window expires → `remaining` resets to `maxPerWindow`
- User changes max quota in Settings → `remaining` resets to new max

**Refill When**: 
- Current time > `windowEndMs` → New window starts, quota refills
- User increases max quota in Settings → Immediate refill (bypasses window)

**Persisted**: Yes (DataStore, survives app restart)

**Example**:
```kotlin
QuotaState(
  remaining = 1,
  windowStartMs = 1700000000000,
  windowDurationMs = 900000, // 15 minutes
  windowEndMs = 1700000900000,
  maxPerWindow = 1
)
```

---

### Intention State

#### `cachedIntentions[app]`
**Type**: Map<String, Long> (app → expiry timestamp)  
**Purpose**: Tracks intention timers per app  
**Set When**: User sets intention timer (IntentionTimerScreen)  
**Cleared When**: 
- Timer expires
- User manually clears intention
- User opens app (intention consumed)

**Reset When**: Timer expires or user clears  
**Refill When**: N/A (one-time timer, not quota)

**Persisted**: Yes (DataStore, survives app restart)

**Example**:
```kotlin
cachedIntentions = mapOf(
  "com.instagram.android" to 1700000120000 // Expires in 2 minutes
)
```

---

### Intervention Preservation

#### `preservedInterventionFlags[app]`
**Type**: Map<String, Boolean> (app → preserved flag)  
**Purpose**: Tracks whether intervention should be preserved on re-entry  
**Set When**: User starts intervention, then switches apps  
**Cleared When**: User completes intervention or explicitly cancels

**Reset When**: Intervention completes  
**Refill When**: N/A (flag, not quota)

**Persisted**: No (in-memory only, lost on service restart)

---

### Surface State

#### `isSystemSurfaceActive`
**Type**: Boolean  
**Purpose**: Global flag indicating if SystemSurface is open  
**Set When**: SystemSurfaceActivity.onCreate()  
**Cleared When**: SystemSurfaceActivity.onDestroy()

**Reset When**: Surface closes  
**Refill When**: N/A (flag, not quota)

**Persisted**: No (in-memory only)

**Critical**: If stuck in `true`, prevents new surfaces from launching

---

### Foreground State

#### `currentForegroundApp`
**Type**: String (package name)  
**Purpose**: Tracks current foreground app  
**Set When**: AccessibilityService detects app change  
**Cleared When**: Never (always has value)

**Reset When**: N/A (always tracks current app)  
**Refill When**: N/A (state tracking, not quota)

---

#### `lastRealForegroundPkg`
**Type**: String (package name)  
**Purpose**: Tracks last "real" user app (excludes launcher/systemUI)  
**Set When**: User app comes to foreground  
**Cleared When**: Never

**Reset When**: N/A  
**Refill When**: N/A

**Used For**: Fallback when timer expires and current app is unclear

---

## State Reset Matrix

| State Variable | Reset Trigger | Reset Value | Persisted |
|----------------|---------------|-------------|-----------|
| `quickTaskMap[app].state` | User action or timer expiry | IDLE | No |
| `activeQuickTaskSessionIdByApp[app]` | State → IDLE | null | No |
| `promptSessionIdByApp[app]` | State → ACTIVE/IDLE | null | No |
| `postChoiceSessionIdByApp[app]` | State → IDLE | null | No |
| `cachedQuotaState.remaining` | Window expiry | maxPerWindow | Yes |
| `cachedIntentions[app]` | Timer expiry or user clear | null | Yes |
| `preservedInterventionFlags[app]` | Intervention complete | null | No |
| `isSystemSurfaceActive` | Surface destroy | false | No |
| `currentForegroundApp` | App change | New app | No |

---

## Quota Refill Logic

### Window-Based Refill

**Trigger**: Current time > `windowEndMs`  
**Action**: 
1. Set `remaining = maxPerWindow`
2. Set `windowStartMs = current time`
3. Set `windowEndMs = windowStartMs + windowDurationMs`
4. Persist to DataStore

**Example**:
```
Window starts: 10:00 AM
Window duration: 15 minutes
Window ends: 10:15 AM
Max quota: 1

At 10:00 AM: remaining = 1
At 10:05 AM: User uses Quick Task, remaining = 0
At 10:15 AM: Window expires, remaining = 1 (refilled)
```

---

### Settings-Based Refill

**Trigger**: User increases max quota in Settings  
**Action**: 
1. Set `remaining = new max`
2. Keep `windowStartMs` unchanged
3. Keep `windowEndMs` unchanged
4. Persist to DataStore

**Example**:
```
Current: remaining = 0, max = 1
User changes max to 3
New: remaining = 3, max = 3
```

**Note**: This bypasses the window duration (immediate refill)

---

## Log Analysis Examples

### Example 1: Successful Quick Task Flow

```
[DECISION_GATE] app=com.instagram.android action=START_QUICK_TASK reason=START_QUICK_TASK
[QT_STATE] [STATE_WRITE] app=com.instagram.android state=IDLE → OFFERING
[INTENT] wakeReason=SHOW_QUICK_TASK app=com.instagram.android sessionId=1234567890
[SS_BOOT] [onCreate] instanceId=123456 wakeReason=SHOW_QUICK_TASK app=com.instagram.android
[SS_BOOT] UI_MOUNTED instanceId=123456 reason=SHOW_QUICK_TASK app=com.instagram.android
[QT_STATE] [QT_ACCEPT] app=com.instagram.android sid=1234567890
[QT_STATE] [STATE_WRITE] app=com.instagram.android state=OFFERING → ACTIVE
[SS_LIFE] [onPause] instanceId=123456 isFinishing=true
[SS_LIFE] [LIFE] onDestroy reason=ACTIVITY_DESTROYED isFinishing=true
[SURFACE_FLAG] setActive=false reason=ON_DESTROY
```

**Analysis**: Normal flow, user confirmed Quick Task, surface closed, timer started.

---

### Example 2: Blocked Entry (Intention Active)

```
[DECISION_GATE] app=com.instagram.android action=NoAction reason=T_INTENTION_ACTIVE_120000ms
[ENTRY_BLOCK] app=com.instagram.android reason=T_INTENTION_ACTIVE_120000ms
```

**Analysis**: Entry blocked because intention timer is active (120 seconds remaining).

---

### Example 3: Surface Stuck (Watchdog Timeout)

```
[SS_BOOT] [onCreate] instanceId=123456 wakeReason=SHOW_QUICK_TASK app=com.instagram.android
[SS_WD] BOOT_WATCHDOG_START timeout=3000ms
[SS_WD] BOOT_WATCHDOG_TIMEOUT
[SURFACE_RECOVERY] reason=BOOT_TIMEOUT instanceId=123456
[SURFACE_FLAG] setActive=false reason=WATCHDOG_RECOVERY
```

**Analysis**: Surface failed to mount within 3 seconds, watchdog force-closed it.

---

## Notes

- All timestamps are in milliseconds (Unix epoch)
- Session IDs are unique per surface launch (monotonic)
- Log tags are defined in `LogTags.kt`
- Logs can be filtered with `adb logcat -s TAG_NAME`
- For full flow analysis, filter multiple tags: `adb logcat -s DECISION_GATE QT_STATE SS_BOOT SS_LIFE`
