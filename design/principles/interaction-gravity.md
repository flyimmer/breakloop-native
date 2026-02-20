# Interaction Gravity Specification  
**BreakLoop — Phase B → Phase C Lock**

## Scope

This specification applies **only** to:
- Conscious interruption flows
- App interception moments
- Time-sensitive, vulnerable decision points

This specification does **not** apply to:
- Retrospective insights
- Account, settings, or configuration screens

Those areas follow standard product interaction patterns and are
out of scope for interaction gravity.


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
- Behavior is never manipulated
- UI decisions are consistent and scalable

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
- Cause selection (e.g. “Why Instagram?”)
- Emotional labeling
- Awareness prompts
- Context framing

**Rules**
- Content may be vertically centered or upper-mid
- No bottom-anchored primary CTA
- Even visual weight across options
- Generous spacing
- Calm, non-urgent language

**Forbidden**
- Sticky bottom actions
- Time pressure
- Strong contrast on choices
- Language implying obligation

---

### B. Grounded Transition  
*(Redirecting behavior calmly)*

**User state**
- The user is ready to do something else
- A concrete action will redirect behavior
- Thumb reach and decisiveness matter

**Allowed use cases**
- “See Alternatives”
- Choosing an alternative activity
- Entering an intervention

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
*(Explicitly choosing compulsion)*

**User state**
- The user chooses to proceed despite reflection
- This is an exit, not a goal

**Allowed use cases**
- “I really need to use it”
- “Ignore & Continue”

**Rules**
- Visually present but low energy
- Reduced contrast or emphasis
- Not bottom-primary
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
*(Physiological downshift, not decision-making)*

**User state**
- Nervous system regulation
- No choice expected

**Rules**
- Single focal element
- Centered visual gravity
- Minimal interaction
- No bottom CTAs

**Note**
Regulation anchors are exempt from decision gravity rules.

---

## 4. Mixed-Gravity Screens

Some screens contain multiple user states.

### Rule

> Each zone must obey its own gravity mode.  
> Gravity modes must not overlap or compete.

**Example**
- Reflection zone → Reflective Float
- Transition zone → Grounded Transition
- Override zone → Heavy Override

Visual separation (spacing, surfaces, dividers) must clearly indicate zone boundaries.

---

## 5. Canonical Reference Screens

The following screens are **authoritative references** for this specification.  
They live in `/design/references/gravity/`.

### Why Instagram?
Mixed gravity: Reflective Float + Grounded Transition + Heavy Override  
Reference: `why-instagram.png`

### Countdown / Take a Breath
Regulation Anchor (centered, non-decisional)  
Reference: `countdown.png`

### Quick Task Confirmation (Exception Gate)

This screen represents an **explicit exception path** within the conscious
interruption flow.

- **Gravity:** Grounded Transition (exception path)
- **User intent:** Bypass the full conscious process for an urgent need
- **Behavioral posture:** Allow, but do not encourage

Rules:
- The screen must be **visually constrained** (dialog or compact sheet)
- It must feel **slightly heavy**, not fast or convenient
- The Quick Task action must not feel easier or more attractive than the
  conscious process
- No reward framing, no celebratory language, no visual delight
- Both options must be clearly available and honest

The purpose of this screen is to introduce **ethical friction**, not efficiency.

**Important:**  
Exception paths must be visually muted and must never feel like the preferred
choice.

### Alternatives — Discover
Grounded Transition with Heavy Override  
Reference: `alternatives-discover.png`

### Alternatives — AI For You (Assisted Reflection)

Although this tab shares the Alternatives screen structure, it represents a
distinct **user intent** and therefore applies a different gravity treatment.

- **Gravity:** Reflective Float (assisted sourcing)
- **User intent:** Exploration without commitment
- **Behavioral posture:** Suggest, do not steer

Rules:
- “Plan this activity” must be clearly recognizable as an action
- It must feel **optional**, not directional
- Use a **tertiary / ghost affordance**
- No urgency cues, no primacy, no visual “best choice”
- Cards should feel safe to browse and safe to leave

This tab must feel like a shelf of ideas, not a recommendation engine.

**Important:**  
Although the component is shared with other tabs, gravity is applied **per tab
based on intent**, not uniformly across the screen.



### Alternatives — My List (Assisted Reflection)

This screen is classified as **Reflective Float (assisted sourcing)**,  
even when activities are present.

**Reason:**
- User intent is discovery, not decision.
- Multiple sourcing paths (manual, discover, AI) are offered.
- Applying Grounded Transition here would create competing gravity.

Reference: `alternatives-my-list.png`

These are not design inspiration.  
They are behavioral reference points.

---

## 6. Phase B Screen Selection Rule

Only screens representing **pure user states** may be used to define gravity.

**Valid**
- Regulation
- Reflection
- Transition
- Override

**Out of scope (for Phase B)**
- Planning
- Creation
- Forms
- Analytics
- Social or community
- AI configuration

---

## 7. Non-Negotiables

- Gravity may not be chosen arbitrarily
- New gravity modes may not be invented
- Visual polish must obey gravity, not override it
- AI may apply gravity rules but may not reinterpret them
- Exception paths (e.g. Quick Task) and exit confirmations must be visually muted and must not introduce reward framing


## 8. Review Requirement

Any new screen or redesign must declare:
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
