**Changelog:**

18.01.2026: updated the quick task rules more explicitly

25.01.2026 added redundante information, but may better for
clarification at the end for V2.

29.01.2026 defined complete/preserved state(per app) and Incomplete
Intervention (per app) for V3.



## Define the “OS trigger contract” without t_appSwitchInterval

-   What counts as a “monitored app”: they are under setting “monitored
    apps”. Not only apps, but also Website will be monitored and will be
    intervened by the conscious process.

-   Each individual monitored app shall have its own all
    timers/parameters below except n_quickTasks.

| **Timer/Parameter** | **Scope** | **Notes**                                                                           |
|---------------------|-----------|-------------------------------------------------------------------------------------|
| t_intention         | Per-app   | Each monitored app has its own intention timer                                      |
| t_quickTask         | Per-app   | Each monitored app has its own Quick Task active timer                              |
| n_quickTask         | GLOBAL    | Usage count is shared - using Quick Task on Instagram consumes quota for TikTok too |

-   When intervention should fire; when it must NOT fire; How intention
    timer suppresses it

    -   Every app shall be treated as individual

    -   Every time a monitored app enters foreground, the OS trigger
        logic must evaluate whether an intervention should start.

    -   When the intervention for a monitored app has already been
        started, need to monitor

        -   If

            -   when the intention timer (t_intention) is chosen and
                t_intention is not over, or

            -   the “alternative activity” is started (not to implement
                it at this moment)

            <!-- -->

            -   then: the intervention shall not be started.

        -   Else: the intervention shall be started from the beginning
            again

    -   t_intention: the timer set by the user for this monitored app
        during the intervention flow how long the user wants to use this
        app (see screenshot):

        -   when t_intention is over and the user is still using this
            monitored app, the intervention should start again

        -   **Evey time the intervention flow starts or restarts, the
            t_intention for this app shall be deleted.**

-   **Complete/Preserved states (per app): do NOT clear intervention
    state, when user comes back to this app, the last state/screen
    should keep**

    -   action_timer - User is doing alternative activity, and the
        activity timer already started → preserve, when user switch back
        to this app, use still see this screen. Unless

        -   timer - User set t_intention
            → **this transitions to idle AND launches the app, so
            user can use it normally** → preserve

        -   idle - No intervention → nothing to cancel

    -   Key insight: When user sets t_intention, the
        intervention completes and transitions to idle, then the app
        launches normally. The t_intention timer is now active and
        will suppress future interventions until it expires.

-   **Incomplete Intervention (per app): The intervention state/screen
    of the app shall be cleared when the user switch away and back to
    this app**

    -   When user switches away, clear intervention state if its in the
        following incomplete:Incomplete states (clear intervention
        states). Below are only some examples. Except explicit defined
        complete/preserved states, all states of the app shall be
        cleared

        -   breathing - User hasn't finished breathing

        -   root-cause - User hasn't selected causes

        -   alternatives - User hasn't chosen alternative

        -   action - User hasn't started activity

        -   reflection - User hasn't finished reflection

## Quick task:

**Definitions**

-   t_quickTask: duration of the emergency allowance

-   n_quickTask: number of Quick Tasks allowed within the rolling window
    (e.g. 15 minutes)

**Rules**

1.  Quick Task temporarily suppresses all intervention triggers.

2.  When quick task started, t_intention for this app is reset to 0

3.  During t_quickTask:

    -   User may freely switch apps and return to monitored apps

    -   No intervention process shall start

4.  Quick Task does **not** create or extend t_intention.

5.  When t_quickTask expires:

    -   **case 1: t_quickTask expires while the user is still on the
        app**

        -   if n_quickTask \> 0 → Quick Task dialog again

            1.  QuickTaskExpiredScreen appears, User sees: “Your quick
                task is finished. What would you like to do next?

            2.  Native transitions: ACTIVE → POST_CHOICE

            3.  Native emits: SHOW_POST_QUICK_TASK_CHOICE

            4.  User options:

                1.  Continue

                2.  Quit: launches to the cellphone home screen.

        -   if n_quickTask = 0, intervention flow starts.

    -   **Case 2: t_quickTask expires while the user is NOT on the app**

        -   Native transitions: ACTIVE → IDLE

        -   Native:

            1.  clears Quick Task state

            2.  No intervention triggered immediately

        -   What happens later

            1.  When user later opens the app:

                1.  Normal entry logic applies (Phase 4.1):

                    1.  If n_quickTask \> 0 → Quick Task dialog

                    2.  If n_quickTask == 0 → Intervention

6.  No timer state from before the Quick Task is resumed or reused.

7.  n_quickTask is counted globally across all monitored apps within the
    window.

## Logic between t_intention, t_quickTask, n_quickTasks

1.  check the t_intention for this opening monitored app,

    1.  if t_intention !=0: no quick task dialog, no intervention

    2.  if t_intention =0:

        1.  if n_quickTasks != 0

            1.  if t_quickTask !=0: no quick task dialog, no
                intervention

            2.  if t_quickTask = 0 or has no value: start the quick task
                dialog

        2.  if n_quickTasks = 0: no quick task dialog

Intervention OS Contract (V2)

**Status:** Active

**Version history:** - V1: Original behavioral contract - V2: Clarified
phase model, suppression rules, and Quick Task → Intervention
transitions

1\. Purpose

This document defines the **behavioral contract** between the operating
system–level triggers and the BreakLoop intervention logic.

It specifies **when** and **why**: - an **intervention** must start, - a
**Quick Task** must start, - or **no action** must be taken.

⚠️ This contract intentionally **does not** define UI, lifecycle,
Native/JS authority, or architectural concerns.

2\. Definitions

2.1 Monitored App

A *monitored app* is any application explicitly configured by the user
to be subject to BreakLoop intervention logic.

Examples: - Instagram - TikTok - XHS

2.2 OS-Level Phase Model **(Updated in V2)**

Each monitored app exists in exactly one **OS-level phase** at any
moment:

-   **IDLE**  
    No active intervention or Quick Task.

-   **INTERVENTION_ACTIVE**  
    A conscious intervention session is currently running.

-   **QUICK_TASK_ACTIVE**  
    A Quick Task is currently running.

-   **POST_QUICK_TASK_CHOICE**  
    The Quick Task has completed and the user must choose what to do
    next.

All rules in this document operate **within this phase model**.

3\. Timers & Counters

3.1 Intention Timer (t_intention)

t_intention measures the time since the user last **completed** an
intervention for a given app.

Rules: - Starts when an intervention is **completed** - Resets if the
user leaves the app - Is **cleared** when a Quick Task or Intervention
begins

3.2 Quick Task Timer (t_quickTask)

t_quickTask is the fixed duration of a Quick Task session.

Rules: - Starts when a Quick Task begins - Always expires
automatically - Cannot be paused or extended

3.3 Quick Task Counter (n_quickTask)

n_quickTask limits how many Quick Tasks may be used within a sliding
time window.

Rules: - Decrements on every Quick Task start - Resets when the
configured window expires - When exhausted, Quick Tasks are no longer
available

4\. Foreground Entry Rules

4.1 Foreground Entry

A *foreground entry* occurs when a monitored app becomes the foreground
app **and remains foreground long enough to be considered intentional**.

**(Updated in V2)** Very brief foreground flickers (e.g. app switch
animations) must not be treated as valid entries.

4.2 Entry Evaluation

On each valid foreground entry:

1.  If the app phase is INTERVENTION_ACTIVE → **no action**

2.  Else if t_intention \< threshold → **start intervention**

3.  Else if Quick Tasks are available → **start Quick Task**

4.  Else → **no action**

5\. Quick Task Behavior

5.1 Quick Task Start

When a Quick Task starts:

-   Phase transitions to QUICK_TASK_ACTIVE

-   t_quickTask starts

-   t_intention is cleared

5.2 Quick Task Completion

When t_quickTask expires:

-   Phase transitions to POST_QUICK_TASK_CHOICE

-   User must explicitly choose the next action

5.3 Post-Quick-Task Choices

*Accept*

-   Phase transitions to IDLE

-   App continues running

-   No intervention is triggered

*Quit*

-   Phase transitions to IDLE

-   User is taken out of the app

**(Updated in V2)** After an explicit Quit, the same app must be
temporarily suppressed from immediately re-triggering a Quick Task or
Intervention.

5.4 Start Conscious Process **(Updated in V2)**

Selecting **Start Conscious Process**:

-   Transitions phase: QUICK_TASK_ACTIVE → INTERVENTION_ACTIVE

-   Does **not** exit the app

-   Does **not** finish the current surface

-   Starts an intervention immediately

6\. Suppression Rules **(Updated in V2)**

6.1 Quit Suppression Window

After an explicit Quit action:

-   The same app must not trigger:

    -   a Quick Task

    -   an Intervention

for a short suppression window.

Purpose: - Prevent immediate re-trigger caused by OS/UI flicker -
Respect explicit user intent to leave

6.2 Suppression Expiry

Suppression expires when:

-   The suppression window elapses, **or**

-   The user intentionally re-enters the app after leaving it

7\. Intervention Behavior

7.1 Intervention Start

When an intervention starts:

-   Phase transitions to INTERVENTION_ACTIVE

-   t_intention is cleared

7.2 Intervention Completion

When an intervention completes:

-   Phase transitions to IDLE

-   t_intention starts

8\. Non-Goals

This document does **not** define:

-   UI lifecycle

-   Activity or surface management

-   Native vs JS authority

-   Monitoring implementation details

These are defined in the **Architecture Invariants** document.

9\. Invariants

-   At most **one** of Quick Task or Intervention may be active per app

-   Timers are owned per app

-   Explicit user actions always override automatic triggers

**End of Contract**
