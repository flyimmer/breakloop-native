# flow.md — BreakLoop UX Flow (v1)

This document defines the **user-facing flow** for **configured monitored apps** in BreakLoop, including the **Quick Task lane** and the **progressive Intervention lane** (Pause → Timer → Checkpoints → Help Ladder).

> Note: **Mirror Mode (front camera during Pause)** is documented as a **future optional setting** and is **NOT required for v1**.

---

## 0) Scope and principles

### Scope
- The flow triggers **only** for apps the user configured as “Monitored apps”.
- Two lanes can handle a monitored app opening:
  1) **Quick Task lane** (bounded “allowed use”)
  2) **Intervention lane** (progressive friction + deep help)

### Principles
- **Non-blocking**: the user can always proceed.
- **Progressive friction**: minimal at entry, stronger when repeated overruns occur.
- **Short by default**: don’t over-teach; escalate only when user behavior signals doomscrolling.
- Avoid the word **“Continue”** (feels like “next UI”). Use:
  - “Use app”, “Set another timer”, “Skip help — let me doomscroll”, “Get help to stop”.

---

## 1) Definitions

### App categories
- **Trap apps**: social/video/infinite-feed apps.
  - Require **Purpose** capture **once per run** (chips + optional short text).
- **Other monitored apps**: all other configured apps.
  - No purpose capture (keep it simple).

### Run
A **run** is a continuous session in one monitored app.
- Starts when the monitored app enters foreground and BreakLoop triggers.
- Ends when user exits/closes the app via BreakLoop, or app leaves foreground long enough to be considered a new session.

### Checkpoints (CP)
A checkpoint appears when the current intention timer expires and the monitored app is still in foreground:
- CP1 = first overrun
- CP2 = second overrun
- CP3 = third overrun (escalation point)
- CP4+ = long doomscroll phase

---

## 2) Minimal state (per run)

- `isTrapApp: bool`
- `purpose: {chipId, text?} | null`  (trap apps only)
- `checkpointCount: int`
- `rootCause: string | null`
- `whyShownFull: bool`  (full WHY shown at most once per run)
- `helpStep: NONE | CAUSE | WHY | ALTS`
- `skipStreak: int`  (counts consecutive “Skip help — let me doomscroll” presses after CP3)

---

## 3) High-level flow (Quick Task → Intervention)

```mermaid
flowchart TD
  A[Monitored App Opens] --> D{Quick Task available?}
  D -- Yes --> QT[Quick Task UI]
  QT -->|Accept| R1[Return to app (QT active)]
  QT -->|Decline| P[Pause/Breath (F1)]

  D -- No --> P

  P -->|Close app| X[Exit monitored app]
  P -->|Use app| T[Timer (F2)\n+ Purpose inline (F3 for trap apps)]
  T -->|Start timer| R2[Return to app (Timer active)]
  R2 --> C{Timer expires\n& app still foreground?}
  C -- No --> End[No checkpoint]
  C -- Yes --> CP[Checkpoint (CP1/CP2/CP3/...)]
  CP -->|Close app| X
  CP -->|Set another timer| T
  CP -->|Help Ladder| H[CAUSE/WHY/ALTS]
  H -->|Skip help| T
  H -->|Close app| X
  H -->|Do alternative| X
```

---

# 4) Intervention lane — detailed

## 4.1 Entry

### Step F1 — Pause/Breath
**Purpose**: snap user out of autopilot; calm impulse.

**Behavior**
- Show breathing/progress animation for ~4–6 seconds.
- **Buttons hidden while breathing**.
- After breathing finishes, reveal:
  - **Close app** (primary)
  - **Use app** (secondary)

**Transitions**
- Close app → exit monitored app
- Use app → Timer

---

### Step F2 — Intention Timer (mandatory to use the app)
**Rule**: If the user proceeds, they must set a timer.

#### Other monitored apps
- Presets (example): 1m / 2m / 5m / 10m
- Buttons: **Start timer**, **Close app**

#### Trap apps (social/video): Purpose inline (F3) on timer screen
**Rule**: no “non-purpose” state. User must choose a purpose before starting timer.

- Section: “What are you here for?”
  - Chips (examples): Reply / Post / Search / Check messages / Check something / Other
  - “Other” → optional 1-line text input (chips + optional text)
- Section: “How long?” timer presets
- Buttons: **Start timer** (enabled only when purpose selected), **Close app**

**Transition**: Start timer → return to monitored app

---

## 4.2 Checkpoints

### Shared rules
- A checkpoint appears when timer ends and the app is still foreground.
- If user chooses to keep using the app:
  - **Must set a new intention timer** (“Set another timer”).

### CP1 — First overrun (light, forgiving)
- Headline: “Time’s up”
- Trap apps (prominent): “Are you still here for: **{purpose}**?”
- Buttons:
  1) **I’m done → Close app** (primary)
  2) **Not yet → Set another timer** (secondary)
  3) **I’m stuck** (optional/tertiary) → Help Ladder CAUSE

### CP2 — Second overrun (stronger)
- Headline: “Still here”
- Trap apps (prominent): “You came for: **{purpose}**. Is that still true?”
- Buttons:
  1) **Close app** (primary)
  2) **Set another timer** (secondary; smaller presets recommended)
  3) **Go deeper** → Help Ladder CAUSE

### CP3 — Third overrun (escalation)
**Goal**: default to deep help, but keep a clear escape.

- Headline: “You’ve gone past your plan twice.”
- Trap apps: “Are you still here for: **{purpose}**?”

**State-based auto-open**
At CP3, auto-open the next help step based on known state:
- If `rootCause == null` → open **CAUSE**
- Else if `whyShownFull == false` → open **WHY (full)**
- Else → open **ALTS**

**Always provide buttons** (on CP3 card or help screen header):
- **Close app**
- **Get help to stop** (if not auto-opened already)
- **Skip help — let me doomscroll** → goes to Timer (F2), increments `skipStreak`

### CP4+ — Long doomscroll phase (minimal, repeatable)
Avoid showing big lists every time. Use the ladder state.

- If `rootCause == null`:
  - Show **CAUSE** again (stronger framing), still skippable.
- If `rootCause != null`:
  - Show **WHY (short)** + CTA “Show one option” → ALTS.
- CP5: if cause known, prefer **ALTS (one primary option)** + 1-line WHY reminder.
- CP6+: keep minimal:
  - Purpose reminder (trap apps)
  - 1-line WHY reminder
  - Buttons: **Close app**, **Set another timer**, small link “Help me choose”

---

# 5) Help Ladder (F4) — systematic, no combinational explosion

## Ladder principle
- The help system is **one linear ladder** controlled by `helpStep`.
- Skipping help never advances the ladder.
- When the user engages, we progress one step at a time:
  - CAUSE → WHY → ALTS

## CAUSE (F4a) — Root cause (chips)
Prompt: “What’s driving this right now?”
- bored / stressed / lonely / avoiding / habit / other
Buttons:
- **Close app**
- **Skip help — let me doomscroll** → Timer (F2), `skipStreak++`
On select:
- set `rootCause`
- set `helpStep = WHY`
- reset `skipStreak = 0`

## WHY (F4b) — Why doomscrolling won’t help
### WHY full (once per run)
Condition: `whyShownFull == false`
- Short tailored card (concise, 1 screen)
Buttons:
- **Close app**
- **Show me one option** → ALTS
- **Skip help — let me doomscroll** → Timer, `skipStreak++`
After showing once: set `whyShownFull = true`

### WHY short (repeatable)
Condition: `whyShownFull == true`
- 1–2 line reminder (tailored)
Buttons:
- **Close app**
- **Show me one option** → ALTS
- **Skip help — let me doomscroll** → Timer, `skipStreak++`

## ALTS (F4c) — Alternatives (small by default)
Prompt: “Try this instead (2 minutes)”
- Default: **1 primary alternative** + optional 1 secondary
- Optional collapsed “More options”
Buttons:
- **Do this now**
- **Close app**
- **Skip help — let me doomscroll** → Timer, `skipStreak++`
On “Do this now”: start alternative flow + exit monitored app

---

## 6) Non-blocking escalation levers (optional)
To help users stop during long doomscrolling without adding endless screens:
- **Shrink timer presets after CP3** (e.g., defaults 15–60s)
- Optional: after `skipStreak >= 2`, “Skip help — let me doomscroll” becomes **press-and-hold**

---

## 7) Future option (NOT required for v1): Mirror Mode (front camera during Pause)
**Idea**
- During Pause/Breath, show a subtle front-camera self-view (“mirror”) with breathing ring overlay to increase self-awareness.

**Constraints**
- Off by default; user-configurable toggle in Settings.
- Clear privacy copy: local only, not stored, not uploaded.
- Camera permission should be requested in Settings/onboarding, not during a critical interruption.

**Status**
- Documented for later iteration; **do not implement in v1**.
