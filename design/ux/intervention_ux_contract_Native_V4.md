# intervention_ux_contract_Native_V4.md — UI Contract (Android Native) — v4

This document is the **UI-level contract** for all user-facing surfaces involved in:
- Quick Task + Post‑Quick‑Task (native lane, kept as implemented)
- Intervention flow (Pause → Set Intention (Fast Lane / Timebox) → Checkpoints)
- **Support ladder** (opt‑in help: Trigger → Micro‑WHY → Alternatives)
- Hard Break + Emergency Unlock

> Runtime/logic details live in `flow_Native_V4.md`.  
> If these documents conflict on UI copy/interaction, **this UX contract wins**.

---

## 0) Core concept: two paths

### 0.1 Checkpoint ladder (default path)
Goal: break the infinite loop with **predictable, escalating friction**.
- CP1 → CP2 → CP3 → (CP3+ steady state)
- If **Hard Break enabled for this app**: CP4 warns, CP5 enforces.

### 0.2 Support ladder (opt‑in path)
Goal: help the user reflect **only when they ask**, then route to Alternatives.
- Enter from checkpoints via **“I’m stuck — help me”**
- Steps: **Trigger picker → Micro‑WHY → Open Alternatives**
- User can **exit at any step** and return to the checkpoint.

---

## 1) Global UI rules

- **Full-screen, single-focus surfaces** (overlay). Avoid stacked modals.
- **One job per screen.** Checkpoint screens are decision points, not reading pages.
- **Primary action is visually dominant** when present (“Close app now”).
- **Any “keep using” path must require setting an intention timer**  
  (exception: Post‑Quick‑Task “use more” stays light, matching current native behavior).
- **Manipulated (feed) apps** enforce Purpose capture before starting `t_intention`.
- **Hard Break main screen shows no quota numbers** (avoid advertising bypass).
- **No automatic Trigger / WHY screens.** Support content opens only via explicit user action.

---

## 2) Settings dependency: “Manipulated app” (Purpose-required)

In Settings → Monitored Apps:
- Toggle per app: **“Purpose required (feed/social/video)”**.
- Default presets may mark common feed apps as enabled, but the user can override.

This toggle controls:
- Whether Purpose chips/input are mandatory on Set Intention screens
- Whether a Purpose reminder line appears on checkpoints

---

## 3) Quick Task surfaces (native lane — keep current implementation)

### 3.1 Quick Task Offering (Dialog / Overlay)
**When shown:** Decision Gate chooses Quick Task (quota available for this app).

**Actions**
- Primary: **Quick Task**
- Secondary: **Start conscious process**
- Close (X): **Close / Go Home**

**Behavior**
- Quick Task → start `t_quickTask(app)` and return to app
- Start conscious process → enters Breathing (F1)
- Close → navigate Home
- Back button: disabled or treated as Close (match existing behavior)

---

### 3.2 Post‑Quick‑Task dialog
**When shown:** `t_quickTask(app)` expires while the app is foreground.

**Actions**
- Primary: **Close {App}**
- Secondary: **I want to use {App} more**

**Behavior**
- Close {App} → navigate Home
- Use more → dismiss dialog and return to app (no forced intention timer)
- If user leaves without choosing → abandon; do not re-show later

---

## 4) Intervention (default path)

### 4.1 Pause / Breathing (F1)
**When shown:** entry into Intervention lane.

**Animation**
- Looping inhale/exhale, ~4s each.
- Buttons hidden during first full cycle; then revealed while breathing continues.

**Copy**
- Center: “Breathe In” / “Breathe Out”
- Optional microcopy (1 line): “Reset the impulse.”

**Actions (after first cycle)**
- Primary (dominant): **I do not want to open {App} anymore**
- Secondary: **Continue to {App}**

**Behavior**
- Primary → exit (go Home)
- Secondary → Set Intention (Fast Lane / Timebox)

---

### 4.2 Set Intention — Fast Lane Entry (returning users, purpose-required apps)

**When shown:** after Breathing (F1) or from Support ladder “Continue using instead”, *and* the app is marked **Purpose required**, *and* a saved `lastPurpose(app)` exists.

**Header**
- Title: “Plan this session”
- Subtitle: “For {App}”

**Purpose line**
- Copy: **“Are you here for: {purpose}?”**
- Link: **“Change purpose”** (opens Purpose Picker; see §4.3)

**Timer selection**
- Show timebox presets (respecting progressive disabling rules).
- **No default pre-selected timer.** User must pick one.

**Actions**
- Primary: **Start {App}** (enabled only after timer selected)
- Secondary: **Cancel & Close App**
- Close (X): same as Cancel

**Behavior**
- Start → sets `t_intention_until(app)` and closes surface → return to app.
- Change purpose → opens Purpose Picker (Recents + grid); on selection returns here with updated purpose.

**Persistence**
- Save selection as `lastPurpose(app)` and update `recentPurposes(app)` (max 2).

---

### 4.3 Set Intention — Purpose Picker (F3)

**When shown:**
- First time for a Purpose-required app (no `lastPurpose(app)` yet)
- User taps “Change purpose” from Fast Lane Entry
- User taps “Change purpose” from a checkpoint reminder (optional)

**Header**
- Title: “Set purpose”
- Subtitle: “For {App}”

**Recents (Option B)**
- If available, show up to **2 recent purposes** for this app as quick chips at the top.

**Purpose grid (6 only)**
Use **icon + short label** buttons (prefer 2×3):

1) 💬 Messages  
2) 🔔 Notifications  
3) 🔍 Search  
4) ➕ Post / Create  
5) 📌 Specific thing  
6) ⋯ Other

**Other input**
- If “Other” selected: show a 1‑line text field (optional in v1).
- Display label: if text provided use it; else “Other”.

**Actions**
- Primary: **Continue** (enabled only after purpose selected)
- Secondary: **Cancel & Close App**
- Close (X): same as Cancel

**Behavior**
- Continue → routes back to the caller:
  - If first time entry: proceed to **Timebox** (§4.4)
  - If called from Fast Lane Entry: return to Fast Lane Entry with updated purpose
- Cancel → exit to Home.

---

### 4.4 Set Intention — Timebox (F2)

**When shown:**
- Non-purpose apps (directly after Breathing)
- Purpose-required apps **first time**, after Purpose Picker

**Header**
- Title: “Timebox session”
- Subtitle: “For {App}”
- If purpose exists: show small line “Purpose: {purpose}” with optional link “Change” (opens Purpose Picker).

**Timer presets**
- Presets list; disabled presets visible but greyed out.

**Actions**
- Primary: **Start {App}** (enabled only after timer selected)
- Secondary: **Close app now**




## 5.1 Common checkpoint layout
**Header**
- “Time’s up.”

**Optional purpose reminder (manipulated apps)**
- Single line with question mark:
  - “Still here for: {purpose}?”

**Actions (recommended set)**
- Primary: **I realized it, close the app now**
- Secondary: **Set another timer**
- Tertiary link: **I’m stuck — help me**

> Note: We intentionally do **not** show “WHY” content on checkpoint screens.
> Alternatives are accessed from the Support ladder (or directly in the main app).

---

### 5.2 CP1 / CP2
- CP1 headline: “Time’s up.”
- CP2 headline: “Time’s up (again).”
- Same button set as above.

---

### 5.3 CP3 (escalation, but still minimal)
Headline suggestion:
- “You’ve gone past your plan twice.”

Keep CP3 screen minimal (no extra cards, no “why” link/snippet).

Buttons:
- Close / Set timer / I’m stuck — help me

---

### 5.4 CP4 (Hard Break warning) — only if Hard Break enabled for this app
CP4’s single job: warn that next time a hard break will happen.

**Banner (must)**
- “Next time: **10‑minute Reset Break**”
- Subline (small): “Hard Break enabled for {App}”

**Body**
- No long text.
- Prefer omitting the purpose line here to avoid overload (optional).

**Actions**
- Primary: Close app now
- Secondary: Set another timer
- Tertiary link: I’m stuck — help me (optional, if not visually noisy)

---

### 5.5 CP5 (Hard Break enforce)
No checkpoint shell. Immediately show **Hard Break main screen**.

---

## 6) Support ladder (opt‑in)

Support ladder is entered only by explicit user action (usually from CP3/CP4).

### 6.1 S1 — Trigger picker (Root cause)
**Title**
- “What’s driving you right now?”

**Options**
- Boredom
- Stress / Anxiety
- Loneliness
- Fatigue
- Self‑doubt
- No clear goal
- Other (1‑line optional input label)

**Actions**
- Primary: **Continue**
- Secondary: **Close app now**
- Tertiary link: **Continue using instead** → opens **Set Intention** (Fast Lane Entry if lastPurpose exists; otherwise Purpose Picker → Timebox), then returns to app
- X / Back: returns to the originating checkpoint screen

---

### 6.2 S2 — Micro‑WHY (skimmable)
**Title**
- “Why scrolling won’t help”

**Body**
- Use `trigger_paragraphs_v3.md` Micro‑WHY format:
  - 1 sentence + 2 bullets
- No long paragraphs.

**Actions**
- Primary: **Open alternatives**
- Secondary: **Close app now**
- Tertiary link: **Continue using instead** → Set Intention (Fast Lane / Timebox)
- Back: returns to Trigger picker
- X: returns to checkpoint

---

### 6.3 Routing to Alternatives
When user taps **Open alternatives**:
- If trigger is one of the 6 predefined:
  - Navigate to main app: **Alternatives → Discover**
  - Group-by = **Triggers**
  - Scroll/highlight the chosen trigger section
- If trigger is **Other**:
  - Navigate to main app: **Alternatives → My List**
  - Do not show “add an activity…” banners; user can add normally from My List.

Return behavior:
- Provide an in-app “Back to checkpoint” top bar only when launched from intervention (optional; recommended for clarity).

---

## 7) Hard Break (Reset Break)

### 7.1 Hard Break main screen (no quota numbers)
**When shown:** `hardBreakUntil(app) > now` and the monitored app is opened.

**Content**
- Title: “Reset Break”
- Copy (short): “Take a 10‑minute reset to break the loop.”
- Countdown timer (prominent)

**Actions**
- Primary: “Emergency Unlock”
- Secondary: “Close app / Go Home”
- Optional small link: “Why this break?”

**Important**
- No quota numbers on this screen.

---

### 7.2 Emergency Unlock chooser (quota details appear here)
**When shown:** user taps Emergency Unlock.

Show options (disabled with explanation if unavailable):
1) Weekly Override (per app) — 1/week
2) Face‑Down Challenge — 1/day global
3) Emergency Pass — global balance; max 2 uses/day global

After choosing an unlock method:
- require **Emergency Intention Timer (5–30 min)** before returning to app

---

### 7.3 Face‑Down Challenge screen
- Instruction: “Place phone face‑down for 2 minutes.”
- Progress ring + countdown.
- If phone lifted: pause/reset (strict).

On success → Emergency Intention Timer.

---

### 7.4 Emergency Intention Timer (Hard Break escape)
- Presets: 5 / 10 / 15 / 30 minutes
- Manipulated apps may enforce purpose if not already captured.

When emergency timer ends and app still foreground:
- Hard Break resumes immediately.

---

## 8) Logging (recommended)
Log at least:
- checkpointCount changes
- Hard Break enabled/disabled per app
- Hard Break warning shown (CP4), Hard Break started (CP5)
- Trigger selection (including Other label)
- Support ladder exits (close vs continue)
- Emergency unlock method used
