# Architecture Quick Reference Guide

**Version:** Phase 4.2+  
**Status:** AUTHORITATIVE

## Quick Decision Tree

### "Where should this logic live?"

```
Is this about WHAT is allowed?
├─ YES → Native (Semantic Authority)
└─ NO → Is this about WHEN UI can be shown?
    ├─ YES → JavaScript (UI Authority)
    └─ NO → Re-evaluate your question
```

### "Can I add this code to SystemSurface?"

```
Does it involve:
├─ Timers? → ❌ NO (Native owns timers)
├─ Quota checks? → ❌ NO (Native owns quota)
├─ Deciding Quick Task vs Intervention? → ❌ NO (Native decides)
├─ Reading semantic state from AsyncStorage? → ❌ NO (Native owns state)
├─ Re-running OS Trigger Brain? → ❌ NO (System Brain only)
├─ Rendering UI based on Session? → ✅ YES (UI Authority)
├─ Collecting user intent? → ✅ YES (UI Authority)
└─ Managing Activity lifecycle? → ✅ YES (UI Authority)
```

## Authority Cheat Sheet

### Native Owns (Semantic Authority)

**State:**
- `t_quickTask[app]` - Quick Task active timer (per-app)
- `t_intention[app]` - Intention timer (per-app)
- `n_quickTask` - Quick Task usage count (global)
- `quickTaskState[app]` - IDLE, DECISION, ACTIVE, POST_CHOICE
- `alternativeActivityRunning[app]` - Alternative activity state

**Decisions:**
- Whether Quick Task or Intervention is allowed
- When timers expire
- Whether to launch SystemSurface
- What wake reason to pass

**Forbidden:**
- ❌ UI rendering
- ❌ Navigation decisions
- ❌ Screen selection

### JavaScript Owns (UI Authority)

**Responsibilities:**
- Render UI for given Session
- Collect explicit user intent
- Manage SystemSurface lifecycle
- Gate UI rendering until ready

**Forbidden:**
- ❌ Create, modify, infer, or repair semantic state
- ❌ Run timers or expiration logic
- ❌ Decide whether Quick Task or Intervention is allowed
- ❌ Re-run OS Trigger Brain
- ❌ Read semantic state from AsyncStorage (in SystemSurface)

## Session vs Semantic State

### Session (Ephemeral Projection)

```typescript
Session = null | QUICK_TASK(app) | POST_CHOICE(app) | INTERVENTION(app)
```

**Properties:**
- Exists only in SystemSurface context
- Derived from semantic state + foreground app
- Destroyed when SystemSurface finishes
- NEVER mutates semantic state

**Mental Model:**
> "What system UI (if any) should be shown right now?"

### Semantic State (Source of Truth)

**Properties:**
- Persisted in Native
- Survives app switches
- Survives UI teardown
- Mutated only by timers or explicit user intent

**Mental Model:**
> "What is actually allowed right now?"

## System Brain vs OS Trigger Brain

### System Brain

- Long-lived JavaScript runtime (headless)
- Receives events from Native
- **Hosts OS Trigger Brain**
- Persists semantic state
- Survives Activity restarts

### OS Trigger Brain

- Pure decision function
- **Runs INSIDE System Brain**
- Stateless beyond what System Brain provides
- Evaluates priority chain
- **Never opens UI**
- **Never depends on Activity state**

**Key Principle:**
> System Brain hosts OS Trigger Brain. They are NOT peers.

## Quick Task Rules

### Definitions

- `t_quickTask`: Per-app timer (emergency allowance duration)
- `n_quickTask`: Global usage count (shared across all monitored apps)
- `t_intention`: Per-app timer (user-set intention)

### Expiration Scenarios

**Case 1: User still on app**
```
t_quickTask expires → POST_CHOICE screen
├─ Continue → User continues using app
└─ Quit → Launch home screen
```

**Case 2: User not on app**
```
t_quickTask expires → Clear state
└─ Next app open → Normal entry logic
    ├─ n_quickTask > 0 → Quick Task dialog
    └─ n_quickTask == 0 → Intervention
```

### Entry Logic Flow

```
1. Check t_intention for this app
   ├─ t_intention != 0 → NO Quick Task, NO Intervention
   └─ t_intention == 0 → Go to step 2

2. Check n_quickTask
   ├─ n_quickTask != 0 → Go to step 3
   └─ n_quickTask == 0 → Start Intervention

3. Check t_quickTask
   ├─ t_quickTask != 0 → NO Quick Task, NO Intervention
   └─ t_quickTask == 0 → Start Quick Task dialog
```

## POST_CHOICE Invariants

**What it is:**
- Semantic state (owned by Native)
- Represents: Quick Task expired while app was foreground

**Rules:**
- ✅ UI shown once per expiration
- ✅ Persisted across restarts
- ✅ Never re-emitted without user intent

**Allowed resolutions:**
- `POST_CONTINUE` - User chose to continue
- `POST_QUIT` - User chose to quit

**Forbidden:**
- ❌ Re-emitting on app reopen
- ❌ Clearing on foreground change
- ❌ Treating like an intervention

## Incomplete Intervention Cancellation

### Cancel if incomplete:
- `breathing` - User hasn't finished breathing
- `root-cause` - User hasn't selected causes
- `alternatives` - User hasn't chosen alternative
- `action` - User hasn't started activity
- `reflection` - User hasn't finished reflection

### Preserve if complete:
- `action_timer` - User is doing alternative activity
- `timer` - User set t_intention (transitions to idle, launches app)
- `idle` - No intervention

**Key Insight:**
> When user sets t_intention, intervention completes → idle → app launches normally. t_intention timer suppresses future interventions until it expires.

## Red Flags (Stop Immediately)

If you see ANY of these, STOP and FIX:

- ❌ Kotlin code checks `n_quickTask`
- ❌ Kotlin code chooses Quick Task vs Intervention
- ❌ SystemSurface uses setTimeout for semantic timers
- ❌ SystemSurface reads semantic state from AsyncStorage
- ❌ SystemSurface re-runs OS Trigger Brain
- ❌ OS Trigger Brain runs inside SystemSurface
- ❌ Session lifecycle mutates semantic state
- ❌ Activity lifecycle decides semantics
- ❌ JS creates, modifies, infers, or repairs semantic state

## Final Rule

> **Semantics decide what is allowed. UI decides when it can be shown. These responsibilities must never be inverted.**

## Responsibility Matrix

| Responsibility | Native | JS |
|----------------|--------|-----|
| Semantic truth (what is allowed) | ✅ | ❌ |
| Timers / quota / expiration | ✅ | ❌ |
| Decision correctness | ✅ | ❌ |
| When UI can be rendered | ❌ | ✅ |
| Surface lifecycle gating | ❌ | ✅ |
| Queuing decisions until UI ready | ❌ | ✅ |

## Before Making Changes

1. ✅ Read Architecture Invariants in CLAUDE.md
2. ✅ Verify against Responsibility Matrix
3. ✅ Check for forbidden patterns
4. ✅ Ensure authority split is maintained
5. ✅ Treat Session as projection, not state

## References

- **Authoritative Specifications (V3):**
  - `spec/BreakLoop Architecture v3.docx` - **V3 AUTHORITATIVE**
  - `spec/break_loop_architecture_invariants_v_3.md` - **V3 AUTHORITATIVE**
  - `spec/break_loop_os_runtime_contract.md` - **V3 AUTHORITATIVE**
  - `spec/Intervention_OS_Contract_V2.docx` - **V3 AUTHORITATIVE**
- **Deprecated (Historical Only):**
  - `spec/Old/BreakLoop Architecture v2.docx`
  - `spec/Old/BreakLoop Architecture Invariants v2.docx`
  - `spec/Old/Intervention_OS_Contract_V1.docx`
  - `spec/Old/Architecture Invariants.docx`
  - `spec/Old/Relationship Between System Brain And Os Trigger Brain.docx`
  - `spec/Old/Session and Timer relationship.docx`
