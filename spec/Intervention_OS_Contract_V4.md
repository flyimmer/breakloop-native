# BreakLoop Intervention Contract V4 Specification

Based on `Intervention_OS_Contract_V4.docx`.
This is an update from V3 focused on **Quick Task expiry behavior**.

---

## 1. Foreground Entry Evaluation (Decision Table)

**Trigger:** Monitored App enters the foreground (Valid Entry).

| Row | isMonitored | phase | t_intention_active | t_quickTask_active | n_quickTask_remaining | **Output** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `FALSE` | * | * | * | * | **NoAction** |
| 2 | `TRUE` | `INTERVENTION_ACTIVE` | * | * | * | **NoAction** |
| 3 | `TRUE` | * | `TRUE` | * | * | **NoAction** |
| 4 | `TRUE` | `QUICK_TASK_ACTIVE` | `FALSE` | `TRUE` | * | **NoAction** |
| 5 | `TRUE` | `IDLE` | `FALSE` | `FALSE` | `> 0` | **StartQuickTask** |
| 6 | `TRUE` | `IDLE` | `FALSE` | `FALSE` | `= 0` | **StartIntervention** |

**Notes:**
- **Row 2:** If the app is already in an intervention (e.g., glitch or specialized preserved state), do not re-trigger.
- **Row 3:** Active Intention (`t_intention > 0`) means the user has "purchased" time. No triggers allowed.
- **Row 4:** Re-entering an app while the Quick Task timer is still running resumes the session; QT timer continues draining.
- **Row 5:** Default "Happy Path" – Emergency allowance available.
- **Row 6:** Emergency allowance exhausted – Strict intervention.

### n_quickTask quota window (GLOBAL)

- `n_quickTask` is the number of Quick Tasks allowed within a **fixed rolling time window**.
- Window sizes are user-configurable: **1h, 4h, 12h, 24h**.
- Window boundaries are **fixed wall-clock buckets**, e.g. for 1h:
  - 08:00–09:00, 09:00–10:00, 10:00–11:00, ...
- At the start of each new window, `n_quickTask_remaining` resets to `n_quickTask`.
- Scope: **GLOBAL** (shared across all monitored apps).
---

## 2. State Transition List

### Phase: IDLE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **Foreground Entry** | `n_quickTask > 0` AND checks_pass | `QUICK_TASK_ACTIVE` | Start `t_quickTask`, Decrement `n_quickTask` |
| **Foreground Entry** | `n_quickTask == 0` AND checks_pass | `INTERVENTION_ACTIVE` | Start Intervention Flow |
| **App Exit** | - | `IDLE` | - |

### Phase: QUICK_TASK_ACTIVE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **Timer Expired** (`t_quickTask`) | User **ON** App | `POST_QUICK_TASK_CHOICE` | Show Post-Quick-Task Dialog (QuickTaskExpiredScreen) |
| **Timer Expired** (`t_quickTask`) | User **OFF** App | `IDLE` | Clear QT state (ACTIVE → IDLE). No immediate intervention. |
| **App Exit** | - | `QUICK_TASK_ACTIVE` | QT timer continues draining (no pause). |

### Phase: POST_QUICK_TASK_CHOICE
**User sees:** “Your quick task is finished. What would you like to do next?”

| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **User Selection** | **Quit** | `IDLE` | Launch phone Home screen; start quit suppression if used. |
| **User Selection** | **I still need to use AppName** AND `n_quickTask > 0` | `QUICK_TASK_ACTIVE` | Start a new QuickTask window: decrement `n_quickTask`, start `t_quickTask` again. |
| **User Selection** | **I still need to use AppName** AND `n_quickTask == 0` | `INTERVENTION_ACTIVE` | Start Intervention flow immediately. |
| **App Exit** | - | `IDLE` | Assume choice abandoned; normal entry logic applies on next entry. |

> Note (important): In V4, “Continue” is not a free pass.
> It is explicitly gated by global quota `n_quickTask`.

### Phase: INTERVENTION_ACTIVE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **User Selection** | Sets Intention | `IDLE` | Start `t_intention` (Grant Access) |
| **User Selection** | Starts Alternative Activity | `INTERVENTION_ACTIVE` | Start Activity Timer (Screen Preserved) |
| **App Exit** | Incomplete State (e.g. Breathing) | `IDLE` | Clear State (Reset) |
| **App Exit** | Preserved State (Activity Timer) | `INTERVENTION_ACTIVE` | Persist State |

---

## 3. Must-Not-Happen Invariants

1. **Mutual Exclusion:** An app cannot be in `QUICK_TASK_ACTIVE` and `INTERVENTION_ACTIVE` simultaneously.
2. **Suppression Hierarchy:**
   - `t_intention` overrides ALL triggers.
   - `t_quickTask` overrides Intervention while active.
3. **App Switch Persistence:**
   - **QT:** Switching apps during `t_quickTask` does NOT pause the timer; it continues draining.
   - **QT Expiry Off-App (Case 2):** If `t_quickTask` expires while user is off the app, native clears QT state (ACTIVE → IDLE) and does NOT trigger intervention immediately.
   - **Intervention:** Switching apps during an incomplete intervention MUST clear the state (Reset to start) upon return, unless explicitly preserved.
4. **No Free Lunch:** `n_quickTask` must decrement immediately upon starting a Quick Task (not upon completion).
5. **Hard Reset on Quit:** Executing "Quit" must clear any pending Quick Task state (`t_quickTask` = 0).
6. **Quota Refill Must Not Override Intention Expiry Behavior:**
   - Refilling `n_quickTask_remaining` during an active `t_intention` must not trigger anything.
   - When `t_intention` expires while the user is still on the monitored app, the system MUST start **Intervention immediately**, regardless of `n_quickTask_remaining` at that moment.

---

## 4. Golden Scenarios

### Scenario 1: The "Honeymoon" Phase (First Launch)
- Context: Fresh install, `n_quickTasks = 3`.
- Action: User opens Instagram.
- Result: `StartQuickTask`.
- State: `QUICK_TASK_ACTIVE` starts. `n_quickTasks` becomes 2.

### Scenario 2: The "Just Browsing" (Re-entry during QT)
- Context: `QUICK_TASK_ACTIVE` is running (15s remaining).
- Action: User switches to WhatsApp then returns to Instagram.
- Result: `NoAction`.
- Reason: `t_quickTask_active` is true; timer continues draining.

### Scenario 3: QT Expired On-App → Post Dialog → Continue with quota
- Context: User stays on app until `t_quickTask` expires.
- Action: Post-Quick-Task dialog appears; user selects “I still need to use AppName”.
- Result:
  - If `n_quickTask > 0`: start another `QUICK_TASK_ACTIVE` window (decrement quota + restart timer).
  - If `n_quickTask == 0`: start Intervention immediately.

### Scenario 4: The "Sneaky Return" (QT Expired Off-App)
- Context: User starts QT on TikTok, switches to Email, QT expires while in Email.
- Action: User returns to TikTok later.
- Result: Normal entry logic applies:
  - `StartQuickTask` if `n_quickTasks > 0`
  - `StartIntervention` if `n_quickTasks == 0`

### Scenario 5: The "Emergency Empty" (Quota Exhausted)
- Context: `n_quickTasks = 0`.
- Action: User opens Instagram.
- Result: `StartIntervention`.

### Scenario 6: The "Intention" (Buying Time)
- Context: User completes an intervention and selects "Use for 15 minutes". `t_intention` set to 15m.
- Action: User closes phone, re-opens Instagram 5 minutes later.
- Result: `NoAction`.
- Reason: `t_intention_active` suppresses all triggers.

### Scenario 7: The "Timeout" (Intention Expired)
- Context: `t_intention` expires while user is still scrolling.
- Result: `StartIntervention`.
- Reason: Contract: when `t_intention` ends and user is still using the app, intervention should start again.

### Scenario 8: The "Rage Quit"
- Context: QT expires, Post dialog shown, user selects "Quit".
- Action: App closes; user reopens quickly.
- Result: Entry evaluation applies strictly based on current quota/timers.

### Scenario 9: The "Unfinished Business" (Intervention Reset)
- Context: User starts Intervention, reaches an incomplete screen (e.g., Breathing), switches apps, returns.
- Result: Intervention restarts from beginning.
- Reason: Incomplete interventions are cleared on exit.

---