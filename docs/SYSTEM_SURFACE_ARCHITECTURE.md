# BreakLoop OS-Level UI Architecture

**Version:** 3.0 (V3 Native Authority)
**Date:** January 23, 2026
**Status:** AUTHORITATIVE

---

## Architectural Invariants (AUTHORITATIVE - v3)

**Status:** These invariants are non-negotiable. Any change that violates these invariants is considered a bug.

**Source:** `spec/break_loop_architecture_invariants_v_3.md`, `spec/BreakLoop Architecture v3.docx`, `spec/break_loop_os_runtime_contract.md`

### 1. Session Is a Projection, Not State

A Session is an ephemeral projection of semantic state onto UI.

Formally:
```typescript
Session = null | QUICK_TASK(app) | POST_CHOICE(app) | INTERVENTION(app)
```

**Rules:**
- ✅ Only one Session may exist at a time
- ✅ Session is derived from semantic state + foreground app
- ✅ Session lifecycle must NEVER mutate semantic state
- ✅ Session termination must NOT change semantic state
- ❌ If Session lifecycle influences semantics, the architecture is invalid

**Mental Model:**
> Session answers: "What system UI (if any) should be shown right now for the current foreground app?"

Session is a **view**, not the truth.

**Semantic State (Source of Truth):**
Long-lived facts about the world, owned by native, independent of UI.

Per-app:
- `t_intention[app]` - Intention timer
- `t_quickTask[app]` - Quick Task active timer
- `alternativeActivityRunning[app]` - Alternative activity state
- `quickTaskState[app]` ∈ {IDLE, DECISION, ACTIVE, POST_CHOICE}

Global:
- `n_quickTask` - Quick Task usage count

Properties:
- Survives app switches
- Survives UI teardown
- Mutated only by timers or explicit user intent

### 2. Core Authority Split (Foundational)

**Native is the single source of truth for all semantic state.**

Semantic state includes:
- Quick Task state per app (IDLE, DECISION, ACTIVE, POST_CHOICE)
- Timers (t_quickTask, t_intention)
- Quota (n_quickTask)
- Foreground/background truth at expiration
- Alternative activity running state

**Rules:**
- ✅ Native owns all semantic state
- ✅ Native owns all timers and expiration logic
- ✅ Native decides whether Quick Task or Intervention is allowed
- ❌ JS must NEVER create, modify, infer, or repair semantic state
- ❌ JS must NEVER run timers or expiration logic
- ❌ JS must NEVER decide whether Quick Task or Intervention is allowed

**If JS attempts to decide semantics, authority is split and the architecture is broken.**

**JavaScript owns UI rendering and UI lifecycle only.**

JS responsibilities:
- ✅ Render UI for a given Session
- ✅ Collect explicit user intent (Accept, Decline, Continue, Quit)
- ✅ Manage SystemSurface lifecycle (open / close)
- ✅ Gate UI rendering until SystemSurface is ready
- ❌ JS responsibilities do NOT include semantic decisions

### 3. UI Gating Responsibility (Critical Clarification)

JS owns UI sequencing and gating, but NOT semantics.

**Explanation:**
- Android Activity lifecycle is asynchronous and non-deterministic
- `finish()` does not imply immediate destruction
- Rendering decisions cannot rely on timing assumptions

**Therefore:**
- ✅ Semantic state machine may emit intentions to show UI
- ✅ JS may queue or delay rendering until SystemSurface is ready
- ✅ JS may gate rendering until no other SystemSurface is active
- ❌ This does NOT grant JS semantic authority

**JS decides WHEN UI can be rendered, not WHAT should happen.**

### 4. System Brain and OS Trigger Brain Relationship

**System Brain hosts OS Trigger Brain. They are NOT peers.**

System Brain is:
- Long-lived JavaScript runtime (headless)
- Receives events from Native (foreground changes, timer expiration, commands)
- Owns semantic coordination (except where Native is the authority)
- Hosts OS Trigger Brain as a pure decision module
- Persists semantic state (when JS is the owner)
- Headless-capable, survives Activity restarts, not tied to UI lifecycle

OS Trigger Brain is:
- A pure decision function
- Running INSIDE System Brain
- Stateless beyond what System Brain provides
- Decides what should happen, not how it is shown
- Evaluates conditions (t_intention, t_quickTask, n_quickTask, foreground/background)

**OS Trigger Brain must:**
- ✅ Run inside System Brain only
- ❌ Never open UI
- ❌ Never depend on Activity state
- ❌ Never run inside SystemSurface

### 5. SystemSurface (UI Renderer Only)

SystemSurface is a renderer, not a decision maker.

**Responsibilities:**
- ✅ Render UI for the current Session Intent
- ✅ Manage Activity lifecycle
- ✅ Collect explicit user intents
- ✅ Close itself when instructed

**SystemSurface must NEVER:**
- ❌ Decide semantics
- ❌ Start timers
- ❌ Infer Quick Task state
- ❌ Re-run OS Trigger Brain

**If SystemSurface influences semantics, the architecture is broken.**

### 6. POST_CHOICE Invariants (Strict)

POST_CHOICE represents: Quick Task expired while app was foreground.

**Rules:**
- ✅ POST_CHOICE is a semantic state (owned by Native)
- ✅ POST_CHOICE UI is shown once per expiration
- ✅ POST_CHOICE must be persisted across restarts
- ✅ POST_CHOICE must never be re-emitted without user intent

**Allowed resolutions:**
- `POST_CONTINUE` - User chose to continue using app
- `POST_QUIT` - User chose to quit app

**Forbidden behaviors:**
- ❌ Re-emitting POST_CHOICE on app reopen
- ❌ Clearing POST_CHOICE on foreground change
- ❌ Treating POST_CHOICE like an intervention

### 7. Common Anti-Patterns (Explicitly Forbidden)

These patterns caused previous instability and are FORBIDDEN:

- ❌ Running OS Trigger Brain inside SystemSurface
- ❌ Letting Activity lifecycle decide semantics
- ❌ Re-running decision logic because UI closed
- ❌ Treating Session as semantic state
- ❌ SystemSurface creating or modifying timers
- ❌ Native code choosing Quick Task vs Intervention

### 8. Final Rule (Lock This)

> **Semantics decide what is allowed. UI decides when it can be shown. These responsibilities must never be inverted.**

This rule is the foundation of Phase 4.2 and beyond.

**Responsibility Matrix:**

| Responsibility | Native | JS |
|----------------|--------|-----|
| Semantic truth (what is allowed) | ✅ | ❌ |
| Timers / quota / expiration | ✅ | ❌ |
| Decision correctness | ✅ | ❌ |
| When UI can be rendered | ❌ | ✅ |
| Surface lifecycle gating | ❌ | ✅ |
| Queuing decisions until UI ready | ❌ | ✅ |

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

**🔒 CRITICAL: Lifecycle Contract**  
All SystemSurface implementations MUST follow the lifecycle invariants defined in `SystemSurface Lifecycle Contract (Authoritative).md`. This contract defines non-negotiable rules for single-instance behavior, exclusive input ownership, and deterministic lifecycle management. **Read this contract before implementing or modifying SystemSurface behavior.**

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
t1  Native Service detects foreground app → Instagram
t2  Native Service checks mechanical state (timers, quota, state machine)
t3  Native Service decides: SHOW_QUICK_TASK_DIALOG
t4  Native Service effectively launches SystemSurfaceActivity with COMMAND extra
t5  SystemSurfaceActivity starts
t6  React Native initializes
t7  SystemSurfaceRoot reads COMMAND from Intent extras
t8  JS renders UI matching the Command (Semantic Projection)
    - SHOW_QUICK_TASK_DIALOG → Render Quick Task
```

**Key Difference in V3:**
- **Native** makes the decision immediately.
- **No round-trip** to Headless JS is required for mechanical decisions.
- **System Brain** is bypassed for pure mechanical triggers.
t17 SystemSurfaceRoot renders again
    - If session !== null → render corresponding Flow
    - If session === null → finish SystemSurfaceActivity
```

**Key Changes (Decision Engine Refactor):**
- Decision Engine runs in **System Brain JS** (headless task), NOT in SystemSurface context
- Wake reason is pre-decided BEFORE SystemSurface is launched
- SystemSurface just consumes wake reason, no re-evaluation
- This ensures single authority and eliminates race conditions

**Critical Architectural Assumption:**

SystemSurfaceRoot bootstrap runs exactly once per Activity instance.

- SystemSurfaceActivity is disposable and never reused.
- Each launch is a cold start with fresh intent extras.
- We do NOT support intent re-delivery or Activity reuse.

**If this assumption changes in the future, bootstrap logic must be revisited.**

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
- Read wake reason from Intent extras (pre-decided by Decision Engine)
- Dispatch session based on wake reason (no logic, no re-evaluation)
- Dispatch START_* events
- Control bootstrap lifecycle

**JavaScript (SystemSurface Context) MUST NOT:**
- Run OS Trigger Brain or Decision Engine (already done in System Brain)
- Decide whether to create SystemSession (wake reason IS the decision)
- Re-evaluate priority chain
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

## Part 1B: Final Responsibility Split (Phase 2 - Stable Architecture)

This section defines the **final, stable architecture** after Phase 2 completion. This is not a transition state.

### Native Layer (Android/Kotlin)

**Responsibilities:**
- Detect foreground app changes (AccessibilityService)
- Detect timer expirations (using persisted timestamps)
- Emit **mechanical events only**: `"TIMER_EXPIRED"`, `"FOREGROUND_CHANGED"`
- Launch SystemSurfaceActivity when requested by System Brain
- Pass wake reason via Intent extras

**Explicitly Forbidden:**
- ❌ Semantic decisions (Quick Task vs Intervention)
- ❌ Knowing about Quick Task / Intervention logic
- ❌ Launching SystemSurface directly based on app type
- ❌ Checking `n_quickTask` or `t_intention`
- ❌ Labeling events with semantic meaning
- ❌ Running OS Trigger Brain logic

**Key Rule:**
> **Native decides WHEN, never WHY**

---

### System Brain JS (Headless, Semantic Core)

**Responsibilities:**
- **Single semantic authority** for all intervention logic
- Owns all decision logic via **Decision Engine** (`src/systemBrain/decisionEngine.ts`)
- Decision Engine is the **ONLY** place where SystemSurface launch decisions are made
- Owns all decision logic:
  - **Monitored vs unmonitored apps** (via `isMonitoredApp()` from `src/os/osConfig.ts`)
  - Quick Task availability (n_quickTask quota)
  - Intervention triggering (OS Trigger Brain evaluation)
  - Suppression rules (t_intention, t_quickTask)
  - Quick Task expiration handling (foreground vs background)
- Owns all persistent semantic state (AsyncStorage)
- **Pre-decides UI flow** before launching SystemSurface
- Launches SystemSurface with **explicit wake reason**
- **Monitored App Guard**: MUST check `isMonitoredApp()` before any evaluation

**Native Decision Authority (V3):**
- **Native Service** makes ALL mechanical decisions (Launch Quick Task vs Intervention)
- **Native Service** owns timers, quotas, and state machines
- **System Brain JS** acts as a semantic helper only (e.g. deciding *which* breathing exercise to show)

> ⚠️ **DEPRECATED (Phase 2):** The concept of a JS-side "Decision Engine" that launches SystemSurface is obsolete.
> Native launches SystemSurface directly based on its own internal logic.


**Guarantees:**
- **Kill-safe**: State persisted in AsyncStorage, logic reconstructable on each event
- **Idempotent**: Same inputs → same decision
- **Event-driven**: Invoked by native events, not continuously running
- **No in-memory state**: Loads/saves state on each invocation
- **Single decision per event**: Decision engine called at most once per event
- **UI-safe boundaries only**: Timer expiration never triggers UI directly

**Key Rule:**
> **Native Authority decides WHEN and IF UI can be shown (Mechanical Authority). System Brain (JS) decides WHICH pixels to render (Semantic Renderer).**

**Critical Guard Rule:**
> **OS Trigger Brain logic runs ONLY for monitored apps. System Brain MUST check `isMonitoredApp(packageName)` before Quick Task evaluation or Intervention evaluation. BreakLoop app itself is explicitly excluded.**

**UI-Safe Boundaries Rule:**
> **Timer expiration events are NOT UI-safe. They update state only. UI decisions are made only at UI-safe boundaries (user interaction or foreground change).**

---

### SystemSurface JS (UI Runtime)

**Responsibilities:**
- Render UI only (intervention screens, Quick Task dialog)
- Consume wake reasons from System Brain (declarative instructions)
- Dispatch exactly one session per launch based on wake reason
- Handle user interactions
- Report decisions back to System Brain
- Manage bootstrap lifecycle (BOOTSTRAPPING → READY)

**Explicitly Forbidden:**
- ❌ Semantic decisions (Quick Task vs Intervention)
- ❌ Availability checks (n_quickTask, t_intention)
- ❌ Reading System Brain internal state from AsyncStorage
- ❌ Re-running OS Trigger Brain logic
- ❌ Calling `evaluateTriggerLogic()`
- ❌ Using setTimeout for semantic timers
- ❌ Re-evaluating priority chain

**Key Rule:**
> **SystemSurface never thinks, it only renders. Wake reasons are declarative instructions, not triggers for re-evaluation.**

---

### Main App JS (User Features)

**Responsibilities:**
- Settings UI
- Community features
- Insights and statistics display
- User-initiated navigation

**Explicitly Excluded From:**
- ❌ System-level intervention logic
- ❌ Quick Task execution
- ❌ Intervention triggering
- ❌ Timer expiration handling
- ❌ Foreground app monitoring
- ❌ Creating SystemSession

**Key Rule:**
> **Main App is for user features only, never system logic**

---

## Part 2: Native–JavaScript Boundary

### Wake Reason Contract (Command-Driven - V2)

Every launch of `SystemSurfaceActivity` MUST include a wake reason.

**Core Principle:**
> **Wake reasons are Declarative Commands.**

System Surface consumes the command and renders accordingly.

---

**Valid Wake Reasons (V2 - Native Commands):**

1. **`SHOW_QUICK_TASK_DIALOG`**
   - **Source**: Native Command (`SHOW_QUICK_TASK_DIALOG`)
   - **Meaning**: Native confirmed app is eligible for Quick Task (quota available, timer unset).
   - **SystemSurface Action**: Dispatch `START_QUICK_TASK` session.

2. **`START_INTERVENTION_FLOW`**
   - **Source**: Native Command (`SHOW_INTERVENTION`) or System Brain internal logic (for complex flows).
   - **Meaning**: Native determined intervention is required (or System Brain decided to intervene).
   - **SystemSurface Action**: Dispatch `START_INTERVENTION` session.

3. **`SHOW_POST_QUICK_TASK_CHOICE`**
   - **Source**: Native Command (`SHOW_POST_QUICK_TASK_CHOICE`)
   - **Meaning**: Quick Task expired while foreground.
   - **SystemSurface Action**: Dispatch `POST_CHOICE` session.

4. **`DEV_DEBUG`**
   - **Meaning**: Developer-triggered wake.

---

**System Brain JS Requirements:**
- Receive **commands** from native: `SHOW_QUICK_TASK_DIALOG`, `SHOW_POST_QUICK_TASK_CHOICE`.
- **Relay** commands to SystemSurface (via `launchSystemSurface`).
- **Gating**: Ensure only one SystemSurface is active.

**SystemSurface JS Requirements:**
- Read wake reason on startup.
- **Directly dispatch session** based on wake reason.
- **NEVER** re-evaluate eligibility (Native already decided).

### Red Flags (Immediate Failure)

If **ANY** of the following are true, **STOP and FIX**:

- ❌ JS checks `n_quickTask` to decide eligibility.
- ❌ JS decides whether to show Quick Task vs Intervention (Native decides).
- ❌ SystemSurface runs timers.


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
- [ ] Decision Engine (`decideSystemSurfaceAction()`) is the ONLY place making launch decisions
- [ ] Event handlers update state first, then call Decision Engine (if UI-safe)
- [ ] `handleTimerExpiration()`: State updates ONLY, NEVER calls Decision Engine
- [ ] `handleForegroundChange()`: Updates state + calls Decision Engine (UI-safe)
- [ ] `handleUserInteraction()`: Updates state + calls Decision Engine (UI-safe)
- [ ] Loads state from persistent storage on each event
- [ ] Classifies timer type (Quick Task vs Intention)
- [ ] Decision Engine unifies Quick Task expiration + OS Trigger Brain priority chain
- [ ] Makes all flow decisions via Decision Engine (Quick Task vs Intervention vs NONE)
- [ ] Saves state to persistent storage after each event
- [ ] Never assumes continuous execution
- [ ] Never maintains state in memory between events
- [ ] Decision Engine called ONLY from UI-safe boundaries (never from TIMER_EXPIRED)

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

## Part 2B: Single Source of Truth for State

This table defines **where each piece of state lives** and **who owns it**. This is the authoritative reference for state management.

| State | Owner | Storage Location | Storage Key | Scope | Notes |
|-------|-------|------------------|-------------|-------|-------|
| **n_quickTask** (max uses) | System Brain | AsyncStorage | `quick_task_settings_v1` | Global | User config from Settings, immutable at runtime |
| **Quick Task usage history** | System Brain | AsyncStorage | `system_brain_state_v1` | Global | Array of timestamps, kill-safe, cleaned on each event |
| **t_quickTask** (timer) | System Brain | AsyncStorage | `system_brain_state_v1` | Per-app | Quick Task active timer per monitored app |
| **t_intention** (timer) | System Brain | AsyncStorage | `system_brain_state_v1` | Per-app | Intention timer per monitored app |
| **Monitored apps list** | Main App | AsyncStorage | `mindful_*_v17_2` | Global | User-configured list, read by System Brain via `isMonitoredApp()` |
| **SystemSession** | SystemSurface | In-memory | N/A | UI only | Ephemeral, destroyed when SystemSurface finishes |
| **Bootstrap state** | SystemSurface | In-memory | N/A | UI only | BOOTSTRAPPING → READY lifecycle |
| **Intervention state** | SystemSurface | In-memory | N/A | UI only | Breathing, root-cause, alternatives, etc. |

---

**Hard Rules:**

1. **SystemSurface may NOT read or infer semantic state from AsyncStorage**
   - SystemSurface receives all decisions via wake reason
   - No direct AsyncStorage reads for `n_quickTask`, `t_intention`, etc.

2. **System Brain is the ONLY writer of semantic state**
   - Only System Brain writes to `system_brain_state_v1`
   - Only System Brain updates usage history and timers

3. **State must be kill-safe**
   - System Brain loads state on each event invocation
   - No reliance on in-memory state between events

4. **Monitored App Guard**
   - System Brain MUST call `isMonitoredApp(packageName)` before any evaluation
   - BreakLoop app itself is explicitly excluded from monitoring

---

## Part 2C: Canonical Event Flow (Phase 2 - Final)

This is the **single, authoritative event flow** for Phase 2. There are no alternative paths or legacy flows.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Native Layer (ForegroundDetectionService)                    │
│    - AccessibilityService detects foreground app change         │
│    - Emits MECHANICAL event: "FOREGROUND_CHANGED"               │
│    - Event data: { packageName, timestamp }                     │
│    - NO semantic decisions, NO app type checks                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. System Brain JS (Event-Driven Headless)                      │
│    - Receives mechanical event from native                      │
│    - Loads semantic state from AsyncStorage                     │
│    - Event Handler updates state (marks expired timers, etc.)   │
│    - IF UI-safe boundary (FOREGROUND_CHANGED, USER_INTERACTION):│
│      → Calls Decision Engine (decideSystemSurfaceAction)        │
│    - IF TIMER_EXPIRED (background event):                       │
│      → NO Decision Engine call (not UI-safe)                    │
│      → State updated only, UI decision deferred                 │
│                                                                    │
│    Decision Engine Priority Chain:                              │
│    1. Expired Quick Task (foreground) → Force intervention      │
│    2. Expired Quick Task (background) → Clear flag, continue    │
│    3. CHECK: isMonitoredApp(packageName)?                       │
│       → If NO: Return NONE (no action)                          │
│       → If YES: Evaluate OS Trigger Brain priority chain:       │
│          a. Check t_intention (per-app) → Suppress?             │
│          b. Check t_quickTask (per-app) → Suppress?             │
│          c. Check n_quickTask (global) → Show Quick Task?       │
│          d. Else → Start Intervention                           │
│    - PRE-DECIDES UI flow (Quick Task OR Intervention OR NONE)   │
│    - IF decision.type === 'LAUNCH':                             │
│      → Calls launchSystemSurface(packageName, wakeReason)       │
│    - Saves updated state to AsyncStorage                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Native Layer (AppMonitorModule.launchSystemSurface)          │
│    - Receives explicit wake reason from System Brain            │
│    - Launches SystemSurfaceActivity                             │
│    - Passes wake reason + triggeringApp via Intent extras       │
│    - NO semantic decisions, just mechanical launch              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SystemSurface JS (Ephemeral UI Runtime)                      │
│    - Reads wake reason from Intent extras                       │
│    - NO evaluateTriggerLogic() call                             │
│    - NO priority chain re-evaluation                            │
│    - NO AsyncStorage semantic state reads                       │
│    - Directly dispatches session based on wake reason:          │
│      • SHOW_QUICK_TASK_DIALOG → START_QUICK_TASK                │
│      • START_INTERVENTION_FLOW → START_INTERVENTION             │
│    - Manages bootstrap lifecycle (BOOTSTRAPPING → READY)        │
│    - Renders appropriate flow (QuickTaskFlow / InterventionFlow)│
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. User Interaction                                             │
│    - User makes decision (Quick Task / Intervention)            │
│    - SystemSurface reports decision to System Brain             │
│    - System Brain updates semantic state                        │
│    - SystemSurface finishes (session = null)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principles:**

1. **Linear Flow**: Native → System Brain → SystemSurface (no loops)
2. **Single Authority**: Decision Engine is the ONLY place where launch decisions are made
3. **UI-Safe Boundaries**: Decision Engine called only from user interaction events, never from timer expiration
4. **Single Evaluation**: Decision Engine evaluated once per event, unifies Quick Task + OS Trigger Brain
5. **State Updates First**: Event handlers update state, then call Decision Engine (if UI-safe)
6. **Explicit Wake Reasons**: Wake reason IS the decision (no ambiguity)
7. **Monitored App Guard**: System Brain checks `isMonitoredApp()` before evaluation
8. **No Re-Evaluation**: SystemSurface never re-runs priority chain

**What This Diagram Does NOT Show:**

- ❌ Alternative paths (there are none)
- ❌ Legacy flows (Phase 1 is deprecated)
- ❌ SystemSurface decision logic (it has none)
- ❌ Native semantic decisions (it makes none)

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

### Intervention Flow Initialization Contract

**Critical Rule:** `BEGIN_INTERVENTION` must be dispatched **idempotently** to prevent countdown/hang bugs.

**Initialization Condition:**

`BEGIN_INTERVENTION` should be dispatched when:
- `targetApp` changes (switching to a different monitored app), OR
- Intervention state is NOT already in `breathing`

**Implementation:**

```typescript
// CORRECT (Idempotent)
useEffect(() => {
  if (interventionState.targetApp !== triggeringApp || 
      interventionState.state !== 'breathing') {
    dispatchIntervention({
      type: 'BEGIN_INTERVENTION',
      targetApp: triggeringApp,
    });
  }
}, [triggeringApp, interventionState.targetApp, interventionState.state]);

// WRONG (Unconditional reset)
useEffect(() => {
  dispatchIntervention({
    type: 'BEGIN_INTERVENTION',
    targetApp: triggeringApp,
  });
}, [triggeringApp]); // ❌ Resets on every mount, causes countdown restart
```

**Forbidden Patterns:**
- ❌ Unconditional reset on component mount
- ❌ Relying on previous reducer state accidentally
- ❌ Multiple `BEGIN_INTERVENTION` dispatches for same app

**Why This Matters:**

Without idempotent initialization:
- Breathing countdown restarts unexpectedly
- User sees screen hang or flicker
- Intervention state becomes inconsistent

**Verification:**

When reviewing intervention initialization code:
- [ ] Check if `BEGIN_INTERVENTION` is conditional
- [ ] Verify `targetApp` comparison
- [ ] Verify `state !== 'breathing'` check
- [ ] Ensure no unconditional dispatch on mount

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
1. ✅ ONE shared OS-level activity (see `SystemSurface Lifecycle Contract (Authoritative).md` - Invariant 1)
2. ✅ THREE distinct states (BOOTSTRAPPING, ACTIVE SESSION, NO SESSION)
3. ✅ Multiple separate, mutually exclusive flows (Quick Task, Intervention, Alternative Activity)
4. ✅ Flows share infrastructure, not semantics
5. ✅ Only ONE flow active at any time (when session exists)
6. ✅ Bootstrap state protects against premature finish()
7. ✅ Main app UI never appears in System Surface
8. ✅ **Lifecycle contract compliance** - All state transitions must follow allowed paths (see `SystemSurface Lifecycle Contract (Authoritative).md`)

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
- ✅ Decision Engine (`decideSystemSurfaceAction()`) is the single authority for launch decisions
- ✅ Event handlers update state, then call Decision Engine (if UI-safe boundary)
- ✅ `handleTimerExpiration()`: Updates state only, NEVER calls Decision Engine
- ✅ Decision Engine unifies Quick Task expiration + OS Trigger Brain priority chain
- ✅ Classifies semantic meaning (Quick Task vs Intention)
- ✅ Evaluates priority chain via Decision Engine
- ✅ Checks all timers and states
- ✅ Decides which flow to show (via Decision Engine)
- ✅ Requests SystemSurface launch from native (if Decision Engine returns LAUNCH)
- ✅ Single source of semantic truth
- ✅ Loads/saves state on each event invocation
- ✅ Decision Engine called ONLY from UI-safe boundaries (USER_INTERACTION, FOREGROUND_CHANGED)

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

**Anti-Patterns to Avoid (Critical - Must Never Happen Again):**

These patterns have caused bugs in the past and must be explicitly avoided:

1. **❌ SystemSurface calling OS Trigger Brain logic**
   - SystemSurface must NEVER call `evaluateTriggerLogic()`
   - SystemSurface must NEVER re-evaluate priority chain
   - Wake reason IS the decision, no re-evaluation needed

2. **❌ UI computing Quick Task availability**
   - SystemSurface must NEVER check `n_quickTask`
   - SystemSurface must NEVER read `t_intention` or `t_quickTask`
   - All availability checks happen in System Brain only

3. **❌ UI reading AsyncStorage semantic state**
   - SystemSurface must NEVER read `system_brain_state_v1`
   - SystemSurface must NEVER read `quick_task_settings_v1`
   - SystemSurface receives all decisions via wake reason

4. **❌ Native launching SystemSurface based on app type**
   - Native must NEVER check if app is monitored
   - Native must NEVER decide Quick Task vs Intervention
   - Native emits mechanical events only

5. **❌ Multiple semantic authorities**
   - System Brain Decision Engine (`decideSystemSurfaceAction()`) is the ONLY place making launch decisions
   - No semantic logic in Native, SystemSurface, or MainApp
   - Single source of truth for all intervention decisions
   - Event handlers must NOT contain decision logic, only state updates

6. **❌ Nesting Quick Task inside Intervention Flow**
   - Quick Task and Intervention are separate, mutually exclusive flows
   - Never show Quick Task dialog during intervention
   - Never mix flow states

7. **❌ Making native code interpret semantic logic**
   - Native decides WHEN, never WHY
   - No semantic meaning in native event labels
   - No timer type classification in native

8. **❌ Mixing Main App UI with System Surface UI**
   - Main App and System Surface are separate contexts
   - Never show Main App screens in System Surface
   - Never show System Surface screens in Main App

9. **❌ Sharing state between flows**
   - Each flow has independent state
   - No state leakage between Quick Task and Intervention
   - Clean state on flow transition

10. **❌ Changing priority order without reviewing this document**
    - Priority chain order is LOCKED
    - Changes require architecture review
    - Must update all documentation

11. **❌ Unconditional BEGIN_INTERVENTION on mount**
    - Must check if already in breathing state
    - Must check if targetApp changed
    - Idempotent initialization only

12. **❌ Skipping Monitored App Guard**
    - System Brain MUST check `isMonitoredApp()` before evaluation
    - BreakLoop app itself must be excluded
    - No intervention for unmonitored apps

---

## Summary

1. **System Surface** = Neutral OS-level container
2. **Runtime Context** = THREE JS runtimes (System Brain, SystemSurface, MainApp)
3. **System Brain JS** = Event-driven, headless, semantic logic (NEW)
4. **Decision Engine** = Single authority for all SystemSurface launch decisions (`decideSystemSurfaceAction()`)
5. **UI-Safe Boundaries** = Decision Engine called only from user interaction events, never from timer expiration
6. **Event Handlers** = "Dumb" state updaters; call Decision Engine only at UI-safe boundaries
7. **Bootstrap Lifecycle** = BOOTSTRAPPING → READY (protects cold start)
8. **Native–JavaScript Boundary** = Native emits MECHANICAL events, System Brain classifies SEMANTIC meaning
9. **Wake Reason Contract** = Native launches SystemSurface with explicit COMMAND (wake reason)
10. **Quick Task Flow** = Emergency bypass (global quota, per-app timer)
11. **Intervention Flow** = Conscious process (per-app)
12. **Flows are separate** = Different purposes, different scopes
13. **Priority chain is locked** = Native Logic (Quick Task state, quota, permissions)
14. **Native Authority** = Native commands UI and owns state. JS renders intent.

**This is the canonical model. All implementation must follow this.**

---

## Related Documentation

- `SystemSurface Lifecycle Contract (Authoritative).md` - **CRITICAL** - Lifecycle invariants and state transition rules (must read)
- `DECISION_ENGINE_REFACTOR_SUMMARY.md` - Decision Engine refactor (unified Quick Task + OS Trigger Brain into single authority)
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

