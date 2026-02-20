# BreakLoop Intervention OS Contract V5 (Specification)

This document updates **Intervention_OS_Contract_V4.md** fileciteturn9file0 to align with:
- **Per-app Quick Task** (quota + timer are scoped per monitored app, not global)
- **New Intervention UX ladder** (defined in `flow_v3.md` + `intervention_ux_contract_v3.md`)
- **Hard Break (Reset Break)** as a first-class, per-app gate that overrides everything

> **Scope of this doc:** OS/runtime gating, timers, foreground detection, and “what may trigger when.”
> UI copy/layout belongs in `intervention_ux_contract_v3.md`. Ladder/checkpoint rules belong in `flow_v3.md`.


---

## 1. Foreground Entry Evaluation (Decision Table)

**Trigger:** A monitored app `A` enters the foreground (Valid Entry).

**Per-app inputs:**
- `phase(A)` ∈ { `IDLE`, `QUICK_TASK_OFFERING`, `QUICK_TASK_ACTIVE`, `POST_QUICK_TASK_CHOICE`, `INTERVENTION_SURFACE`, `HARD_BREAK_ACTIVE` }
- `t_intention_active(A)` (now < `t_intention_until(A)`)
- `t_quickTask_active(A)` (now < `t_quickTask_until(A)`)
- `n_quickTask_remaining(A)` (quota remaining for the current fixed window bucket for app A)
- `hardBreakActive(A)` (now < `t_hardBreak_until(A)`)

| Row | isMonitored(A) | hardBreakActive(A) | phase(A) | t_intention_active(A) | t_quickTask_active(A) | n_quickTask_remaining(A) | **Output** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `FALSE` | * | * | * | * | * | **NoAction** |
| 2 | `TRUE` | `TRUE` | * | * | * | * | **ShowHardBreak(A)** |
| 3 | `TRUE` | `FALSE` | `INTERVENTION_SURFACE` \/ `HARD_BREAK_ACTIVE` | * | * | * | **NoAction** (surface already showing for A) |
| 4 | `TRUE` | `FALSE` | * | `TRUE` | * | * | **NoAction** (“purchased time” suppresses all for A) |
| 5 | `TRUE` | `FALSE` | `QUICK_TASK_ACTIVE` | `FALSE` | `TRUE` | * | **NoAction** (QT running; allow A; timer continues) |
| 6 | `TRUE` | `FALSE` | `IDLE` | `FALSE` | `FALSE` | `> 0` | **StartQuickTaskOffering(A)** |
| 7 | `TRUE` | `FALSE` | `IDLE` | `FALSE` | `FALSE` | `= 0` | **StartIntervention(A)** |

**Notes**
- **Hard Break overrides everything.** If active, the only allowed UI is the Hard Break UI.
- **Quick Task is per-app.** QT state for app `A` has no suppressing effect on other apps.
- If a surface is already showing for app `A`, do not retrigger on re-entry (debounce / single-surface rule).

---

## 1.1 Quick Task quota window (PER APP)

- `n_quickTask(A)` = number of Quick Tasks allowed for app `A` in a fixed time window bucket.
- Window sizes are user-configurable: **15m (test), 1h, 2h, 4h, 8h, 24h**.
- Window boundaries are **fixed wall-clock buckets**. Examples:
  - For 1h: 08:00–09:00, 09:00–10:00, ...
  - For 15m: 08:00–08:15, 08:15–08:30, ...
- At the start of a new bucket, `n_quickTask_remaining(A)` resets to `n_quickTask(A)`.
- Scope: **PER APP** (Instagram and TikTok have independent quotas).

---

## 2. State Transition List (Per App A)

### Phase: IDLE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| Foreground Entry | `hardBreakActive(A)` | `HARD_BREAK_ACTIVE` | Show Hard Break UI |
| Foreground Entry | `t_intention_active(A)` | `IDLE` | No action |
| Foreground Entry | `n_quickTask_remaining(A) > 0` | `QUICK_TASK_OFFERING` | Show Quick Task offering UI |
| Foreground Entry | `n_quickTask_remaining(A) == 0` | `INTERVENTION_SURFACE` | Start Intervention flow (breath → …) |
| App Exit | - | `IDLE` | - |

### Phase: QUICK_TASK_OFFERING
User is offered: **Quick Task** vs **Conscious process** (start intervention) vs quit/close.

| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| User selects Quick Task | - | `QUICK_TASK_ACTIVE` | Decrement `n_quickTask_remaining(A)`; start `t_quickTask(A)`; close surface |
| User selects Conscious process | - | `INTERVENTION_SURFACE` | Start Intervention flow |
| User quits/closes | - | `IDLE` | Navigate Home (optional quit suppression) |
| App Exit (leave foreground) | - | `IDLE` | Clear offering surface; do **not** defer |

### Phase: QUICK_TASK_ACTIVE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| Timer Expired (`t_quickTask`) | App `A` is **foreground** | `POST_QUICK_TASK_CHOICE` | Show Post-Quick-Task dialog |
| Timer Expired (`t_quickTask`) | App `A` is **not** foreground | `IDLE` | Clear QT state silently (no immediate intervention) |
| App Exit | - | `QUICK_TASK_ACTIVE` | QT timer continues draining (no pause) |

### Phase: POST_QUICK_TASK_CHOICE
User sees: “Your quick task is finished. What would you like to do next?”

| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| User Selection | Quit | `IDLE` | Navigate Home; clear any pending QT state for `A` |
| User Selection | “I still need to use AppName” AND `n_quickTask_remaining(A) > 0` | `QUICK_TASK_ACTIVE` | Start a new Quick Task: decrement quota + restart `t_quickTask(A)` |
| User Selection | “I still need to use AppName” AND `n_quickTask_remaining(A) == 0` | `INTERVENTION_SURFACE` | Start Intervention immediately |
| App Exit before choice | - | `IDLE` | Assume choice abandoned; **do not defer / re-show** on next entry |

> **Important:** There is **no deferred Post-Quick-Task** surface. If the user leaves, next entry runs the Decision Gate again.

### Phase: INTERVENTION_SURFACE
The UX details and ladder/checkpoints are defined in `flow_v3.md` + `intervention_ux_contract_v3.md`.  
The OS contract defines only the timer semantics and gating.

| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| User Selection | Sets Intention | `IDLE` | Start `t_intention(A)`; close surface (grant access) |
| `t_intention(A)` expires | App `A` is **foreground** | `INTERVENTION_SURFACE` | Show next checkpoint / escalation per `flow_v3.md` |
| `t_intention(A)` expires | App `A` is **not** foreground | `IDLE` | **Do nothing** (no overlay; no escalation). Next entry is a **new start** (Decision Gate). |
| App Exit during surface | - | `IDLE` | Close surface; do not resume partial UI on return |

---

## 3. Hard Break (Reset Break) — per app gate

Hard Break is triggered by the intervention ladder rules (see `flow_v3.md`).  
This contract defines **how Hard Break blocks at runtime**.

### 3.1 Data (per app A)
- `t_hardBreak_until(A)` (timestamp; 0 if inactive)
- `hardBreakEnabled(A)` (setting)
- Emergency unlock quotas exist (weekly override per app, daily challenge global, emergency pass global max 2/day), but:
  - **Hard Break main screen must not show quotas**
  - Quotas are displayed only on the **Emergency Unlock** screen

### 3.2 Runtime behavior
| Trigger | Guard | Output / Action |
| :--- | :--- | :--- |
| Foreground entry of app A | `now < t_hardBreak_until(A)` | Show Hard Break UI (only allowed surface) |
| Any other gating | - | Suppressed while Hard Break active (no QT offering, no intervention) |
| Hard Break ends | `now >= t_hardBreak_until(A)` | Next entry uses normal Decision Gate |

---

## 4. Lifecycle, Persistence & Re-entry Rules (rewritten)

This section replaces the V4 “preserved vs cleared states” list.  
It defines what must persist across background/foreground and **how re-entry behaves relative to `t_intention`**.

### 4.1 Persistent state (must survive app switches / process death)

Persist **per monitored app A**:
- `t_intention_until(A)`
- `t_quickTask_until(A)`
- `n_quickTask_remaining(A)` + fixed-window bucket metadata (window size, current bucket start)
- `t_hardBreak_until(A)` + `hardBreakEnabled(A)`
- `t_emergencyAllow_until(A)` (if Emergency Unlock grants a temporary allow window during Hard Break)

Persist **global quotas** (shared across apps, by spec):
- Daily Challenge usage (max 1/day)
- Emergency Pass usage counter (max 2/day) + pass balance

Persist **per-app quota** (by spec):
- Weekly Override usage (max 1/week per app)

Persist minimal “run context” needed for correct ladder escalation (if stored natively):  
`checkpointCount(A)`, `rootCause(A)`, `whyShownFull(A)`, `purpose(A)`, `skipStreak(A)` (names may differ; concept matters)

### 4.2 Return behavior around `t_intention` (key)

This is the primary rule that determines whether we are still in the *same run*.

- **User returns to app A before `t_intention_until(A)` expires:**  
  Allow immediate app use (no overlay). The **run context is preserved** and continues.  
  The next checkpoint is allowed to occur **only if app A is foreground when `t_intention` expires**.

- **User returns to app A after `t_intention_until(A)` has already expired:**  
  Treat it as a **new start** of app A and evaluate the **Decision Gate** (Quick Task vs Intervention), unless Hard Break is active.

### 4.3 Surface lifecycle (what is transient vs resumable)

UI surfaces are **transient** (closed when app A leaves foreground), but **run context can still persist** via §4.2.

If app A leaves foreground while any surface is showing, close it immediately:
- Quick Task offering
- Post-Quick-Task dialog (no deferred re-show; leaving abandons it)
- Any intervention step surface (breathing, timer selection, checkpoint screen, cause selection, why screen)
- Emergency Unlock chooser / challenge UI

**On next foreground entry of app A:** apply §4.2 first (Hard Break override still wins); otherwise run the Decision Gate.

### 4.4 Foreground-gated expiry rule (applies to QT + Intention + Emergency Allow)

When a timer expires for app A (`t_quickTask`, `t_intention`, or `t_emergencyAllow`):
- Act only if **app A is foreground at the moment of expiry**
- Otherwise: update internal state silently (e.g., mark expired) and wait until next entry, which will follow §4.2 / Decision Gate.

This prevents random overlays on unrelated apps or on the lock screen.

---

## 5. Must-Not-Happen Invariants (updated)

1. **Hard Break override:** If `hardBreakActive(A)`, **no** Quick Task or Intervention UI may appear for A.
2. **Per-app Quick Task:** QT state for app A does not suppress app B’s interventions.
3. **Mutual exclusion:** App A cannot be in `QUICK_TASK_ACTIVE` and `INTERVENTION_SURFACE` simultaneously.
4. **Suppression hierarchy (per app A):**
   - `t_hardBreak` overrides all.
   - `t_intention` suppresses all triggers for A while active.
   - `t_quickTask` suppresses intervention for A while active.
5. **No deferred Post-QT:** Post-QT UI is never re-shown on next entry; leaving the app abandons it.
6. **No free lunch:** `n_quickTask_remaining(A)` decrements immediately when starting a Quick Task.

---

## 6. Golden Scenarios (updated)

### Scenario 1: First launch (Instagram)
- Context: `n_quickTask_remaining(IG)=3`, no intention, no hard break.
- Action: User opens Instagram.
- Result: `StartQuickTaskOffering(IG)`.

### Scenario 2: Re-entry during QT (same app)
- Context: `QUICK_TASK_ACTIVE(IG)` with 15s remaining.
- Action: User switches to WhatsApp then returns to Instagram.
- Result: `NoAction`; QT continues draining.

### Scenario 3: QT expired on-app → Post-QT dialog → Continue with quota
- QT expires while IG is foreground.
- Post dialog appears.
- Continue:
  - If `n_quickTask_remaining(IG)>0`: start another QT
  - Else: start Intervention immediately

### Scenario 4: QT expired off-app (no random overlay)
- User starts QT on TikTok, then switches away; QT expires while off TikTok.
- Result: QT clears silently.
- Next time TikTok opens: Decision Gate (QT offering if quota>0; else intervention).

### Scenario 5: Intention expired off-app (no random overlay; new start next entry)
- User sets 15m intention on IG, then locks phone / switches away.
- Intention expires while IG not foreground → **no UI**.
- Next time IG opens → Decision Gate.

### Scenario 6: Hard Break blocks everything for the app
- `t_hardBreak_until(IG)=now+10m`
- Any IG entry during this time → Hard Break UI only (no QT offering, no intervention).

---

