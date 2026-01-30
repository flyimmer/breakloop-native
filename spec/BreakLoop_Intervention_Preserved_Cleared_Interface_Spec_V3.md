# BreakLoop — Intervention Preserved/Cleared Interface Spec (V3, 29.01.2026)

Scope: **only** the Intervention **preserved vs cleared** behavior on app-switch / re-entry.
This spec is designed to be implementable without refactoring the entire intervention architecture.

---

## Goals

- Make Intervention sessions **per monitored app** (no cross-app leakage).
- Implement **Preserved vs Cleared** exactly per `Intervention_OS_Contract_V3`:
  - **Only `action_timer` is preserved**
  - **Breathing ("conscious timer countdown") is NOT preserved** (cleared / restarted)
- Ensure Native remains authoritative for **mechanical decisions** (start/suppress/cancel/preserve),
  while JS remains authoritative for **UI navigation** (which screen to show next).

Non-goals (for this slice):
- Reworking Quick Task logic.
- Rewriting the whole intervention flow or System Brain content selection.
- Full “semantic payload” integration (optional, future).

---

## Ownership / Authority

### Native owns (mechanical truth)
Per monitored app (`appPkg`):
- `phase[appPkg] ∈ {IDLE, INTERVENTION_ACTIVE}`
- `t_intention[appPkg]` (expiry timestamp / remaining ms) — **suppression**
- `preservedFlag[appPkg] ∈ {true,false}` (**true only during `action_timer`**)
- Decision gate and app-switch cancellation/preservation behavior

Native does **not** own:
- Which UI step/screen the user is on (breathing vs root-cause vs alternatives)
- UI step transitions

### SystemSurface JS owns (UI truth)
Per monitored app (`appPkg`):
- UI navigation (“next screen”)
- `InterventionFlowSnapshot[appPkg]` (step + minimal state to restore UI)
- Rendering preserved screen on RESUME

JS does **not** own:
- Eligibility to start/suppress intervention (t_intention, suppression windows)
- Canonical OS timers
- Mechanical cancel vs preserve decision

### System Brain JS (optional, future)
May provide semantic payload (kind/content), but must **not** be required to launch UI.
Not needed for this slice.

---

## Core Rule: Preserved vs Cleared (per app)

### Preserved (RESUME)
Only when **`action_timer` is running** for that app:
- `preservedFlag[appPkg] = true`
- On app switch away and later re-entry: intervention resumes (RESUME)

### Cleared (RESET)
All other intervention steps are **incomplete**:
- breathing (conscious timer countdown) ✅ incomplete
- root-cause ✅ incomplete
- alternatives list ✅ incomplete
- action selection (before timer starts) ✅ incomplete
- reflection ✅ incomplete

For these:
- `preservedFlag[appPkg] = false`
- On app switch away and later re-entry: intervention restarts from beginning (RESET)

---

## Native → SystemSurface: Commands

### `SHOW_INTERVENTION(appPkg, resumeMode, kindOrDefault?)`
- `appPkg`: package name of monitored app
- `resumeMode`:
  - `RESET`: clear any stored snapshot and restart intervention from the beginning
  - `RESUME`: restore UI snapshot and show preserved screen (action_timer)
- `kindOrDefault` (optional):
  - may be used to choose initial intervention type; for this slice can be omitted or defaulted

Expected behavior in SystemSurface JS:
- If `resumeMode == RESET`:
  - clear `InterventionFlowSnapshot[appPkg]`
  - start at breathing (conscious timer countdown) step
  - ensure `INT_SET_PRESERVED(appPkg, false)`
- If `resumeMode == RESUME`:
  - load `InterventionFlowSnapshot[appPkg]`
  - render the preserved screen (action_timer)
  - keep `INT_SET_PRESERVED(appPkg, true)`

---

## SystemSurface → Native: Intents (mechanical only)

### `INT_SET_PRESERVED(appPkg, preserved: boolean)`
- **Required.**
- Must be sent whenever preserved-ness changes.
- Contract:
  - `true` **only** when `action_timer` starts running
  - `false` otherwise (including breathing countdown)

### `INT_COMPLETED(appPkg, outcome)`
- Ends intervention session for `appPkg` (Native transitions to IDLE).
- `outcome` may include:
  - `setIntentionMs` (optional): if user sets intention timer, Native persists `t_intention[appPkg]`

### `INT_ABORTED(appPkg, reason)`
- Ends intervention session for `appPkg` (Native transitions to IDLE) without setting intention.

### (Optional for this slice) `INT_SET_T_INTENTION(appPkg, durationMs)`
- If you already model intention setting as a separate intent, keep it.
- Otherwise, include intention-setting in `INT_COMPLETED(outcome)`.

---

## App Switch / Re-entry Handling (Native)

Trigger: underlying foreground app changes while SystemSurface was active for `appPkg`.

Native logic:
1. If `preservedFlag[appPkg] == true`:
   - Keep `phase[appPkg] = INTERVENTION_ACTIVE`
   - Do **not** clear snapshot (JS will resume)
2. Else (`preservedFlag == false`):
   - Cancel intervention session for that `appPkg`
   - Set `phase[appPkg] = IDLE`
   - Next time app is entered and decision gate chooses intervention:
     - send `SHOW_INTERVENTION(appPkg, RESET)`

Important:
- Native does not need to know the UI step.
- Native uses only `preservedFlag[appPkg]` as the mechanical truth.

---

## Logging / Verification (minimum)

Add logs with tags (example):
- `INT_STATE`: when preservedFlag changes
- `DECISION_GATE`: when choosing SHOW_INTERVENTION and with resumeMode
- `SURFACE`: when surface opens/exits
- `APP_SWITCH`: when cancel/preserve occurs on switch

Manual tests:
1. **Breathing not preserved**
   - enter monitored app → intervention opens → on breathing countdown → switch away → re-enter
   - expected: intervention restarts (RESET), breathing countdown restarts
2. **Action timer preserved**
   - enter monitored app → reach alternative activity → start action_timer (preservedFlag=true)
   - switch away → re-enter
   - expected: action_timer screen resumes (RESUME)
3. **Per-app isolation**
   - start intervention for app A, switch to app B
   - expected: app B decision uses its own per-app state; no leakage of A snapshot/state

---

## Implementation Notes (recommended)

- Store `preservedFlag` in Native in a map keyed by `appPkg`.
- JS snapshot store should be keyed by `appPkg`.
- `resumeMode` should be part of the SHOW_INTERVENTION command payload.
- Do not block `SHOW_INTERVENTION` on System Brain payload availability.
