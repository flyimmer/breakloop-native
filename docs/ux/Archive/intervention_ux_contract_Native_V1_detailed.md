# intervention_ux_contract_Native_V1.md — UI Contract (Android Native)

This document is the **UI-level contract** for all user-facing surfaces involved in:
- Quick Task + Post‑Quick‑Task (native lane, kept as implemented)
- New Intervention flow (Pause → Timer → Checkpoints → Help Ladder)
- Hard Break + Emergency Unlock

> Runtime/logic details live in `flow_Native_V1.md`.  
> If these documents conflict on UI copy/interaction, **this UX contract wins**.

---

## 0) Global UI rules

- **Full-screen, single-focus surfaces** (overlay). Avoid stacked modals.
- **One job per screen**: checkpoint screens are decision points, not reading pages.
- **Primary action is visually dominant** when present (“close app now”).
- **Any “keep using” path must require an intention timer** (except Post‑Quick‑Task “use more”, which stays light by design).
- **Trap apps** (social/video) enforce Purpose capture before starting `t_intention`.
- **Hard Break main screen shows no quota numbers** (avoid advertising bypass).

---

## 1) Quick Task surfaces (native lane)

### 1.1 Quick Task Offering (Dialog / Overlay)
**When shown:** Decision Gate chooses Quick Task (quota available for this app).

**Content**
- Title: concise, neutral (existing style OK)
- Short explanation: “Choose a Quick Task or start the conscious process.”

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

### 1.2 Post‑Quick‑Task dialog
**When shown:** `t_quickTask(app)` expires while the app is foreground.

**Actions**
- Primary: **Close {App}**
- Secondary: **I want to use {App} more**

**Behavior**
- Close {App} → navigate Home
- Use more → dismiss dialog and return to app (no extra friction)
- If user leaves without choosing → abandon; do not re-show later

---

## 2) Intervention surfaces (new UX)

### 2.1 Pause / Breathing (F1)
**When shown:** entry into Intervention lane.

**Animation**
- Looping inhale/exhale, ~4s each.
- Buttons hidden during first full cycle; then revealed while breathing continues.

**Copy (center)**
- “Breathe In” → “Breathe Out”
- Optional microcopy under ring (short): “Reset your impulse.”

**Actions (after first cycle)**
- Primary (dominant): **I do not want to open {App} anymore**
- Secondary: **Continue to {App}**

**Behavior**
- Primary → exit (go Home)
- Secondary → Intention Timer (F2)

---

### 2.2 Intention Timer + Purpose (F2/F3)
**When shown:** after user chooses Continue.

**Header**
- “How long do you want to use {App}?”

**Timer presets**
- Show preset chips/buttons.
- Disabled presets remain visible but greyed out and not selectable (per flow rules).

**Trap apps: Purpose (mandatory, inline)**
- Title: “What are you here for?”
- Purpose chips (example set): Check messages / Reply / Post / Search / Check something / Other
- If Other: optional 1‑line input.

**Rule**
- Start is disabled until purpose chip selected.
- Purpose reminder later always ends with a question mark:
  - “Still here for: {purpose}?”

**Actions**
- Primary: **Start {App}** (starts `t_intention`)
- Secondary: **Close app now**

---

## 3) Checkpoints (CP screens)

### Common checkpoint rules
- No long paragraphs on CP screens.
- If a “why” explanation is needed, route to the dedicated WHY screen.
- Trap apps may show the purpose reminder as a single line with **question mark**:
  - “Still here for: {purpose}?”

**Standard buttons (recommended wording)**
- Primary: **I realized it, close the app now**
- Secondary: **Show alternatives**
- Tertiary: **Set another timer**

(Visual hierarchy: 1 strong primary, 1 medium secondary, 1 low-emphasis tertiary.)

---

### 3.1 CP1 / CP2 (light checkpoints)
**Headline**
- CP1: “Time’s up.”
- CP2: “Time’s up (again).”

**Body**
- Trap apps: purpose question line (optional but recommended)
- Non-trap: no extra blocks

**Actions**
- Close / alternatives / set timer

---

### 3.2 CP3 (escalation checkpoint — minimal shell)
**Headline**
- “You’ve gone past your plan twice.”

**Body**
- Trap apps: “Still here for: {purpose}?”
- **No** “Why:” snippet.
- **No** quote card.
- **No** “Read why” link.

**Escalation behind CP3**
When CP3 is reached, the system may open help content:
- If `rootCause == null` → open **Root Cause (CAUSE)** with timer-over context title after a short 600–900ms bridge.
- Else if `whyShownFull == false` → open **WHY (full)** once.
- Else stay on CP3 shell.

**Actions**
- Close / alternatives / set timer

---

### 3.3 CP4 (Hard Break warning checkpoint)
**Only when Hard Break is enabled for this app.**

**Purpose**
- CP4’s job is one thing: warn “Next time hard break”.

**Top warning banner (must)**
- “Next time: **10‑minute Reset Break**”
- Subline: “Hard Break enabled for {App}”

**Body**
- No “Still here” header.
- No WHY snippet/link.
- No ladder auto-open on CP4.
- (Optional) do NOT show purpose line at CP4 to avoid overload.

**Actions**
- Primary: Close app now
- Secondary: Set another timer
- Optional link-style: Show alternatives (trigger-gated)

---

## 4) Root Cause (Trigger) screen (CAUSE)
**When shown:**
- escalation path (typically CP3) when `rootCause` is unknown
- user explicitly chooses help

**Title variants**
- If shown due to timer expiry:  
  “Time’s up — let’s figure out what’s driving this”
- Otherwise:  
  “What’s driving this?”

**Subtitle**
- “Naming it puts you back in control.”

**Options**
- Boredom
- Anxiety/Stress
- Loneliness
- Fatigue
- Self‑doubt
- No clear goal

**Actions**
- Back (optional)
- “Skip help — let me doomscroll” (returns to timer; increments skipStreak)

---

## 5) WHY screen (full content)
**When shown:**
- after root cause selection (first time in a run), or
- ladder opens WHY because `whyShownFull == false`

**Title**
- “Scrolling makes {trigger} worse” (preferred)

**Body**
- Use `trigger_paragraphs_v2.md` line-broken into 2–4 short blocks for readability.
- Long variant allowed on first show.

**Actions**
- Primary: **I realized it, close the app now**
- Secondary: **Support me, show me alternative activities** → deep-link to Alternatives tab filtered to trigger
- Tertiary: **Set another timer**

After first full show: set `whyShownFull = true`.

---

## 6) Alternatives navigation (from WHY and checkpoints)

**Rule**
- Do not show a long alternative list inside intervention overlays.
- Always deep-link to the main app **Alternatives tab**, filtered to the trigger category.

**Routing**
- From CP screens: “Show alternatives”
  - If trigger known → open Alternatives category detail
  - If unknown → CAUSE first; after selection:
    - show WHY full once if not yet shown (optional but recommended per ladder rule)
    - then open Alternatives filtered category

**Return**
- User can switch back to the monitored app normally.
- If no `t_intention` active for that app, next entry goes through Decision Gate again.

---

## 7) Hard Break (Reset Break)

### 7.1 Hard Break main screen (no quotas)
**When shown:** `hardBreakUntil(app) > now` and the monitored app is opened.

**Content**
- Title: “Reset Break”
- Copy: “You’ve been in {App} for a while. This break helps you reset.”
- Countdown timer (prominent)

**Actions**
- Primary: “Emergency Unlock”
- Secondary: “Close app / Go Home”
- Optional small link: “Why this break?”

**Important**
- No quota numbers on this screen. (No “weekly override available”, no pass counts, etc.)

---

### 7.2 Emergency Unlock chooser (quota details appear here)
**When shown:** user taps Emergency Unlock.

Show options (disabled with explanation if unavailable):
1) Weekly Override (per app) — 1/week
2) Face‑Down Challenge — 1/day global
3) Emergency Pass — global balance; max 2 uses/day global

Each option shows:
- availability status (Available / Used)
- quota detail (only on this chooser screen)

After choosing an unlock method:
- require **Emergency Intention Timer (5–30 min)** before returning to app

---

### 7.3 Face‑Down Challenge screen
- Instruction: “Place phone face-down for 2 minutes.”
- Progress ring + countdown.
- If phone lifted: pause/reset (strict).

On success → Emergency Intention Timer.

---

### 7.4 Emergency Intention Timer (Hard Break escape)
- Presets: 5 / 10 / 15 / 30 minutes (configurable later)
- Trap apps may enforce purpose if not already captured.

When emergency timer ends and app still foreground:
- Hard Break resumes immediately.

---

## 8) Logging (recommended)
Log at least:
- checkpointCount changes
- trigger selection
- whyShownFull shown
- hard break warning shown, hard break started
- emergency unlock method used
