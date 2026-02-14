# BreakLoop UX Flow Spec (v1) — Monitored Apps + Quick Task + Progressive Intervention

## Goals
- Reduce unwanted screen time in **user-configured monitored apps**.
- Stay **non-blocking** (user can always proceed), but make proceeding increasingly **conscious** via progressive friction.
- Keep the default path short; escalate only when behavior indicates “doomscroll loop”.

## Scope
- Applies only to **configured monitored apps**.
- Two lanes exist for a monitored app opening:
  1) **Quick Task lane** (quota/time-boxed “allowed use”)
  2) **Intervention lane** (Pause → Intention Timer → progressive checkpoints → optional deep help)

> Quick Task is “almost independent” of the intervention flow; it is decided before entering the intervention lane.

---

## Key Definitions

### App categories
- **Trap Apps**: social / video / infinite-feed apps
  - Requires **Purpose** capture once per run (chips + optional short text).
- **Other Monitored Apps**: all other configured apps
  - No purpose capture to keep UX simple.

### Run
A **run** is a continuous session of a monitored app:
- Starts when the monitored app enters foreground and BreakLoop triggers.
- Ends when:
  - user closes/exits the monitored app via BreakLoop, OR
  - monitored app leaves foreground for a meaningful duration (implementation-defined), OR
  - user switches away and later re-enters as a new session.

Within a run, checkpoints and help states persist.

---

## State Model (per monitored app run)

### Required state
- `isTrapApp: boolean`
- `purpose: {type: chipId, text?: string} | null` *(trap apps only; required before first timer starts)*
- `timerCount: int` *(how many intention timers have been set in this run)*
- `checkpointCount: int` *(how many overruns have occurred; CP1 = first overrun, CP2 = second, ...)*

### Help Ladder state (progressive deep help)
- `rootCause: string | null` *(set once; optional until user engages help)*
- `whyShownFull: boolean` *(false initially; full WHY shown at most once per run)*
- `helpStep: "NONE" | "CAUSE" | "WHY" | "ALTS"` *(current help depth)*
- `skipStreak: int` *(count of consecutive presses of “Skip help — let me doomscroll” since CP3; resets when user engages help)*

---

## UI Surfaces (conceptual)
- **Pause/Breath Screen (F1)**
- **Intention Timer Screen (F2)**
  - Trap apps: includes inline Purpose picker (F3) before Start Timer is enabled.
- **Checkpoint Screen (CP1/CP2/CP3/...)**
- **Help Ladder Screens (F4)**
  - `CAUSE` (F4a) Root cause
  - `WHY` (F4b) Full or Short
  - `ALTS` (F4c) Alternatives (small set)

> Button labels in this spec are UX copy targets; final copy can be adjusted.

---

## Entry Decision (Quick Task vs Intervention)

### Decision rule (high-level)
On monitored app entry, the system decides:
- If **Quick Task is available** (quota/window permits): enter **Quick Task lane**.
- Else: enter **Intervention lane** (this spec).

> This spec focuses on the Intervention lane, but includes Quick Task hooks for clarity.

---

# A) Quick Task Lane (brief)
1. Show Quick Task UI (quota-based).
2. If user accepts Quick Task:
   - Return to monitored app with Quick Task constraints active.
3. If user declines Quick Task:
   - Proceed to Intervention Lane entry (Pause).

> Quick Task does not require Purpose/Root Cause. It is an alternative “bounded continue” option.

---

# B) Intervention Lane (Full Spec)

## B1) Entry Flow (first time in this run)

### Step 1 — Pause/Breath (F1)
**Intent**
- Break autopilot and calm impulse.

**UI behavior**
- Show breathing/progress animation for ~4–6 seconds.
- **Buttons are hidden during breathing**.
- After breathing finishes, reveal:
  - Primary: **Close app**
  - Secondary: **Use app**

> Optional: allow a tiny corner “X” during breathing for emergency exit (optional, not required).

**Transitions**
- Close app → exit monitored app (go Home or previous safe state)
- Use app → proceed to Step 2 (Timer)

---

### Step 2 — Intention Timer (F2)
**Intent**
- If the user uses the app, they commit to a timebox.

**Rule**
- **Mandatory**: user must set a timer to proceed.

#### For Other Monitored Apps
- Show timer presets (e.g., 1m / 2m / 5m / 10m; configurable).
- Buttons:
  - **Start timer**
  - **Close app**

Start timer → return to monitored app; timer begins.

#### For Trap Apps (Social/Video)
Timer screen includes inline Purpose picker (F3) before timer can start.

##### Inline Purpose (F3) — Mandatory for trap apps
**Rule**
- No non-purpose state: user must choose purpose to start timer.

**UI**
- Section title: “What are you here for?”
- Chips (examples): Reply / Post / Search / Check messages / Check something specific / Other
- “Other” opens optional 1-line text input.

**Constraints**
- Picking a chip is sufficient to proceed.
- Typing is optional unless user chooses “Other”.

**Timer section**
- Show presets.
- Buttons:
  - **Start timer** (enabled only when purpose is selected)
  - **Close app**

Start timer → return to monitored app; timer begins.

---

## B2) Checkpoints (timer expires while user is still in app)

### Shared checkpoint rules
- A checkpoint appears when the current intention timer ends and the monitored app is still foreground.
- If user chooses to continue at any checkpoint:
  - **They must set a new intention timer** (F2 again).
- Trap apps should always show a **prominent purpose reminder** at checkpoints.

---

### CP1 — First overrun
**Headline**
- “Time’s up”

**Trap apps (prominent line)**
- “Are you still here for: **{purpose}**?”

**Other apps**
- “Did you finish what you came for?”

**Buttons**
1) Primary: **I’m done → Close app**
2) Secondary: **Not yet → Set another timer**
3) Tertiary (optional): **I’m stuck** → enters Help Ladder at `CAUSE`

**Transitions**
- Close app → exit monitored app
- Set another timer → show Timer screen (F2) → return to app
- I’m stuck → Help Ladder (`helpStep = CAUSE`)

---

### CP2 — Second overrun
**Headline**
- “Still here”

**Trap apps (purpose reminder)**
- “You came for: **{purpose}**. Is that still true?”

**Buttons**
1) Primary: **Close app**
2) Secondary: **Set another timer** *(recommend smaller presets than CP1)*
3) Tertiary: **Go deeper** → Help Ladder (`CAUSE`)

---

### CP3 — Third overrun (Escalation point)
**Intent**
- User is likely in a loop. Deep help should be the default.

**Headline**
- “You’ve gone past your plan twice.”

**Trap apps**
- “Are you still here for: **{purpose}**?”

**Behavior**
- CP3 can **auto-open** the “next help step” (see rule below), but must provide an immediate escape.

#### CP3 Auto-open rule (state-based)
When CP3 is reached:
- If `rootCause == null` → auto-open **CAUSE (F4a)**
- Else if `whyShownFull == false` → auto-open **WHY full (F4b full)**
- Else → auto-open **ALTS (F4c)**

If auto-open is used, the CP3 “card” can still exist as the first screen, but it should immediately transition into the appropriate help screen unless the user taps the skip action.

**Buttons (always available on CP3 card or help screen header)**
- Primary: **Close app**
- Secondary: **Get help to stop** *(if not auto-opened already)*
- Tertiary: **Skip help — let me doomscroll** → goes to timer (F2) and `skipStreak++`

**Skip semantics**
- Pressing “Skip help — let me doomscroll” does NOT advance help state.
- It forces a new timer selection and increases `skipStreak`.

---

## B3) Help Ladder (F4) — Systematic, manageable deep help

### Design principle
To avoid combinational explosion:
- The help system is a **single ladder** (`helpStep`), not independent branching screens.
- If the user skips, they return to the app with a new timer.
- On the next checkpoint, the system offers the **same or next appropriate help step** based on state, not random combinations.

---

### Help Step: CAUSE (F4a) — Root cause
**Prompt**
- “What’s driving this right now?”

**Chips**
- bored / stressed / lonely / avoiding / habit / other

**Buttons**
- **Close app**
- **Skip help — let me doomscroll** → set timer (F2), `skipStreak++`

**On select**
- set `rootCause`
- set `helpStep = WHY`
- reset `skipStreak = 0`

---

### Help Step: WHY (F4b) — Why doomscrolling won’t help
Two variants:

#### WHY full (shown once per run)
**Condition**
- `whyShownFull == false`

**Content**
- Short tailored card based on `rootCause` (1 screen, concise).

**Buttons**
- **Close app**
- **Show me one option** → ALTS
- **Skip help — let me doomscroll** → timer (F2), `skipStreak++`

**After**
- set `whyShownFull = true`
- set `helpStep = ALTS` *(once user proceeds)*

#### WHY short (repeatable)
**Condition**
- `whyShownFull == true`

**Content**
- 1–2 line reminder tailored to `rootCause` (or generic if needed).

**Buttons**
- **Close app**
- **Show me one option** → ALTS
- **Skip help — let me doomscroll** → timer (F2), `skipStreak++`

---

### Help Step: ALTS (F4c) — Alternatives
**Prompt**
- “Try this instead (2 minutes)”

**Content rule**
- Default shows **1 primary alternative** + optional 1 secondary.
- Avoid long lists by default.
- “More options” is optional (collapsed).

**Buttons**
- **Do this now**
- **Close app**
- **Skip help — let me doomscroll** → timer (F2), `skipStreak++`

**On “Do this now”**
- Start alternative flow (outside scope), and close monitored app.

---

## B4) CP4+ (Long doomscroll phase)

### CP4 behavior
- If `rootCause == null`:
  - Show **CAUSE** again with stronger framing (“This is turning into a loop…”), still skippable.
- If `rootCause != null`:
  - Show **WHY short** with “Show one option” CTA (ALTS) and escape actions.

### CP5 behavior
- If `rootCause == null`:
  - Default into **CAUSE** again (still skippable).
- If known:
  - Show **ALTS** (one primary option) + 1-line WHY reminder.

### CP6+ behavior (keep minimal; avoid menu fatigue)
- Trap apps: always show purpose reminder line.
- Show only:
  - a 1-line WHY reminder (tailored if possible),
  - and the two main actions.

**Buttons**
1) **Close app**
2) **Set another timer** *(very short presets recommended)*
3) Small link: **Help me choose** → opens CAUSE (if rootCause unknown) or ALTS (if known)

---

## Escalation levers (non-blocking)
To help users stop during long doomscrolling without adding endless screens:
- **Timer presets shrink after CP3**
  - Example: CP1/Entry: 1–10m
  - CP2: 30s–5m
  - CP3+: 15–60s defaults (still user-controlled)
- Optional (strong, but not required): after `skipStreak >= 2`,
  - “Skip help — let me doomscroll” becomes **press-and-hold** confirmation.

---

# Purpose Reminders (Trap Apps)
- Purpose is captured **once per run** (entry timer screen).
- Purpose is shown prominently at **every checkpoint**:
  - “Are you still here for: {purpose}?”
- Purpose is never re-collected unless:
  - purpose was not captured due to an error, or
  - user explicitly edits it (optional enhancement).

---

# Copy / Label Notes
- Avoid “Continue” (feels like “next screen”).
- Prefer:
  - “Use app” (entry)
  - “Set another timer” (checkpoint)
  - “Skip help — let me doomscroll” (tertiary)

---

# Future / Optional Feature: Mirror Mode (Front Camera) — NOT REQUIRED IN v1
## Concept
During Pause/Breath (F1), show a subtle front-camera self-view (“mirror”) with the breathing ring overlay to increase self-awareness.

## Requirements (future)
- Off by default.
- User-controlled setting: `Mirror Mode` toggle.
- Clear privacy copy: processed locally; not stored; no upload.
- Camera permission request must occur in Settings onboarding, not during a critical interruption.

## v1 status
- **Not implemented in v1**
- Only documented here for future iteration.

---

# Mermaid Flow (high level)

```mermaid
flowchart TD
  A[Monitored App Opens] --> B{Quick Task available?}
  B -- Yes --> QT[Quick Task Lane]
  B -- No --> P[Pause/Breath F1]
  QT -->|Accept| R[Return to App (QT active)]
  QT -->|Decline| P

  P -->|Close| X[Exit App]
  P -->|Use app| T[Timer F2 (+ Purpose F3 if trap app)]
  T -->|Start| R2[Return to App (Timer active)]
  R2 --> C{Timer expires & app still foreground?}
  C -- No --> End[No checkpoint]
  C -- Yes --> CP1[Checkpoint CP1/CP2/CP3...]
  CP1 -->|Close| X
  CP1 -->|Set another timer| T
  CP1 -->|Help| H[Help Ladder (CAUSE/WHY/ALTS)]
  H -->|Skip help| T
  H -->|Close| X
  H -->|Do alternative| X