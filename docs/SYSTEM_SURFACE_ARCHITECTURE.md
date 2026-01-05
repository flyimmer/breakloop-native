# BreakLoop OS-Level UI Architecture

**Version:** 2.0  
**Date:** January 5, 2026  
**Status:** AUTHORITATIVE - This document defines the canonical architecture

---

## Part 1: Conceptual Clarification

### System Surface Activity (Conceptual)

The Android activity currently named `InterventionActivity` is **conceptually** a neutral **System Surface**.

**What it is:**
- An OS-level activity that appears on top of other apps
- A rendering container for multiple independent flows
- Infrastructure, not semantics

**What it is NOT:**
- Not exclusively for interventions
- Not tied to any specific flow logic
- Not implying "intervention" by its existence

**Conceptual Name:** `SystemSurfaceActivity`  
**Current Implementation:** `InterventionActivity` (keep for now unless trivial to rename)

**Key Principle:**  
The System Surface is a **neutral stage**. Different flows render on this stage, but the stage itself has no opinion about which flow is shown.

---

## Part 1A: Runtime Context & Bootstrap Lifecycle

### Runtime Context

Determines *which UI world* React Native is running in.

```ts
type RuntimeContext = 'MAIN_APP' | 'SYSTEM_SURFACE';
```

- `MainActivity` → `MAIN_APP`
- `SystemSurfaceActivity` → `SYSTEM_SURFACE`

**Critical Rule:** Each context has separate React Native instances and separate state.

### System Session

Defines **whether SystemSurfaceActivity has a legitimate reason to exist**.

```ts
type SystemSession =
  | { kind: 'INTERVENTION'; app: AppId }
  | { kind: 'QUICK_TASK'; app: AppId }
  | { kind: 'ALTERNATIVE_ACTIVITY'; app: AppId }
  | null;
```

**Invariant:**
```ts
SystemSurfaceActivity.isAlive === (SystemSession !== null)
```

### Bootstrap State

Bootstrap state exists **only** to protect cold start.

```ts
type SessionBootstrapState = 'BOOTSTRAPPING' | 'READY';
```

- Initial state: `BOOTSTRAPPING`
- Exit condition: **JS finishes OS Trigger evaluation**

**Core Principle (Non‑Negotiable):**

> **SystemSurfaceActivity must survive long enough for JavaScript to decide whether a SystemSession exists.**

During cold start:
- `session === null` does **NOT** mean "finish immediately"
- it means **"decision not made yet"**

### Cold Start Timeline

```
t0  User opens Instagram
t1  Android OS switches foreground app → Instagram
t2  AccessibilityService still alive
t3  AccessibilityService detects monitored app
t4  Native decides: need to wake SystemSurface
t5  Native launches SystemSurfaceActivity
t6  Android creates NEW Activity + NEW RN Context
t7  React Native initializes
t8  SystemSurfaceRoot first render
     - session = null
     - bootstrapState = BOOTSTRAPPING
     - ❌ MUST NOT finish
t9  JS reads from native:
     - wakeReason
     - triggeringApp
t10 JS runs OS Trigger Brain in【SystemSurface Context】
t11 OS Trigger Brain makes decision:
     - START_INTERVENTION / START_QUICK_TASK /
       START_ALTERNATIVE_ACTIVITY / DO_NOTHING
t12 JS dispatches SystemSession event
t13 JS sets bootstrapState = READY
t14 SystemSurfaceRoot renders again
     - If session !== null → render corresponding Flow
     - If session === null → finish SystemSurfaceActivity
```

### SystemSurfaceRoot — Authoritative Logic

```tsx
function SystemSurfaceRoot() {
  const { session, bootstrapState } = useSystemSession();

  if (bootstrapState === 'BOOTSTRAPPING') {
    // Cold start phase — NEVER finish here
    return null;
  }

  if (session === null) {
    // Decision complete, no session needed
    finishSystemSurfaceActivity();
    return null;
  }

  switch (session.kind) {
    case 'INTERVENTION':
      return <InterventionFlow app={session.app} />;

    case 'QUICK_TASK':
      return <QuickTaskFlow app={session.app} />;

    case 'ALTERNATIVE_ACTIVITY':
      return <AlternativeActivityFlow app={session.app} />;
  }
}
```

### Context Ownership Rules

**JavaScript (SystemSurface Context) MUST:**
- Run OS Trigger Brain
- Decide whether to create SystemSession
- Dispatch START_* events
- Control bootstrap lifecycle

**JavaScript (SystemSurface Context) MUST NOT:**
- Assume session exists on mount
- Finish activity during BOOTSTRAPPING

**JavaScript (MainApp Context) MUST:**
- Request native wake only

**JavaScript (MainApp Context) MUST NOT:**
- Create or modify SystemSession
- Dispatch START_* events

**Native (Kotlin) MUST:**
- Wake SystemSurfaceActivity
- Pass wakeReason + triggeringApp

**Native (Kotlin) MUST NOT:**
- Create session
- Interpret session
- Manage bootstrap

### Bootstrap Failure Modes

| Symptom | Root Cause |
|---------|-----------|
| App returns to Home immediately | finish() called during BOOTSTRAPPING |
| App hangs with no UI | Session created in MainApp context |
| No intervention shows | OS Trigger Brain not run in SystemSurface |
| Infinite loading | bootstrap never set to READY |

**Final Lock Rule:**

> **SystemSurfaceActivity may only finish after JavaScript has explicitly completed one OS Trigger evaluation cycle.**

---

## Part 2: Native–JavaScript Boundary

### Core Principle (Non-Negotiable)

**Native code decides WHEN to wake the app.**  
**JavaScript decides WHAT the user sees and WHY.**

- **Native = mechanics**
- **JavaScript = semantics**

### Three JavaScript Runtimes

BreakLoop uses THREE distinct JavaScript runtimes:

1. **System Brain JS** - Event-driven, headless, semantic logic (NEW)
2. **SystemSurface JS** - Ephemeral, UI-only, intervention screens
3. **MainApp JS** - User-initiated, settings and community

### System Brain JS (Event-Driven Semantic Runtime)

**Definition:**
System Brain JS is an **event-driven, headless JavaScript runtime** that runs as a React Native Headless JS task.

**Lifecycle (CRITICAL):**
- Invoked by native when mechanical events occur
- Recomputes state deterministically on each invocation
- Does NOT rely on continuous execution
- Does NOT maintain in-memory state between invocations
- Must load/save state from persistent storage on each event

**Responsibilities:**
- Receive MECHANICAL events from native (timer expired, foreground changed)
- Classify semantic meaning (Quick Task vs Intention vs other)
- Evaluate OS Trigger Brain logic
- Decide when to launch SystemSurface
- Maintain semantic state (t_quickTask, t_intention)
- Persist/restore state on each invocation

**Forbidden:**
- UI rendering
- React components
- Depending on SystemSurface or MainApp contexts
- Assuming continuous execution
- Maintaining state in memory between events

### Native (Kotlin) — Allowed Responsibilities

**Native Code MAY:**
- Detect foreground app changes (AccessibilityService)
- Detect timer expiration using persisted timestamps
- Persist timestamps (SharedPreferences)
- Emit MECHANICAL events: "timer expired for app X", "foreground is app X"
- Launch SystemSurfaceActivity when requested by System Brain

**Native Code MUST NOT:**
- Decide Quick Task vs Intervention
- Check `n_quickTask`
- Check `t_intention` priority
- Run OS Trigger priority chain
- Decide which screen to show
- Interpret user intent
- Navigate inside flows
- Label events with semantic meaning (no "QuickTaskExpired", "IntentionExpired")

### JavaScript — Required Responsibilities

**System Brain JS MUST:**
- Own the OS Trigger Brain
- Evaluate the full priority chain
- Classify timer type (Quick Task vs Intention)
- Decide:
  - Quick Task Flow
  - Intervention Flow
  - Suppression (do nothing)
- Manage `t_intention` semantics
- Manage Quick Task semantics
- Reset timers on Quick Task expiry
- Load/save state on each event invocation

**SystemSurface JS MUST:**
- Render intervention screens
- Handle user interactions
- Report decisions to System Brain

**SystemSurface JS MUST NOT:**
- Use setTimeout for semantic timers
- Decide whether to intervene
- Maintain persistent state

**MainApp JS MUST:**
- Handle user-initiated features (settings, community)

**MainApp JS MUST NOT:**
- Handle system-level intervention logic
- Handle timer expiration
- Monitor foreground apps

### Wake Reason Contract (Critical)

Every native launch of `SystemSurfaceActivity` MUST include a wake reason.

**Valid Wake Reasons:**
- `MONITORED_APP_FOREGROUND` - User opened monitored app
- `INTENTION_EXPIRED_FOREGROUND` - Intention timer expired while user still on app
- `QUICK_TASK_EXPIRED_FOREGROUND` - Quick Task timer expired while user still on app
- `DEV_DEBUG` - Debug/testing wake

**System Brain JS Requirements:**
- Receive mechanical events from native: "TIMER_EXPIRED", "FOREGROUND_CHANGED"
- Classify semantic meaning (Quick Task vs Intention)
- Decide whether to launch SystemSurface
- Pass wake reason to SystemSurface when launching

**SystemSurface JS Requirements:**
- Read wake reason on startup
- Branch behavior based on wake reason
- **NEVER** use setTimeout for semantic timers

### Red Flags (Immediate Failure)

If **ANY** of the following are true, **STOP and FIX**:

- ❌ Kotlin code checks `n_quickTask`
- ❌ Kotlin code chooses Quick Task vs Intervention
- ❌ Kotlin code decides navigation or screens
- ❌ Kotlin code labels events with semantic meaning
- ❌ System Brain JS skips priority chain based on native assumptions
- ❌ SystemSurface JS uses setTimeout for semantic timers
- ❌ `QUICK_TASK_EXPIRED_FOREGROUND` triggers Quick Task dialog again
- ❌ Main app UI appears in System Surface
- ❌ Native logic duplicates JS logic
- ❌ Semantic logic in SystemSurface or MainApp contexts

### Verification Checklist

When reviewing code changes, verify:

**1. Native Code Review:**
- [ ] Only detects events and persists timestamps
- [ ] Emits ONLY mechanical events ("TIMER_EXPIRED", "FOREGROUND_CHANGED")
- [ ] Never makes semantic decisions
- [ ] Never labels events with semantic meaning
- [ ] Never checks Quick Task availability or counts

**2. System Brain JS Review:**
- [ ] Runs as React Native Headless JS task
- [ ] Loads state from persistent storage on each event
- [ ] Classifies timer type (Quick Task vs Intention)
- [ ] Runs full priority chain evaluation
- [ ] Makes all flow decisions (Quick Task vs Intervention)
- [ ] Saves state to persistent storage after each event
- [ ] Never assumes continuous execution
- [ ] Never maintains state in memory between events

**3. SystemSurface JS Review:**
- [ ] UI-only (no semantic logic)
- [ ] Never uses setTimeout for semantic timers
- [ ] Reads wake reason on startup
- [ ] Reports user decisions to System Brain

**4. MainApp JS Review:**
- [ ] User features only (settings, community)
- [ ] Never handles system-level intervention logic
- [ ] Never handles timer expiration

**5. Integration Points:**
- [ ] System Brain registered as headless task
- [ ] Native can launch SystemSurface via System Brain request
- [ ] Wake reason always provided to SystemSurface
- [ ] No semantic logic in native layer
- [ ] No mechanical logic in UI layers

---

## Part 3: OS Trigger Contract

### Monitored Apps Definition

**What counts as a "monitored app":**
- Apps and Websites listed under Settings → "Monitored apps"
- Both applications and websites are monitored and will trigger the conscious process intervention
- Each monitored app/website is treated as an individual entity

### Timer/Parameter Scope

Each individual monitored app shall have its own timers/parameters below, **except** `n_quickTasks` which is global:

| Timer/Parameter | Scope | Notes |
|----------------|-------|-------|
| `t_intention` | Per-app | Each monitored app has its own intention timer |
| `t_quickTask` | Per-app | Each monitored app has its own Quick Task active timer |
| `n_quickTask` | **GLOBAL** | Usage count is shared - using Quick Task on Instagram consumes quota for TikTok too |

### Intervention Trigger Rules

**Core Principle:** Every app shall be treated as individual.

**Evaluation Rule:**
- Every time a monitored app enters foreground, the OS trigger logic must evaluate whether an intervention should start.

**Suppression Conditions:**

When the intervention for a monitored app has already been started, the system must monitor:

- If the intention timer (`t_intention`) is chosen and `t_intention` is not over, **OR**
- If the "alternative activity" is started,  
- **Then:** the intervention shall NOT be started.

**Else:** the intervention shall be started from the beginning again.

### Intention Timer (`t_intention`) Behavior

**Definition:** The timer set by the user for this monitored app during the intervention flow indicating how long the user wants to use this app.

**Rules:**
- When `t_intention` is over and the user is still using this monitored app, the intervention should start again.
- Every time the intervention flow starts or restarts, the `t_intention` for this app shall be deleted.

### Incomplete Intervention Cancellation

When user switches away from a monitored app, cancel intervention ONLY if it's incomplete.

**Incomplete States (Cancel Intervention):**
- **`breathing`** - User hasn't finished breathing
- **`root-cause`** - User hasn't selected causes
- **`alternatives`** - User hasn't chosen alternative
- **`action`** - User hasn't started activity
- **`reflection`** - User hasn't finished reflection

**Complete/Preserved States (Do NOT Cancel):**
- **`action_timer`** - User is doing alternative activity → preserve
- **`timer`** - User set `t_intention` → this transitions to idle AND launches the app, so user can use it normally → preserve
- **`idle`** - No intervention → nothing to cancel

**Key Insight:** When user sets `t_intention`, the intervention completes and transitions to `idle`, then the app launches normally. The `t_intention` timer is now active and will suppress future interventions until it expires.

### Quick Task System

**Definitions:**
- **`t_quickTask`**: Duration of the emergency allowance
- **`n_quickTask`**: Number of Quick Tasks allowed within the rolling window (e.g., 15 minutes)

**Rules:**
1. **Quick Task temporarily suppresses all intervention triggers.**
2. **During `t_quickTask`:**
   - User may freely switch apps and return to monitored apps
   - No intervention process shall start
3. **Quick Task does NOT create or extend `t_intention`.**
4. **When `t_quickTask` expires:**
   - `t_intention` is reset to 0
   - System shows the screen "QuickTaskExpiredScreen"
   - User will press the button and leave to the home screen of the cellphone
5. **After Quick Task expiry:**
   - The next opening of a monitored app triggers:
     - the intervention process, OR
     - the Quick Task dialog (if `n_quickTask` allows)
6. **No timer state from before the Quick Task is resumed or reused.**
7. **`n_quickTask` is counted globally across all monitored apps within the window.**

---

## Part 4: State Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORED APP FOREGROUND ENTRY                     │
│                                                                       │
│                    OS Trigger Evaluation (JavaScript)                 │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Priority Check Chain │
                    │  (LOCKED ORDER)       │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌────────────────┐
│ 1. Quick Task │      │ 2. Alternative │     │ 3. t_intention │
│    ACTIVE?    │      │    Activity    │     │    VALID?      │
│               │      │    RUNNING?    │     │                │
└───────┬───────┘      └────────┬───────┘     └───────┬────────┘
        │                       │                     │
        │ YES                   │ YES                 │ YES
        ▼                       ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│               SUPPRESS EVERYTHING - DO NOTHING              │
│   (No intervention, no Quick Task dialog, allow app usage)  │
└─────────────────────────────────────────────────────────────┘
        │
        │ ALL NO
        ▼
┌───────────────────┐
│ 4. n_quickTask > 0│
│    (Global)       │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │ YES       │ NO
    ▼           ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   ENTER QUICK TASK FLOW     │  │  ENTER INTERVENTION FLOW    │
│         (Emergency)         │  │    (Conscious Process)      │
└─────────────────────────────┘  └─────────────────────────────┘
```

---

## Quick Task Flow (Emergency Bypass)

```
┌──────────────────────────────────────────────────────────────┐
│                    QUICK TASK FLOW                           │
│                                                              │
│  Purpose: Emergency bypass for urgent, necessary app usage   │
│  Duration: Limited time window per app (e.g., 3 minutes)    │
│  Timer Scope: PER-APP (each app has independent timer)      │
│  Usage Count: GLOBAL (shared quota across all apps)         │
└──────────────────────────────────────────────────────────────┘

    [ENTRY]
       │
       ▼
┌──────────────────┐
│ QuickTaskDialog  │  ← System Surface renders this screen
│                  │
│ "Quick, necessary│
│  task?"          │
│                  │
│ [Conscious]      │
│ [Quick Task]     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Conscious] [Quick Task]
    │         │
    │         ▼
    │   ┌──────────────────┐
    │   │ QuickTaskActive  │
    │   │                  │
    │   │ Timer Running:   │
    │   │ - User can freely│
    │   │   switch apps    │
    │   │ - All interventions
    │   │   suppressed     │
    │   │ - All Quick Task │
    │   │   dialogs        │
    │   │   suppressed     │
    │   └────────┬─────────┘
    │            │
    │            │ (Timer expires)
    │            ▼
    │   ┌──────────────────┐
    │   │ QuickTaskExpired │  ← System Surface renders this screen
    │   │                  │
    │   │ "Emergency window│
    │   │  is over"        │
    │   │                  │
    │   │ [Go Home]        │
    │   └────────┬─────────┘
    │            │
    │            │ (User clicks)
    │            ▼
    │   ┌──────────────────┐
    │   │ Reset Timers:    │
    │   │ - t_intention=0  │
    │   │ (per spec V1)    │
    │   │                  │
    │   │ Navigate to Home │
    │   └────────┬─────────┘
    │            │
    │            ▼
    │        [EXIT]
    │
    │ (User chooses Conscious Process)
    │
    └──────────────────────────────────────────────┐
                                                   │
                                                   ▼
                                    [ENTER INTERVENTION FLOW]
```

**Quick Task Rules:**
1. ✅ Each app has its own independent Quick Task timer (t_quickTask is per-app)
2. ✅ During Quick Task: User can use THAT SPECIFIC APP without intervention
3. ✅ Switching to a DIFFERENT monitored app will trigger its own intervention check
4. ✅ Does NOT create or extend t_monitored
5. ✅ On expiry: Show dedicated screen, reset timers, go to Home
6. ✅ No timer state from before Quick Task is resumed
7. ✅ n_quickTask (usage count) is GLOBAL across all monitored apps

---

## Intervention Flow (Conscious Process)

```
┌──────────────────────────────────────────────────────────────┐
│                   INTERVENTION FLOW                          │
│                                                              │
│  Purpose: Full mindfulness intervention for monitored app    │
│  Duration: Variable, user-driven                            │
│  Scope: PER-APP (each monitored app independent)            │
└──────────────────────────────────────────────────────────────┘

    [ENTRY]
       │
       ▼
┌──────────────────┐
│   Breathing      │  ← System Surface renders these screens
│                  │
│  "Take 3 breaths"│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   RootCause      │
│                  │
│ "Why Instagram?" │
│ [Boredom]        │
│ [Anxiety]        │
│ [Fatigue] ...    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Alternatives    │
│                  │
│ "See Alternatives"│
│ [My List]        │
│ [Discover]       │
│ [AI For You]     │
└────────┬─────────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼                     ▼
┌──────────────┐   ┌──────────────────┐
│ I really need│   │ Start Alternative│
│ to use it    │   │    Activity      │
└──────┬───────┘   └────────┬─────────┘
       │                    │
       ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│IntentionTimer│   │   ActionTimer    │
│              │   │  (Alternative    │
│ "How long?"  │   │   Activity)      │
│ [5m] [15m]...│   │                  │
└──────┬───────┘   │ Timer Running:   │
       │           │ - User does      │
       │           │   alternative    │
       │           │ - Interventions  │
       │           │   suppressed     │
       │           └────────┬─────────┘
       │                    │
       │                    │ (Activity ends)
       │                    ▼
       │           ┌──────────────────┐
       │           │   Reflection     │
       │           │                  │
       │           │ "How was it?"    │
       │           └────────┬─────────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────┐
│ Set t_intention timer       │
│ (User allowed to use app    │
│  for chosen duration)       │
│                             │
│ Return to monitored app     │
└──────────────┬──────────────┘
               │
               ▼
           [EXIT]
      (t_intention active,
   interventions suppressed)
```

**Intervention Rules:**
1. ✅ Each monitored app has independent intervention state
2. ✅ IntentionTimer sets t_intention (per-app)
3. ✅ ActionTimer suppresses interventions while alternative activity runs
4. ✅ After intervention: User returns to monitored app
5. ✅ t_intention blocks future interventions until it expires

---

## Shared System Surface

```
┌─────────────────────────────────────────────────────────────┐
│              System Surface Activity (OS-Level)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    AT ANY TIME, EXACTLY ONE OF:                    │   │
│  │                                                     │   │
│  │    1. BOOTSTRAPPING STATE                          │   │
│  │       - session = null                             │   │
│  │       - bootstrapState = BOOTSTRAPPING             │   │
│  │       - Renders: null (blank screen)               │   │
│  │       - MUST NOT finish activity                   │   │
│  │       - Waiting for OS Trigger Brain decision      │   │
│  │                                                     │   │
│  │    2. ACTIVE SESSION                               │   │
│  │       - session !== null                           │   │
│  │       - bootstrapState = READY                     │   │
│  │       - Renders ONE flow:                          │   │
│  │         • Quick Task Flow screens                  │   │
│  │           (QuickTaskDialog, QuickTaskExpired)      │   │
│  │         • Intervention Flow screens                │   │
│  │           (Breathing, RootCause, Alternatives...)  │   │
│  │         • Alternative Activity Flow screens        │   │
│  │       - NEVER multiple flows simultaneously        │   │
│  │                                                     │   │
│  │    3. NO SESSION NEEDED                            │   │
│  │       - session = null                             │   │
│  │       - bootstrapState = READY                     │   │
│  │       - Immediately calls finish()                 │   │
│  │       - Activity closes, returns to previous app   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Main App UI (tabs, settings, community) NEVER here        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. ✅ ONE shared OS-level activity
2. ✅ THREE distinct states (BOOTSTRAPPING, ACTIVE SESSION, NO SESSION)
3. ✅ Multiple separate, mutually exclusive flows (Quick Task, Intervention, Alternative Activity)
4. ✅ Flows share infrastructure, not semantics
5. ✅ Only ONE flow active at any time (when session exists)
6. ✅ Bootstrap state protects against premature finish()
7. ✅ Main app UI never appears in System Surface

---

## Why This Architecture?

### Why Flows are Separate

**Quick Task Flow:**
- Emergency bypass mechanism
- Short-lived (minutes)
- Global scope
- No intervention screens
- No conscious process
- Ends with explicit boundary (Home)

**Intervention Flow:**
- Full mindfulness process
- User-driven duration
- Per-app scope
- Multi-screen journey
- Conscious decision-making
- Ends with return to monitored app

**They solve different problems and must not be mixed.**

### Why They Share the OS Surface

**Practical Reasons:**
1. Both need to appear on top of other apps
2. Both need full-screen takeover
3. Both need OS-level permissions
4. Sharing infrastructure reduces complexity

**Architectural Reasons:**
1. The surface is neutral - it doesn't care which flow renders
2. Only ONE flow is ever active
3. Native code doesn't need to understand flow semantics
4. JavaScript decides which flow to show

### Why Quick Task is NOT Part of Intervention

**Conceptual Separation:**
- Quick Task is a **gate** that prevents intervention
- Intervention is a **process** that happens after the gate
- Gates and processes are not nested - they're sequential

**Implementation Impact:**
- Quick Task can bypass intervention entirely
- Quick Task doesn't create intervention state
- Quick Task doesn't extend intervention timers
- Quick Task and Intervention have independent lifecycles

**User Mental Model:**
- "I need this urgently" (Quick Task) vs "Let me think about this" (Intervention)
- Emergency vs Consciousness
- Bypass vs Engage

---

## Priority Chain (LOCKED)

This order is **AUTHORITATIVE** and must never change:

```
1. Quick Task ACTIVE (per-app: t_quickTask)
   → Suppress everything for this app

2. Alternative Activity RUNNING (per-app)
   → Suppress everything for this app

3. t_intention VALID (per-app)
   → Suppress everything for this app
   → Quick Task dialog MUST NOT appear

4. n_quickTask > 0 (global usage count)
   → Show Quick Task dialog

5. Else
   → Start Intervention Flow
```

**Important Distinctions:**
- **t_quickTask** (timer): PER-APP - Each app has its own independent Quick Task timer
- **n_quickTask** (usage count): GLOBAL - Shared quota across all monitored apps

**Rationale for Order:**

1. **Quick Task ACTIVE first** - This app has an active timer, user can use it freely
2. **Alternative Activity second** - User is actively doing something else
3. **t_intention third** - User made an explicit conscious decision for this app
4. **Quick Task availability fourth** - Emergency bypass option (global quota check)
5. **Intervention last** - Default path when no other conditions apply

### Logic Between `t_intention`, `t_quickTask`, `n_quickTasks`

When a monitored app enters foreground, evaluate in this order:

**Step 1: Check `t_intention` for this opening monitored app**

**If `t_intention != 0`:**
- No Quick Task dialog
- No intervention
- **SUPPRESS everything**

**If `t_intention = 0`:**
- Proceed to Step 2

**Step 2: Check `n_quickTasks` (global count)**

**If `n_quickTasks != 0`:**
- Proceed to Step 3

**If `n_quickTasks = 0`:**
- No Quick Task dialog
- **START INTERVENTION**

**Step 3: Check `t_quickTask` for this app**

**If `t_quickTask != 0`:**
- No Quick Task dialog
- No intervention
- **SUPPRESS (Quick Task active)**

**If `t_quickTask = 0` or has no value:**
- **SHOW QUICK TASK DIALOG**

### Decision Tree Summary

```
Monitored App Enters Foreground
    ↓
Check t_intention for this app
    ↓
[t_intention != 0?] ─YES→ SUPPRESS (no Quick Task, no intervention)
    ↓ NO (t_intention = 0)
Check n_quickTask (global)
    ↓
[n_quickTask != 0?]
    ↓ YES
    Check t_quickTask for this app
        ↓
    [t_quickTask != 0?] ─YES→ SUPPRESS (no Quick Task, no intervention)
        ↓ NO (t_quickTask = 0)
    SHOW QUICK TASK DIALOG
    ↓ NO (n_quickTask = 0)
START INTERVENTION FLOW
(delete t_intention for this app)
```

### Key Principles

1. **Per-App Isolation:** Each monitored app has its own `t_intention` and `t_quickTask` timers. Instagram's timers don't affect TikTok's behavior.

2. **Global Quick Task Quota:** `n_quickTask` is shared across all monitored apps. Using Quick Task on one app consumes the quota for all apps.

3. **Intervention Reset:** Every time intervention starts or restarts, `t_intention` for that app is deleted.

4. **Intention Timer Expiry:** When `t_intention` expires while user is still in the app, intervention starts again.

5. **Quick Task Independence:** Quick Task does NOT create or extend `t_intention`. They are separate mechanisms.

6. **Incomplete Cancellation:** Only cancel intervention when user switches away in incomplete states (breathing, root-cause, alternatives, action, reflection).

7. **Complete Preservation:** Preserve intervention state when user sets `t_intention` (transitions to idle) or starts alternative activity (action_timer state).

---

## Decision Authority

**Native Code (ForegroundDetectionService):**
- ✅ Detects foreground app changes
- ✅ Detects timer expirations
- ✅ Emits mechanical events to System Brain JS
- ❌ Does NOT decide which flow to show
- ❌ Does NOT interpret timers or states
- ❌ Does NOT label events with semantic meaning

**System Brain JS (Event-Driven Headless Runtime):**
- ✅ Receives mechanical events from native
- ✅ Classifies semantic meaning (Quick Task vs Intention)
- ✅ Evaluates priority chain
- ✅ Checks all timers and states
- ✅ Decides which flow to show
- ✅ Requests SystemSurface launch from native
- ✅ Single source of semantic truth
- ✅ Loads/saves state on each event invocation

**SystemSurface JS (Ephemeral UI):**
- ✅ Renders intervention screens
- ✅ Handles user interactions
- ✅ Reports decisions to System Brain
- ❌ Does NOT use setTimeout for semantic timers
- ❌ Does NOT decide whether to intervene

**MainApp JS (User-Initiated):**
- ✅ Settings and community features
- ❌ Does NOT handle system-level intervention logic

**Principle:** Native code is infrastructure. System Brain JS is semantics. SystemSurface/MainApp JS are UI.

---

## Future-Proofing

This architecture allows for:
- ✅ Adding new flows without changing native code
- ✅ Adding new priority conditions without changing infrastructure
- ✅ Testing flows independently
- ✅ Clear boundaries between concerns
- ✅ Easy mental model for developers

**Anti-Patterns to Avoid:**
- ❌ Nesting Quick Task inside Intervention Flow
- ❌ Making native code interpret semantic logic
- ❌ Mixing Main App UI with System Surface UI
- ❌ Sharing state between flows
- ❌ Changing priority order without reviewing this document

---

## Summary

1. **System Surface** = Neutral OS-level container
2. **Runtime Context** = THREE JS runtimes (System Brain, SystemSurface, MainApp)
3. **System Brain JS** = Event-driven, headless, semantic logic (NEW)
4. **Bootstrap Lifecycle** = BOOTSTRAPPING → READY (protects cold start)
5. **Native–JavaScript Boundary** = Native emits MECHANICAL events, System Brain classifies SEMANTIC meaning
6. **Wake Reason Contract** = System Brain receives mechanical events, classifies, then launches SystemSurface with wake reason
7. **Quick Task Flow** = Emergency bypass (global quota, per-app timer)
8. **Intervention Flow** = Conscious process (per-app)
9. **Flows are separate** = Different purposes, different scopes
10. **Priority chain is locked** = 5 conditions, strict order, evaluated by System Brain
11. **System Brain decides** = Native emits events, System Brain classifies and decides, SystemSurface renders

**This is the canonical model. All implementation must follow this.**

---

## Related Documentation

- `SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain JS event-driven runtime (NEW)
- `system_surface_bootstrap.md` - Authoritative cold-start bootstrap lifecycle
- `OS_Trigger_Contract V1.md` - Intervention trigger rules and timer logic
- `NATIVE_JAVASCRIPT_BOUNDARY.md` - Native-JS boundary contract
- `System_Session_Definition.md` - System session definitions
- `Trigger_logic_priority.md` - Decision tree implementation details
- `OS_TRIGGER_LOGIC_REFACTOR_SUMMARY.md` - Implementation changes
- `OS_TRIGGER_LOGIC_TEST_SCENARIOS.md` - Comprehensive test scenarios

---

**END OF DOCUMENT**

