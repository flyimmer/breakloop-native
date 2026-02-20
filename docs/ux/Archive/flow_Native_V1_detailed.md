# flow_Native_V1.md — BreakLoop Runtime Flow (Android Native)

This document defines the **end-to-end, user-visible runtime flow** for **monitored apps** on a **real Android phone**.
It merges:
- **Existing native lanes (keep as implemented):** Quick Task + Post‑Quick‑Task dialog
- **New UX lanes (bring from web simulation):** Progressive Intervention flow + Help Ladder + Hard Break (Reset Break)

> UI microcopy, layouts, and per-screen interactions are defined in `intervention_ux_contract_Native_V1.md`.
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
- Run context (per app, per run): `checkpointCount(A)`, `purpose(A)`, `rootCause(A)`, `whyShownFull(A)`, `skipStreak(A)` …

### Hard Break override (highest priority)
If `now < hardBreakUntil(A)`:
- Opening app **A** shows **Hard Break UI only**.
- **No Quick Task**, **no Intervention flow** while the hard break is active.

### Foreground‑gated expiry (no surprise overlays)
When any timer (Quick Task or Intention) expires for app **A**:
- Act **only** if **A is foreground at the moment of expiry**
- If **A is not foreground**, do nothing (no checkpoint UI, no escalation); next time **A** enters foreground → Decision Gate again.

### No deferred Post‑Quick‑Task UI (keep current native behavior)
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

> Note: Quick Task is **per app**. A Quick Task running in Instagram must not suppress interventions for TikTok.

---

## 2) Quick Task lane (native — keep as implemented)

### 2.1 Quick Task Offering (surface)
Shown when quota is available for app A.

Actions (see UX contract for exact copy):
- **Quick Task** → start `t_quickTask(A)`, decrement `n_quickTask_remaining(A)`, dismiss surface
- **Start conscious process** → go to Intervention lane (F1 breathing)
- **Close (X)** → navigate Home / leave app

### 2.2 Quick Task Active (no surface)
- User uses the monitored app normally.
- `t_quickTask(A)` runs.

### 2.3 Quick Task expiry
When `t_quickTask(A)` expires:
- If **A is foreground** → show **Post‑Quick‑Task dialog**
- If **A is not foreground** → silently clear QT state; next entry is a fresh Decision Gate.

### 2.4 Post‑Quick‑Task dialog (surface)
Actions (native behavior, keep):
- **Close {App}** → navigate Home
- **I want to use {App} more** → dismiss dialog and return to app (**no extra friction**, no forced intention timer)

If user leaves without choosing:
- Abandon; do not re-show.

---

## 3) Intervention lane (new UX)

### 3.1 Entry → Pause/Breathing (F1)
Shown when Decision Gate chooses Intervention.

- Breathing loop: inhale ~4s, exhale ~4s.
- Buttons hidden during first cycle; then appear while breathing continues:
  - Primary: close/exit app
  - Secondary: proceed (requires intention timer next)

### 3.2 Intention Timer (F2) — mandatory
To proceed back to the monitored app:
- User must set an intention duration → starts `t_intention_until(A)` and closes the surface.
- Timer presets follow the progressive disabling rules (Section 7).

**Trap apps (social/video):** Purpose capture (F3) is enforced (chips + optional short text) before user can start the timer.

### 3.3 While `t_intention(A)` is active
- No BreakLoop surfaces are shown for app A.
- If user backgrounds A and returns before expiry → still no UI (allow use).
- If the timer expires while A is foreground → go to the next checkpoint.

### 3.4 Intention expiry → checkpoint
When `t_intention(A)` expires:
- If **A is foreground** → show CP1/CP2/CP3/CP4/CP5 depending on `checkpointCount(A)` and Hard Break enablement.
- If **A is not foreground** → do nothing; next time A opens → Decision Gate.

---

## 4) Run, checkpoints, escalation (per app)

### 4.1 Run definition
A **run** for app A starts when the user enters the Intervention lane for A (i.e., after Decision Gate chooses Intervention and the breathing surface is shown).
A run ends when:
- the app is treated as a **fresh start** (e.g., user returns after `t_intention(A)` already expired), or
- Hard Break begins and completes, or
- (optional later) explicit session timeout rules.

### 4.2 Checkpoint count
`checkpointCount(A)` increments only when:
- `t_intention(A)` expires **AND**
- app **A** is **foreground at expiry**

Mapping:
- CP1: checkpointCount becomes 1
- CP2: becomes 2
- CP3: becomes 3
- CP4: becomes 4
- CP5: becomes 5 (Hard Break enforced when enabled)

### 4.3 Checkpoint behavior summary
- **CP1–CP2:** light reflection + actions (close / alternatives / set timer)
- **CP3:** escalation point; CP3 screen stays minimal; ladder may auto-open CAUSE/WHY once (see Section 5)
- **CP4:** warning checkpoint (Hard Break enabled): show warning banner only + actions (no ladder auto-open)
- **CP5:** Hard Break starts immediately (no checkpoint shell)

If Hard Break is disabled for app A:
- CP4+ continues in a “late-stage” pattern (similar to CP3, without warning/enforcement)

---

## 5) Help Ladder integration (Cause → Why → Alternatives)

Help Ladder state is tracked per run:
- `rootCause(A)` chosen at most once per run
- `whyShownFull(A)` shown at most once per run
- `skipStreak(A)` counts repeated “skip help” choices after CP3

### 5.1 CP3 escalation (minimal CP screen + ladder behind)
When `checkpointCount(A)` becomes **3**:
- Show CP3 **CheckpointShell** (minimal).
- **Auto-open** only when it adds new value:
  - If `rootCause(A) == null` → open **CAUSE** (Root Cause screen) after a short 600–900ms bridge
  - Else if `whyShownFull(A) == false` → open **WHY (full)**
  - Else → stay on CP3 shell (no auto-open)

### 5.2 Alternatives deep-link rule
“Show alternatives” always routes to the app’s **Alternatives tab** filtered to the selected trigger:
- If `rootCause` known → deep-link directly
- If unknown → CAUSE first, then deep-link after selection
- If WHY has never been shown in this run: show WHY (full) once before opening Alternatives (per UX contract routing)

---

## 6) Hard Break (Reset Break) — native runtime rules

### 6.1 Enablement
Hard Break is **user-controlled**, **premium**, and **per app**.

Defaults:
- Warn at **CP4**
- Enforce at **CP5**
- Duration: **10 minutes**

### 6.2 CP4 warning vs ladder
At CP4, the warning must be unmissable:
- CP4 must **not** auto-open CAUSE/WHY.
- If user taps alternatives/help from CP4, the warning remains visible as part of the checkpoint shell header.

### 6.3 Enforced behavior (CP5 and during break)
When Hard Break starts:
- set `hardBreakUntil(A) = now + 10m`
- show Hard Break UI
- any future entry into A during the break shows Hard Break UI only

### 6.4 Emergency unlock (inside Hard Break)
Unlock options are handled in Hard Break UI flows:
- Weekly override (per app) 1/week
- Face‑down challenge (global) 1/day
- Emergency pass (global) non-expiring; max 2 uses/day

After a successful unlock:
- user must set an **Emergency Intention Timer (5–30m)**
- when that emergency timer expires and A is still foreground → Hard Break resumes immediately

---

## 7) Intention timer presets and progressive disabling

Presets: **1 / 5 / 15 / 30 / 45** minutes.

Disable based on `checkpointCount(A)` in the current run:
- 0: all enabled
- 1: disable 45
- 2: disable 30 and 45
- 3+: only 1 and 5 enabled

Stop tightening further after CP3 (keep 1 and 5).

---

## 8) Lifecycle / re‑entry semantics (user-facing)

### 8.1 Return before intention expiry
If user leaves app A and returns before `t_intention_until(A)`:
- allow immediate app use (no overlay)
- run context remains valid
- next checkpoint happens only if A is foreground at expiry

### 8.2 Return after intention expiry
If user returns after `t_intention_until(A)` already expired:
- treat as a **fresh start** of A
- run Decision Gate again (Hard Break → Quick Task → Intervention)

---

## 9) Screen inventory (by lane)

Quick Task lane:
- Quick Task Offering
- Post‑Quick‑Task dialog

Intervention lane:
- Pause/Breathing
- Intention Timer (+ Trap Purpose)
- Checkpoints CP1–CP4
- Root Cause (CAUSE)
- WHY (full)
- Hard Break (Reset Break)
- Emergency Unlock chooser
- Face‑down challenge
- Emergency intention timer
