# BreakLoop Intervention Contract V3 Specification

Based on `Intervention_OS_Contract_V3.docx`.

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
*   **Row 2:** If the app is already in an intervention (e.g., glitch or specialized preserved state), do not re-trigger.
*   **Row 3:** Active Intention (`t_intention > 0`) means the user has "purchased" time. No triggers allowed.
*   **Row 4:** Re-entering an app while the Quick Task timer is still running (and phase is active) resumes the session.
*   **Row 5:** Default "Happy Path" – Emergency allowance available.
*   **Row 6:** Emergency allowance exhausted – Strict intervention.

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
| **Timer Expired** (`t_quickTask`) | User **ON** App | `POST_QUICK_TASK_CHOICE` | Show "Time's Up" Dialog |
| **Timer Expired** (`t_quickTask`) | User **OFF** App | `IDLE` | Clear State |
| **User Selection** | "Start Conscious Process" | `INTERVENTION_ACTIVE` | Start Intervention Flow |
| **User Selection** | "Quit" | `IDLE` | Start Quit Suppression, Exit App |

### Phase: POST_QUICK_TASK_CHOICE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **User Selection** | "Continue" (if avail) | `IDLE` | (Optional: Set intention implied?) |
| **User Selection** | "Quit" | `IDLE` | Start Quit Suppression, Exit App |
| **User Selection** | "Start Conscious Process" | `INTERVENTION_ACTIVE` | - |
| **App Exit** | - | `IDLE` | (Assume choice abandoned) |

### Phase: INTERVENTION_ACTIVE
| Trigger | Guard | Next State | Action |
| :--- | :--- | :--- | :--- |
| **User Selection** | Sets Intention | `IDLE` | Start `t_intention` (Grant Access) |
| **User Selection** | Starts Alternative Activity | `INTERVENTION_ACTIVE` | Start Activity Timer (Screen Preserved) |
| **App Exit** | Incomplete State (e.g. Breathing) | `IDLE` | Clear State (Reset) |
| **App Exit** | Preserved State (Activity Timer) | `INTERVENTION_ACTIVE` | Persist State |

---

## 3. Must-Not-Happen Invariants

1.  **Mutual Exclusion:** An app cannot be in `QUICK_TASK_ACTIVE` and `INTERVENTION_ACTIVE` simultaneously.
2.  **Suppression Hierarchy:**
    *   `t_intention` overrides ALL triggers.
    *   `t_quickTask` overrides Intervention.
3.  **App Switch Persistence:**
    *   **QT:** Switching apps during `t_quickTask` does NOT pause or clear the timer.
    *   **Intervention:** Switching apps during an incomplete intervention (e.g., Breathing) MUST clear the state (Reset to start) upon return, unless explicitly preserved.
4.  **No Free Lunch:** `n_quickTask` must decrement immediately upon starting a Quick Task (not upon completion).
5.  **Hard Reset on Quit:** Executing "Quit" must clear any pending Quick Task state (`t_quickTask` = 0).

---

## 4. Golden Scenarios

### Scenario 1: The "Honeymoon" Phase (First Launch)
*   **Context:** Fresh install, `n_quickTasks = 3`.
*   **Action:** User opens Instagram.
*   **Result:** `StartQuickTask`.
*   **State:** `QUICK_TASK_ACTIVE` starts. `n_quickTasks` becomes 2.

### Scenario 2: The "Just Browsing" (Re-entry during QT)
*   **Context:** `QUICK_TASK_ACTIVE` is running (15s remaining).
*   **Action:** User switches to WhatsApp to reply to a text, then immediately returns to Instagram.
*   **Result:** `NoAction`.
*   **Reason:** `t_quickTask_active` is true. `t_quickTask` continues to drain without interruption.

### Scenario 3: The "Sneaky Return" (QT Expired Off-App)
*   **Context:** User creates a QT on TikTok. Switches to Email. `t_quickTask` expires while in Email.
*   **Action:** User returns to TikTok 10 minutes later.
*   **Result:** `StartQuickTask` (if `n_quickTasks > 0`) OR `StartIntervention` (if `n_quickTasks == 0`).
*   **Reason:** Expiration off-app resets state to IDLE ("Case 2"). Normal entry logic applies.

### Scenario 4: The "Emergency Empty" (Quota Exhausted)
*   **Context:** User has burnt all Quick Tasks (`n_quickTasks = 0`).
*   **Action:** User opens Instagram.
*   **Result:** `StartIntervention`.
*   **Reason:** No emergency allowance remaining.

### Scenario 5: The "Intention" (Buying Time)
*   **Context:** User completes an intervention and selects "Use for 15 minutes". `t_intention` set to 15m.
*   **Action:** User closes phone, re-opens Instagram 5 minutes later.
*   **Result:** `NoAction`.
*   **Reason:** `t_intention_active` suppresses all triggers.

### Scenario 6: The "Timeout" (Intention Expired)
*   **Context:** The 15-minute intention timer from Scenario 5 expires while user is still scrolling.
*   **Action:** Timer expiry event.
*   **Result:** `StartIntervention`.
*   **Reason:** Contract states "When t_intention is over and the user is still using... intervention should start again".

### Scenario 7: The "Rage Quit" (No Suppression)
*   **Context:** Quick Task expires. Dialog shows. User selects "QUIT".
*   **Action:** App closes. User accidentally (or intentionally) taps the icon again 1 second later.
*   **Result:** `StartQuickTask` (if quota > 0) or `StartIntervention`.
*   **Reason:** With no quit suppression, every entry is evaluated strictly on current state and quota.

### Scenario 8: The "Unfinished Business" (Intervention Reset)
*   **Context:** User starts Intervention. Gets to "Breathing" screen. Switches apps to check a notification. Returns to monitored app.
*   **Result:** `StartIntervention` (From start).
*   **Reason:** Incomplete interventions (Breathing, Root Cause) are cleared on exit. Logic re-evaluates entry -> start fresh.
