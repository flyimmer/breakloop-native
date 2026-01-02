# BreakLoop OS-Level UI Architecture

**Version:** 1.0  
**Date:** December 30, 2025  
**Status:** AUTHORITATIVE - This document defines the canonical architecture

---

## Part 1: Conceptual Clarification

### System Surface Activity (Conceptual)

The Android activity currently named `InterventionActivity` is **conceptually** a neutral **System Surface**.

**What it is:**
- An OS-level activity that appears on top of other apps
- A rendering container for multiple independent flows
- Infrastructure, not semantics

**What it is NOT:**
- Not exclusively for interventions
- Not tied to any specific flow logic
- Not implying "intervention" by its existence

**Conceptual Name:** `SystemSurfaceActivity`  
**Current Implementation:** `InterventionActivity` (keep for now unless trivial to rename)

**Key Principle:**  
The System Surface is a **neutral stage**. Different flows render on this stage, but the stage itself has no opinion about which flow is shown.

---

## Part 2: State Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORED APP FOREGROUND ENTRY                     │
│                                                                       │
│                    OS Trigger Evaluation (JavaScript)                 │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Priority Check Chain │
                    │  (LOCKED ORDER)       │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌────────────────┐
│ 1. Quick Task │      │ 2. Alternative │     │ 3. t_intention │
│    ACTIVE?    │      │    Activity    │     │    VALID?      │
│               │      │    RUNNING?    │     │                │
└───────┬───────┘      └────────┬───────┘     └───────┬────────┘
        │                       │                     │
        │ YES                   │ YES                 │ YES
        ▼                       ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│               SUPPRESS EVERYTHING - DO NOTHING              │
│   (No intervention, no Quick Task dialog, allow app usage)  │
└─────────────────────────────────────────────────────────────┘
        │
        │ ALL NO
        ▼
┌───────────────────┐
│ 4. n_quickTask > 0│
│    (Global)       │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │ YES       │ NO
    ▼           ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   ENTER QUICK TASK FLOW     │  │  ENTER INTERVENTION FLOW    │
│         (Emergency)         │  │    (Conscious Process)      │
└─────────────────────────────┘  └─────────────────────────────┘
```

---

## Quick Task Flow (Emergency Bypass)

```
┌──────────────────────────────────────────────────────────────┐
│                    QUICK TASK FLOW                           │
│                                                              │
│  Purpose: Emergency bypass for urgent, necessary app usage   │
│  Duration: Limited time window per app (e.g., 3 minutes)    │
│  Timer Scope: PER-APP (each app has independent timer)      │
│  Usage Count: GLOBAL (shared quota across all apps)         │
└──────────────────────────────────────────────────────────────┘

    [ENTRY]
       │
       ▼
┌──────────────────┐
│ QuickTaskDialog  │  ← System Surface renders this screen
│                  │
│ "Quick, necessary│
│  task?"          │
│                  │
│ [Conscious]      │
│ [Quick Task]     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
[Conscious] [Quick Task]
    │         │
    │         ▼
    │   ┌──────────────────┐
    │   │ QuickTaskActive  │
    │   │                  │
    │   │ Timer Running:   │
    │   │ - User can freely│
    │   │   switch apps    │
    │   │ - All interventions
    │   │   suppressed     │
    │   │ - All Quick Task │
    │   │   dialogs        │
    │   │   suppressed     │
    │   └────────┬─────────┘
    │            │
    │            │ (Timer expires)
    │            ▼
    │   ┌──────────────────┐
    │   │ QuickTaskExpired │  ← System Surface renders this screen
    │   │                  │
    │   │ "Emergency window│
    │   │  is over"        │
    │   │                  │
    │   │ [Go Home]        │
    │   └────────┬─────────┘
    │            │
    │            │ (User clicks)
    │            ▼
    │   ┌──────────────────┐
    │   │ Reset Timers:    │
    │   │ - t_intention=0  │
    │   │ - t_appSwitchInterval=0
    │   │                  │
    │   │ Navigate to Home │
    │   └────────┬─────────┘
    │            │
    │            ▼
    │        [EXIT]
    │
    │ (User chooses Conscious Process)
    │
    └──────────────────────────────────────────────┐
                                                   │
                                                   ▼
                                    [ENTER INTERVENTION FLOW]
```

**Quick Task Rules:**
1. ✅ Each app has its own independent Quick Task timer (t_quickTask is per-app)
2. ✅ During Quick Task: User can use THAT SPECIFIC APP without intervention
3. ✅ Switching to a DIFFERENT monitored app will trigger its own intervention check
4. ✅ Does NOT create or extend t_monitored
5. ✅ On expiry: Show dedicated screen, reset timers, go to Home
6. ✅ No timer state from before Quick Task is resumed
7. ✅ n_quickTask (usage count) is GLOBAL across all monitored apps

---

## Intervention Flow (Conscious Process)

```
┌──────────────────────────────────────────────────────────────┐
│                   INTERVENTION FLOW                          │
│                                                              │
│  Purpose: Full mindfulness intervention for monitored app    │
│  Duration: Variable, user-driven                            │
│  Scope: PER-APP (each monitored app independent)            │
└──────────────────────────────────────────────────────────────┘

    [ENTRY]
       │
       ▼
┌──────────────────┐
│   Breathing      │  ← System Surface renders these screens
│                  │
│  "Take 3 breaths"│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   RootCause      │
│                  │
│ "Why Instagram?" │
│ [Boredom]        │
│ [Anxiety]        │
│ [Fatigue] ...    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Alternatives    │
│                  │
│ "See Alternatives"│
│ [My List]        │
│ [Discover]       │
│ [AI For You]     │
└────────┬─────────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼                     ▼
┌──────────────┐   ┌──────────────────┐
│ I really need│   │ Start Alternative│
│ to use it    │   │    Activity      │
└──────┬───────┘   └────────┬─────────┘
       │                    │
       ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│IntentionTimer│   │   ActionTimer    │
│              │   │  (Alternative    │
│ "How long?"  │   │   Activity)      │
│ [5m] [15m]...│   │                  │
└──────┬───────┘   │ Timer Running:   │
       │           │ - User does      │
       │           │   alternative    │
       │           │ - Interventions  │
       │           │   suppressed     │
       │           └────────┬─────────┘
       │                    │
       │                    │ (Activity ends)
       │                    ▼
       │           ┌──────────────────┐
       │           │   Reflection     │
       │           │                  │
       │           │ "How was it?"    │
       │           └────────┬─────────┘
       │                    │
       ▼                    ▼
┌─────────────────────────────┐
│ Set t_intention timer       │
│ (User allowed to use app    │
│  for chosen duration)       │
│                             │
│ Return to monitored app     │
└──────────────┬──────────────┘
               │
               ▼
           [EXIT]
      (t_intention active,
   interventions suppressed)
```

**Intervention Rules:**
1. ✅ Each monitored app has independent intervention state
2. ✅ IntentionTimer sets t_intention (per-app)
3. ✅ ActionTimer suppresses interventions while alternative activity runs
4. ✅ After intervention: User returns to monitored app
5. ✅ t_intention blocks future interventions until it expires

---

## Shared System Surface

```
┌─────────────────────────────────────────────────────────────┐
│              System Surface Activity (OS-Level)             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    AT ANY TIME, EXACTLY ONE OF:                    │   │
│  │                                                     │   │
│  │    • Quick Task Flow screens                       │   │
│  │      (QuickTaskDialog, QuickTaskExpired)           │   │
│  │                                                     │   │
│  │    • Intervention Flow screens                     │   │
│  │      (Breathing, RootCause, Alternatives, etc.)    │   │
│  │                                                     │   │
│  │    NEVER BOTH                                      │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Main App UI (tabs, settings, community) NEVER here        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. ✅ ONE shared OS-level activity
2. ✅ TWO separate, mutually exclusive flows
3. ✅ Flows share infrastructure, not semantics
4. ✅ Only ONE flow active at any time
5. ✅ Main app UI never appears in System Surface

---

## Why This Architecture?

### Why Flows are Separate

**Quick Task Flow:**
- Emergency bypass mechanism
- Short-lived (minutes)
- Global scope
- No intervention screens
- No conscious process
- Ends with explicit boundary (Home)

**Intervention Flow:**
- Full mindfulness process
- User-driven duration
- Per-app scope
- Multi-screen journey
- Conscious decision-making
- Ends with return to monitored app

**They solve different problems and must not be mixed.**

### Why They Share the OS Surface

**Practical Reasons:**
1. Both need to appear on top of other apps
2. Both need full-screen takeover
3. Both need OS-level permissions
4. Sharing infrastructure reduces complexity

**Architectural Reasons:**
1. The surface is neutral - it doesn't care which flow renders
2. Only ONE flow is ever active
3. Native code doesn't need to understand flow semantics
4. JavaScript decides which flow to show

### Why Quick Task is NOT Part of Intervention

**Conceptual Separation:**
- Quick Task is a **gate** that prevents intervention
- Intervention is a **process** that happens after the gate
- Gates and processes are not nested - they're sequential

**Implementation Impact:**
- Quick Task can bypass intervention entirely
- Quick Task doesn't create intervention state
- Quick Task doesn't extend intervention timers
- Quick Task and Intervention have independent lifecycles

**User Mental Model:**
- "I need this urgently" (Quick Task) vs "Let me think about this" (Intervention)
- Emergency vs Consciousness
- Bypass vs Engage

---

## Priority Chain (LOCKED)

This order is **AUTHORITATIVE** and must never change:

```
1. Quick Task ACTIVE (per-app: t_quickTask)
   → Suppress everything for this app

2. Alternative Activity RUNNING (per-app)
   → Suppress everything for this app

3. t_intention VALID (per-app)
   → Suppress everything for this app
   → Quick Task dialog MUST NOT appear

4. n_quickTask > 0 (global usage count)
   → Show Quick Task dialog

5. Else
   → Start Intervention Flow
```

**Important Distinctions:**
- **t_quickTask** (timer): PER-APP - Each app has its own independent Quick Task timer
- **n_quickTask** (usage count): GLOBAL - Shared quota across all monitored apps

**Rationale for Order:**

1. **Quick Task ACTIVE first** - This app has an active timer, user can use it freely
2. **Alternative Activity second** - User is actively doing something else
3. **t_intention third** - User made an explicit conscious decision for this app
4. **Quick Task availability fourth** - Emergency bypass option (global quota check)
5. **Intervention last** - Default path when no other conditions apply

---

## Decision Authority

**Native Code (ForegroundDetectionService):**
- ✅ Detects foreground app changes
- ✅ Launches System Surface Activity
- ❌ Does NOT decide which flow to show
- ❌ Does NOT interpret timers or states

**JavaScript (OS Trigger Brain):**
- ✅ Evaluates priority chain
- ✅ Checks all timers and states
- ✅ Decides which flow to show
- ✅ Dispatches appropriate action
- ✅ Single source of semantic truth

**Principle:** Native code is infrastructure. JavaScript is semantics.

---

## Future-Proofing

This architecture allows for:
- ✅ Adding new flows without changing native code
- ✅ Adding new priority conditions without changing infrastructure
- ✅ Testing flows independently
- ✅ Clear boundaries between concerns
- ✅ Easy mental model for developers

**Anti-Patterns to Avoid:**
- ❌ Nesting Quick Task inside Intervention Flow
- ❌ Making native code interpret semantic logic
- ❌ Mixing Main App UI with System Surface UI
- ❌ Sharing state between flows
- ❌ Changing priority order without reviewing this document

---

## Summary

1. **System Surface** = Neutral OS-level container
2. **Quick Task Flow** = Emergency bypass (global)
3. **Intervention Flow** = Conscious process (per-app)
4. **Flows are separate** = Different purposes, different scopes
5. **Priority chain is locked** = 5 conditions, strict order
6. **JavaScript decides** = Native code just launches the surface

**This is the canonical model. All implementation must follow this.**

---

**END OF DOCUMENT**

