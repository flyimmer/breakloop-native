# 🧠 System Session Definition (Authoritative)

## Purpose of System Session

A System Session represents the only legitimate reason for the SystemSurfaceActivity to exist and render UI.

**If there is no active System Session, the SystemSurfaceActivity must not exist.**

A session does not represent:
- a timer
- a flow step
- a navigation state
- a user intention

It represents which system-level role BreakLoop is currently playing.

---

## Canonical Definition

```typescript
type SystemSession =
  | {
      kind: 'INTERVENTION';
      app: AppId;
    }
  | {
      kind: 'QUICK_TASK';
      app: AppId;
    }
  | {
      kind: 'ALTERNATIVE_ACTIVITY';
      app: AppId;
    }
  | null;
```

---

## Core Invariants (Non-Negotiable)

1. At most one System Session exists at any time
2. Every System Session is bound to exactly one app
3. SystemSurfaceActivity must exist if and only if SystemSession !== null
4. When SystemSession === null, SystemSurfaceActivity must immediately finish
5. System Session determines UI rendering, not navigation routes

---

## Session Is NOT Flow State

System Session must NOT contain:
- timers
- step indexes
- sub-states of flows
- UI navigation state

All such details belong to:
- Intervention Flow state machine
- Quick Task timer logic
- Alternative Activity (Action Timer) logic

---

## Session Types and Semantics

### 1. Intervention Session

**Definition**

An Intervention Session exists when the system requires the user to immediately stop and make a conscious decision.

**Entry Condition**
- Monitored app enters foreground
- No Quick Task active
- No Alternative Activity running
- No valid t_intention
- System determines intervention is required

**Exit Conditions**
- User selects Quick Task
- User sets t_intention
- User starts Alternative Activity
- User cancels / exits intervention

Once any exit condition is met, the Intervention Session must end.

---

### 2. Quick Task Session

**Definition**

A Quick Task Session exists when the user has been granted a temporary emergency bypass.

**Entry Condition**
- User chooses Quick Task
- n_quickTask > 0

**Lifecycle**
- Session exists for the duration of t_quickTask
- UI may be shown when user returns to the app
- System may display Quick Task Expired UI at the end

**Exit Conditions**
- t_quickTask expires AND user confirms closure

**After exit:**
- Session becomes null
- t_intention and other semantic timers are reset
- SystemSurfaceActivity must finish

---

### 3. Alternative Activity Session

**Definition**

An Alternative Activity Session exists when the system has accepted the user's commitment to perform a substitute activity and must support and accompany that activity.

**Entry Condition**
- User selects "Start Alternative Activity" during intervention

**Lifecycle**
- Session persists for the duration of the Action Timer
- Session is bound to the triggering app
- Session may be paused or hidden when user switches apps
- Session must be restored when user returns to the same app

**Visibility Rule**
- If foregroundApp === session.app → show Alternative Activity UI
- If foregroundApp !== session.app → hide SystemSurface UI (session still exists)

**Exit Conditions**
- Action Timer ends
- User finishes early

**After exit:**
- Session becomes null
- SystemSurfaceActivity must finish

---

## Relationship Between Session and UI

| System Session | SystemSurfaceActivity | UI Rendered |
|----------------|----------------------|-------------|
| null | ❌ must not exist | none |
| INTERVENTION | ✅ exists | Intervention Flow |
| QUICK_TASK | ✅ exists | Quick Task Flow |
| ALTERNATIVE_ACTIVITY | ✅ exists | Alternative Activity Flow |

---

## Summary Rule (Lock This)

**System Session defines whether the system surface exists and what role it plays.**

**Flow logic defines what happens inside that role.**