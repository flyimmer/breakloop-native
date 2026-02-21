# Interaction Gravity Specification (v1)  
**BreakLoop — UI Behavior & Ethics Contract**  
_Last updated: 2026-02-20_

## Scope

This specification applies **only** to **vulnerable, time‑sensitive decision moments**, including:
- **Interception / intervention surfaces** (Breathing → Set Intention → Checkpoints)
- **Support ladder** surfaces (user‑requested support during a checkpoint)
- **Hard Break** enforcement surfaces (Reset Break) and **Emergency Unlock** chooser
- **Post‑Quick‑Task** “choice” surface (when the app returns and you ask what they want to do next)

This specification does **not** apply to:
- Settings / configuration screens (including monitored app setup)
- Analytics / history / insights
- General browsing in the main app (non‑urgent contexts)

**Note:** The **Alternatives** tab is *mostly* out of scope.  
Only “do‑this‑now” moments inside Alternatives (when the user is choosing an activity right now) should follow gravity rules.

---

## 0. Purpose

This document defines **interaction gravity** in BreakLoop.

Interaction gravity governs:
- Where attention rests
- Where actions are placed
- How much pressure a screen applies

Gravity is **not visual style**.  
Gravity is *behavioral ethics encoded in layout*.

The purpose of this spec is to ensure that:
- Vulnerable moments are respected
- The user is never manipulated
- UI decisions stay consistent as the product scales

---

## 1. Core Principle

> **Gravity must match the user’s internal state, not the app’s goal.**

A screen may contain multiple gravity zones.  
Each zone must obey **exactly one gravity mode**.

Gravity modes must **never compete**.

---

## 2. Gravity Modes (Authoritative)

BreakLoop defines three primary gravity modes  
and one special case used during regulation.

---

### A. Reflective Float  
*(Reflection without commitment)*

**User state**
- The user is noticing or naming their experience
- No irreversible choice is being made
- Psychological safety > efficiency

**Allowed use cases**
- Purpose selection (first‑time or “Change purpose”)
- Trigger selection (“What’s driving this?”)
- Awareness prompts (“Are you still here for … ?”)

**Rules**
- Content may be vertically centered or upper‑mid
- No bottom‑anchored primary CTA
- Even visual weight across options
- Generous spacing
- Calm, non‑urgent language

**Forbidden**
- Sticky bottom actions
- Time pressure
- Strong contrast on choices
- Language implying obligation

---

### B. Grounded Transition  
*(Redirecting behavior calmly)*

**User state**
- The user is ready to do something next
- A concrete action will redirect behavior
- Thumb reach and decisiveness matter

**Allowed use cases**
- “Close app now”
- “Set another timer”
- “Open Alternatives (tab)”
- “Start {App}” after selecting a timebox

**Rules**
- One clear primary action
- Primary action anchored to bottom
- Secondary actions visually subordinate
- Calm but decisive presence
- Reachable by thumb

**Forbidden**
- Centered primary actions
- Multiple competing CTAs
- Urgency language
- Celebratory or playful motion

---

### C. Heavy Override  
*(Explicitly choosing compulsion / exception path)*

**User state**
- The user chooses to proceed despite reflection
- This is an exit hatch, not a goal

**Allowed use cases**
- “Skip help — let me doomscroll”
- “Emergency unlock”
- “Ignore & continue”

**Rules**
- Visually present but low‑energy
- Reduced contrast / emphasis
- Not bottom‑primary
- No elevation or animation
- Neutral, honest language

**Forbidden**
- Hiding the option
- Framing as success or relief
- Making it visually attractive
- Gamification or reward cues

---

## 3. Regulation Anchor (Special Case)

### Regulation Anchor  
*(Physiological downshift, not decision‑making)*

**User state**
- Nervous system regulation
- No choice expected

**Rules**
- Single focal element
- Centered visual gravity
- Minimal interaction
- No bottom CTAs until the regulation phase completes

**Note**
Regulation anchors are exempt from decision gravity rules.

---

## 4. Mixed‑Gravity Screens

Some screens contain multiple user states.

### Rule

> Each zone must obey its own gravity mode.  
> Gravity modes must not overlap or compete.

**Example**
- Reflection zone → Reflective Float
- Transition zone → Grounded Transition
- Override zone → Heavy Override

Visual separation (spacing, dividers, surfaces) must clearly indicate zone boundaries.

---

## 5. Screen → Gravity Map (v1)

This table is the practical contract: every interception surface must declare gravity.

| Surface | Primary user state | Gravity mode(s) | Notes (zone split / CTAs) |
|---|---|---|---|
| **Breathing / Pause** | regulate | Regulation Anchor → Grounded Transition | Buttons hidden during breathing phase; once revealed: “Close app now” (primary), “Continue” (secondary) |
| **Set Intention — Purpose Picker (first time)** | reflect | Reflective Float | 2×3 icon grid; no sticky bottom primary except “Continue” (allowed only if screen is clearly “step 1 of 2”) |
| **Set Intention — Fast Lane Entry (returning)** | plan + commit | Mixed: Reflective Float (purpose line) + Grounded Transition (timebox + Start) | “Are you here for: X?” + “Change purpose” is reflective; timer selection + “Start {App}” is grounded |
| **Set Intention — Timebox** | commit | Grounded Transition | Timer selection can be mid‑screen; “Start {App}” anchored bottom as sole primary |
| **Checkpoint CP1/CP2** | notice + decide | Mixed | Reflection: “Time’s up” + purpose reminder. Transition: “Close app” (primary) + “Set another timer”. Override: “I’m stuck — help me” can be tertiary link (not primary) |
| **Checkpoint CP3 (cap / steady state)** | notice + decide | Mixed | Keep minimal; no automatic trigger/why surfaces. “Help me” opens Support ladder (Reflective Float) |
| **Checkpoint CP4 (Hard Break warning only)** | notice + prepare | Mixed, but *content must stay minimal* | Warning banner is informational (reflective). Avoid stacking extra content (no micro‑why here by default) |
| **Hard Break (Reset Break)** | forced pause | Grounded Transition + Heavy Override | Countdown is neutral. Primary action: “Close app / Go Home”. “Emergency unlock” exists but is visually muted. **Do not show escape quotas on this screen** |
| **Emergency Unlock chooser** | exception decision | Heavy Override (list) + Grounded Transition (confirm) | Present options plainly; no reward. It’s OK to show availability here (counts/quotas) |
| **Support ladder — Trigger select** | reflect | Reflective Float | Optional, user‑initiated only |
| **Support ladder — Micro‑WHY** | reflect + decide | Reflective Float + Grounded Transition | Keep micro‑WHY short; primary action can be “Close app now”; secondary “Set another timer”; link to Alternatives |
| **Support ladder — Go to Alternatives** | transition | Grounded Transition | Treat as redirect action; avoid heavy copy blocks |
| **Post‑Quick‑Task choice** | decide | Grounded Transition + Heavy Override | Keep dialog compact; Quick Task is an exception path and must not feel easier than conscious flow |

---

## 6. Canonical Reference Screens (to maintain)

The following screens are **authoritative references** for this specification.  
They should live in `/design/references/gravity/` and be kept current.

Suggested canonical set for v1:
- `breathing-regulation.png`
- `set-intention-purpose-picker.png`
- `set-intention-fast-lane.png`
- `checkpoint-cp2.png`
- `checkpoint-cp4-warning.png`
- `hardbreak-reset-break.png`
- `emergency-unlock-chooser.png`
- `support-trigger-select.png`
- `support-micro-why.png`
- `post-quick-task-choice.png`

These are not “inspiration”.  
They are behavioral reference points.

---

## 7. Non‑Negotiables

- Gravity may not be chosen arbitrarily
- New gravity modes may not be invented
- Visual polish must obey gravity, not override it
- Exception paths (Quick Task, Emergency unlock, Skip help) must be **visually muted** and must not introduce reward framing
- Do not “promote” escape hatches by surfacing quota counts on primary block screens (Hard Break screen)

---

## 8. Review Requirement

Any new interception screen or redesign must declare:
- Which gravity mode(s) it uses
- Where gravity zones begin and end

If this cannot be stated clearly, the screen is invalid.

---

## 9. Purpose Reminder

BreakLoop does not optimize for:
- Engagement
- Conversion
- Retention in the moment

BreakLoop optimizes for:

> **A user feeling respected during a vulnerable pause.**

Interaction gravity is how that respect is enforced.
