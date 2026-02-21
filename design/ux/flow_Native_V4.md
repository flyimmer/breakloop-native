# flow_Native_V4.md — BreakLoop Runtime Flow (Android Native) — v4

This document defines the **end-to-end, user-visible runtime flow** for **monitored apps** on a **real Android phone**.
It merges:
- **Existing native lanes (keep as implemented):** Quick Task + Post‑Quick‑Task dialog
- **New UX lanes:** Intervention flow + **Checkpoint ladder** + **Support ladder (opt‑in)** + Hard Break (Reset Break)

> UI microcopy, layouts, and per-screen interactions are defined in `intervention_ux_contract_Native_V4.md`.  
> If these documents conflict on UI copy/interaction, **the UX contract wins**.

---

## 0) Scope & invariants

### Applies to
- Apps the user configured as **Monitored**.

### Per‑app scope (important)
All the following are **scoped per monitored app A**:
- `t_intention_until(A)` (intention timer)
- `t_quickTask_until(A)` (quick task timer)
- `n_quickTask_remaining(A)` + its window/bucket metadata
- `hardBreakUntil(A)`, `hardBreakEnabled(A)`
- `purpose(A)` if Purpose-required
- Run context (per run): `checkpointCount(A)`, `rootCause(A)` (optional), etc.

### Hard Break override (highest priority)
If `now < hardBreakUntil(A)`:
- Opening app **A** shows **Hard Break UI only**.
- **No Quick Task**, **no Intervention** while the hard break is active.

### Foreground‑gated expiry (no surprise overlays)
When any timer (Quick Task or Intention) expires for app **A**:
- Act **only** if **A is foreground at the moment of expiry**
- If **A is not foreground**, do nothing; next time **A** enters foreground → Decision Gate again.

### No deferred Post‑Quick‑Task UI
If Post‑Quick‑Task dialog appears and the user leaves without choosing:
- Do **not** re-show later.
- Next entry runs Decision Gate normally.

---

## 1) Decision Gate on monitored‑app entry (per app A)

**Trigger:** app **A** enters foreground and is recognized as Monitored.

Decision priority (highest → lowest):

1) **Hard Break active?**  
   If `now < hardBreakUntil(A)` → show **Hard Break UI**.

2) **Intention active?**  
   If `now < t_intention_until(A)` → **no UI** (allow app use).

3) **Quick Task active?**  
   If `now < t_quickTask_until(A)` → **no UI** (allow app use).

4) **Quick Task quota available?**  
   If `n_quickTask_remaining(A) > 0` → show **Quick Task Offering**.

5) Otherwise → start **Intervention lane** (Breathing / Pause).

> Quick Task is **per app**. QT in Instagram must not suppress TikTok’s flow.

---

## 2) Quick Task lane (native — keep current behavior)

### 2.1 Quick Task Offering (surface)
Actions:
- Quick Task → start `t_quickTask(A)`, decrement `n_quickTask_remaining(A)`, dismiss surface
- Start conscious process → go to Intervention lane (F1 breathing)
- Close (X) → navigate Home / leave app

### 2.2 Quick Task expiry
When `t_quickTask(A)` expires:
- If **A is foreground** → show **Post‑Quick‑Task dialog**
- If **A is not foreground** → silently clear QT state; next entry is a fresh Decision Gate.

### 2.3 Post‑Quick‑Task dialog
Actions:
- Close {App} → navigate Home
- I want to use {App} more → dismiss dialog and return to app (no intention timer)

Leaving without choosing → abandon.

---

## 3) Intervention lane (Checkpoint ladder default)

### 3.1 Entry → Pause/Breathing (F1)
Breathing surface shows; user chooses:
- Exit (go Home)
- Continue → Intention Timer (F2)

### 3.2 Set Intention (F2) — mandatory to continue

To proceed back to app **A**, the user must set an **Intention Timebox** (`t_intention_until(A)`).

#### Non‑manipulated apps (Purpose not required)
- Show **Timebox screen** → user picks a duration → starts `t_intention_until(A)` → dismiss surface → return to app.

#### Manipulated / feed apps (Purpose required)
Use a **Fast Lane Entry** to keep re-entry lightweight while staying conscious.

**First time (no saved purpose for this app yet):**
- **Step 1 — Purpose Picker (F3)** (required): user selects one purpose (or Other).
- **Step 2 — Timebox (F2)**: user selects a duration and starts `t_intention_until(A)`.

**Returning user (saved lastPurpose exists):**
- Show **Fast Lane Entry** screen (single screen):
  - Title: “Plan this session”
  - Purpose line: **“Are you here for: {lastPurpose}?”**
  - Link: “Change purpose” → opens Purpose Picker (with **Recents** + full grid)
  - Timer presets (progressive disabling rules apply; **no auto-selected default**)
  - CTA: “Start {App}” (enabled only after a timer is selected)
- Starting the timer sets `t_intention_until(A)` and returns to app A.

**Purpose Picker (used for first time or Change purpose):**
- Shows up to **2 recent purposes** for this app (if available), then the full 2×3 icon grid:
  - 💬 Messages · 🔔 Notifications · 🔍 Search · ➕ Post/Create · 📌 Specific thing · ⋯ Other
- Selecting a purpose returns to the prior screen (Fast Lane Entry or Timebox) and updates `purpose(A)`.

**Persistence**
- Persist per app: `lastPurpose(A)` and `recentPurposes(A)[max 2]`.
- Within a run, `purpose(A)` defaults to `lastPurpose(A)` but can be changed by the user via “Change purpose”.


Notes:
- Purpose is **required** for purpose-required apps. First time requires explicit selection; later runs default to last purpose.
- Checkpoints show only a **purpose reminder** + optional “Change purpose” entry (no forced re-entry).

### 3.3 While `t_intention(A)` is active
- No overlays for app A.
- Returning to A before expiry remains allowed.
- When timer expires and **A is foreground** → show next checkpoint.

### 3.4 Intention expiry → checkpoint
When `t_intention(A)` expires:
- If **A is foreground** → show checkpoint based on `checkpointCount(A)` and `hardBreakEnabled(A)`.
- If **A is not foreground** → do nothing; next entry is Decision Gate.

---

## 4) Checkpoint ladder rules (per app)

### 4.1 Checkpoint increment rule
`checkpointCount(A)` increments only when:
- `t_intention(A)` expires **AND**
- A is **foreground at expiry**

Mapping:
- CP1: checkpointCount becomes 1
- CP2: becomes 2
- CP3: becomes 3

### 4.2 Late-stage behavior when Hard Break is OFF
If `hardBreakEnabled(A) == false`:
- After CP3, the user enters **CP3+ steady state**:
  - Every further expiry shows the **same CP3 template** (no new CP4/5/6 screens)
  - Timer options remain constrained (see §7)
  - Support ladder remains available via “I’m stuck — help me”

### 4.3 CP4/CP5 only when Hard Break is ON
If `hardBreakEnabled(A) == true`:
- CP4 (checkpointCount becomes 4): show **Hard Break warning screen**
- CP5 (checkpointCount becomes 5): enforce Hard Break immediately

---

## 5) Support ladder (opt‑in, on-demand)

Support ladder is **not automatic**. It opens only when the user taps “I’m stuck — help me”.

### 5.1 Entry points
- From CP screens (recommended from CP3/CP4; allowed from CP1/CP2 as link)

### 5.2 Support ladder steps
- S1 Trigger picker (6 triggers + Other)
- S2 Micro‑WHY (from `trigger_paragraphs_v3.md`)
- Open Alternatives (deep link)

### 5.3 “Continue using” inside support ladder
On any support screen, the user can choose “Continue using instead” which:
- opens **Set Intention** (Fast Lane Entry if lastPurpose exists; otherwise Purpose Picker → Timebox)
- starts a new `t_intention(A)`
- returns to app A

This does not change checkpointCount immediately; checkpointCount only increments on timer expiry.

### 5.4 Trigger routing
- If trigger is one of the 6 predefined → Alternatives → Discover, grouped by Triggers, scrolled to that trigger
- If trigger is Other → Alternatives → My List (no banners/prompts)

---

## 6) Hard Break (Reset Break) — runtime rules

### 6.1 Enablement
Hard Break is user-controlled, premium, **per app**.
Defaults:
- Warn at CP4
- Enforce at CP5
- Duration: 10 minutes

### 6.2 CP4 warning behavior
CP4 must remain a warning checkpoint:
- No automatic support content opens on CP4
- User can still tap “I’m stuck — help me” if you keep the link

### 6.3 Enforced behavior (CP5 and during break)
When Hard Break starts:
- set `hardBreakUntil(A) = now + 10m`
- show Hard Break UI
- any future entry into A during the break shows Hard Break UI only

### 6.4 Emergency unlock
Unlock options:
- Weekly override (per app) 1/week
- Face‑down challenge (global) 1/day
- Emergency pass (global) non-expiring; max 2 uses/day

After successful unlock:
- user must set Emergency Intention Timer (5–30m)
- when that emergency timer expires and A still foreground → Hard Break resumes immediately

---

## 7) Intention timer presets and progressive disabling

Presets: 1 / 5 / 15 / 30 / 45 minutes.

Disable based on `checkpointCount(A)` in the current run:
- 0: all enabled
- 1: disable 45
- 2: disable 30 and 45
- 3+: only 1 and 5 enabled

Stop tightening further after CP3.

---

## 8) Lifecycle / re‑entry semantics (user-facing)

### 8.1 Return before intention expiry
If user leaves app A and returns before `t_intention_until(A)`:
- allow immediate app use (no overlay)
- run context remains valid
- next checkpoint happens only if A is foreground at expiry

### 8.2 Return after intention expiry
If user returns after `t_intention_until(A)` already expired:
- treat as a fresh start
- run Decision Gate again (Hard Break → Quick Task → Intervention)

---

## 9) Screen inventory (by lane)

Quick Task lane:
- Quick Task Offering
- Post‑Quick‑Task dialog

Intervention lane:
- Pause/Breathing
- Set Intention — Fast Lane Entry (Purpose + Timebox for returning manipulated apps)
- Set Intention — Purpose Picker (F3, first time / change purpose)
- Set Intention — Timebox (F2)
- Checkpoints CP1/CP2/CP3 (+ CP4 warning when enabled)
- Hard Break (Reset Break)
- Emergency Unlock chooser
- Face‑down challenge
- Emergency intention timer

Support ladder:
- Trigger picker
- Micro‑WHY
- Alternatives deep link (main app)
