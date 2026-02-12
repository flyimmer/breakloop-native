# UI Surfaces Inventory

This document catalogs every UI surface (activities, screens, dialogs, overlays) in the BreakLoop Android app.

---

## Surface Inventory Table

| Surface | Trigger | Blocking Level | Dismiss Rules | Timeout Rules | Back Behavior | Notes |
|---------|---------|----------------|---------------|---------------|---------------|-------|
| **SystemSurfaceActivity** | Native launches via Intent | Full-screen blocking | Must complete flow or explicit dismiss | None (flow-dependent) | Disabled globally | Container for all OS-level flows |
| **QuickTaskDialogScreen** | `WAKE_REASON_SHOW_QUICK_TASK` | Full-screen blocking | User must choose action | None | Disabled | OFFERING state |
| **PostQuickTaskChoiceScreen** | `WAKE_REASON_SHOW_POST_QUICK_TASK_CHOICE` | Full-screen blocking | User must choose action | None | Acts as "Close [App]" | POST_CHOICE state |
| **BreathingScreen** | BEGIN_INTERVENTION event | Full-screen blocking | Auto-advances on countdown | 5s default (configurable 5-30s) | Disabled | First intervention step |
| **RootCauseScreen** | Breathing complete | Full-screen blocking | User must select reason | None | Disabled | Second intervention step |
| **AlternativesScreen** | Root cause selected | Full-screen blocking | User must select alternative or return | None | Disabled | Third intervention step |
| **ActionConfirmationScreen** | Alternative selected | Full-screen blocking | User must confirm | None | Returns to Alternatives | Fourth intervention step |
| **ActivityTimerScreen** | Action confirmed | Full-screen blocking | Auto-advances on timer or user confirms | Activity duration (user-set) | Disabled | Fifth intervention step |
| **ReflectionScreen** | Activity complete | Full-screen blocking | User must submit | None | Disabled | Sixth intervention step |
| **IntentionTimerScreen** | "Return to [App]" selected | Full-screen blocking | User must confirm readiness | None | Disabled | Alternative intervention end |
| **SettingsScreen** | User navigates from main app | Non-blocking (main app) | Standard navigation | None | Standard back | Main app settings |
| **EditMonitoredAppsScreen** | "Edit" from Settings | Non-blocking (main app) | Save or Cancel | None | Standard back | App selection screen |
| **MainActivity** | App launch | Non-blocking (main app) | Standard app behavior | None | Standard back | Main app container |

---

## Surface Details

### SystemSurfaceActivity (Native Container)

**Type**: Android Activity  
**Launch Mode**: `singleTask`  
**Task Affinity**: Empty (separate task)  
**Exclude from Recents**: Yes

**Purpose**: OS-level container for intervention and Quick Task flows. Appears on top of all apps.

**Lifecycle**:
- Launched by `ForegroundDetectionService` via Intent
- Hosts React Native root with flow-specific rendering
- Finishes when flow completes or user dismisses
- Never left in background (always finishes)

**Intent Extras**:
- `triggeringApp`: Package name that triggered the surface
- `wakeReason`: Why surface was launched (SHOW_QUICK_TASK, SHOW_INTERVENTION, SHOW_POST_QUICK_TASK_CHOICE)
- `sessionId`: Unique session identifier

**State Tracking**:
- `isSystemSurfaceActive`: Global flag in ForegroundDetectionService
- Set to `true` in `onCreate()`
- Set to `false` in `onDestroy()`
- Prevents duplicate surface launches

---

### Quick Task Surfaces

#### QuickTaskDialogScreen

**Blocking Level**: Full-screen modal, cannot be dismissed without action

**Dismiss Rules**:
1. "Start conscious process" → Switches to Intervention flow (surface stays open)
2. "Quick Task" → Confirms QT, closes surface, starts timer
3. Close (X) → Navigates to home, closes surface

**Timeout**: None (user must act)

**Back Behavior**: Disabled (hardware back button ignored)

**Visual Design**:
- Dark background (#0A0A0B)
- Centered content
- Primary action: "Start conscious process" (purple accent)
- Secondary action: "Quick Task" (neutral gray)
- Close button: Top-right X

**State Impact**:
- Shown when state = OFFERING
- User actions transition to ACTIVE or INTERVENTION_ACTIVE

---

#### PostQuickTaskChoiceScreen

**Blocking Level**: Full-screen modal, cannot be dismissed without action

**Dismiss Rules**:
1. "Close [App]" → Navigates to home, closes surface, NO suppression
2. "I want to use [App] more" → Returns to app, closes surface

**Timeout**: None (user must act)

**Back Behavior**: Treated as "Close [App]" (navigates to home)

**Visual Design**:
- Dark background (#0A0A0B)
- Centered completion icon (checkmark)
- Title: "Quick Task Complete"
- Primary action: "Close [App]" (purple accent)
- Secondary action: "I want to use [App] more" (muted text)

**State Impact**:
- Shown when state = POST_CHOICE
- User actions transition to IDLE

---

### Intervention Surfaces

#### BreathingScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: Auto-advances when countdown reaches 0

**Timeout**: 5 seconds (default), configurable 5-30s in Settings

**Back Behavior**: Disabled

**Visual Design**:
- Dark background (#0A0A0B)
- Centered breathing circle with countdown number
- Soft opacity animation (breathing rhythm)
- No text, no buttons

**State Impact**:
- Shown when interventionState = 'breathing'
- Auto-advances to 'root-cause'

---

#### RootCauseScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: User must select a reason

**Timeout**: None

**Back Behavior**: Disabled

**Visual Design**:
- Dark background
- Title: "What brought you here?"
- List of reasons (Boredom, Habit, Stress, etc.)
- Each reason is a tappable card

**State Impact**:
- Shown when interventionState = 'root-cause'
- Selection advances to 'alternatives'

---

#### AlternativesScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: 
1. Select alternative → Advances to action confirmation
2. "Return to [App]" → Advances to intention timer

**Timeout**: None

**Back Behavior**: Disabled

**Visual Design**:
- Dark background
- Title: "What would serve you better?"
- List of alternative activities
- Bottom button: "Return to [App]"

**State Impact**:
- Shown when interventionState = 'alternatives'
- Selection advances to 'action' or 'timer'

---

#### ActionConfirmationScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: User must confirm to start activity

**Timeout**: None

**Back Behavior**: Returns to AlternativesScreen

**Visual Design**:
- Dark background
- Confirmation message
- "Start Activity" button

**State Impact**:
- Shown when interventionState = 'action'
- Confirmation advances to 'action_timer'

---

#### ActivityTimerScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: 
1. Timer expires → Auto-advances
2. User confirms early completion → Advances

**Timeout**: Activity duration (user-set, typically 5-30 minutes)

**Back Behavior**: Disabled

**Visual Design**:
- Dark background
- Centered timer display
- "Complete Activity" button (appears after minimum time)

**State Impact**:
- Shown when interventionState = 'action_timer'
- Completion advances to 'reflection'

---

#### ReflectionScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: User must submit reflection

**Timeout**: None

**Back Behavior**: Disabled

**Visual Design**:
- Dark background
- Reflection prompt
- Text input area
- "Submit" button

**State Impact**:
- Shown when interventionState = 'reflection'
- Submission advances to 'idle' and navigates to home

---

#### IntentionTimerScreen

**Blocking Level**: Full-screen, no dismiss option

**Dismiss Rules**: User must confirm "I'm ready"

**Timeout**: None

**Back Behavior**: Disabled

**Visual Design**:
- Dark background
- Timer display (default 2 minutes)
- "I'm ready" button

**State Impact**:
- Shown when interventionState = 'timer'
- Confirmation advances to 'idle' and returns to app with intention active

---

### Main App Surfaces

#### MainActivity

**Type**: Standard Android Activity  
**Launch Mode**: Standard  
**Blocking Level**: Non-blocking

**Purpose**: Main app container with bottom tab navigation

**Tabs**:
1. Inbox (placeholder)
2. Community (placeholder)
3. Insights (placeholder)
4. Settings (functional)

**Dismiss Rules**: Standard Android app behavior

**Back Behavior**: Standard (exits app or navigates back)

---

#### SettingsScreen

**Type**: React Native Screen (within MainActivity)  
**Blocking Level**: Non-blocking

**Purpose**: Configure monitored apps, Quick Task settings, intervention preferences

**Sections**:
1. My Profile
2. Account
3. Social Privacy
4. Monitored Apps
5. Quick Task Settings
6. Intervention Preferences
7. Accessibility Service Status

**Dismiss Rules**: Standard navigation (back button or tab switch)

**Back Behavior**: Standard (returns to previous screen)

---

#### EditMonitoredAppsScreen

**Type**: React Native Screen (within MainActivity)  
**Blocking Level**: Non-blocking

**Purpose**: Select which apps to monitor

**Dismiss Rules**: 
1. Save → Persists changes and returns
2. Cancel → Discards changes and returns

**Back Behavior**: Standard (acts as Cancel)

---

## Surface Launch Patterns

### Native-Initiated Surfaces

**Trigger**: `ForegroundDetectionService` detects monitored app

**Launch Sequence**:
1. Native evaluates `DecisionGate`
2. Native launches `SystemSurfaceActivity` with Intent extras
3. React Native boots (if not already running)
4. JS reads Intent extras and renders appropriate flow
5. User completes flow
6. JS calls `safeEndSession()` which finishes Activity

**Wake Reasons**:
- `SHOW_QUICK_TASK`: Renders QuickTaskFlow → QuickTaskDialogScreen
- `SHOW_INTERVENTION`: Renders InterventionFlow → BreathingScreen
- `SHOW_POST_QUICK_TASK_CHOICE`: Renders QuickTaskFlow → PostQuickTaskChoiceScreen

---

### User-Initiated Surfaces

**Trigger**: User navigates within main app

**Launch Sequence**:
1. User taps tab or button
2. React Navigation handles transition
3. Screen renders
4. User interacts
5. User navigates away (back button or tab switch)

**Examples**:
- Settings tab → SettingsScreen
- Edit button → EditMonitoredAppsScreen

---

## Surface Coordination

### Mutual Exclusion

**Rule**: Only one SystemSurface instance can be active at a time

**Enforcement**:
- `isSystemSurfaceActive` flag in ForegroundDetectionService
- `DecisionGate` checks this flag before allowing new triggers
- `singleTask` launch mode prevents multiple instances

**Edge Cases**:
- If SystemSurface stuck: Watchdog force-closes after timeout
- If session mismatch: Action rejected, no new surface launched

---

### Flow Switching

**Quick Task → Intervention**:
1. User on QuickTaskDialogScreen
2. User taps "Start conscious process"
3. JS dispatches `REPLACE_SESSION` event
4. SystemSurface stays open
5. React Navigation switches to InterventionFlow
6. BreathingScreen renders

**No other flow switches are allowed** (one-way only)

---

## Accessibility

### Screen Reader Support

All surfaces support TalkBack (Android screen reader):
- Buttons have descriptive labels
- Countdown timers announce remaining time
- Focus order is logical (top to bottom)

### Font Scaling

All text respects system font size settings (up to 200% scale)

### Color Contrast

All text meets WCAG AA standards:
- Primary text: #FAFAFA on #0A0A0B (contrast ratio 18.5:1)
- Secondary text: #A1A1AA on #0A0A0B (contrast ratio 8.2:1)

---

## Performance

### Surface Launch Time

**Target**: < 500ms from Intent to first paint

**Actual** (measured on Pixel 6):
- Cold start: ~800ms (React Native initialization)
- Warm start: ~200ms (React Native already running)

### Memory Footprint

**SystemSurfaceActivity**: ~50MB (shared with main app process)  
**MainActivity**: ~80MB (includes React Native runtime)

---

## Notes

- All SystemSurface screens use **dark theme only** (no light mode)
- All SystemSurface screens are **full-screen** (no status bar, no navigation bar)
- All SystemSurface screens **disable hardware back button** (explicit dismissal only)
- Main app screens use **standard Android behavior** (back button, status bar, navigation bar)
