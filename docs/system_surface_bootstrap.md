# SYSTEM_SURFACE_BOOTSTRAP.md

## Purpose

This document defines the **authoritative cold-start bootstrap lifecycle** for `SystemSurfaceActivity` in BreakLoop.

It exists to prevent:
- premature `finish()` of SystemSurfaceActivity
- session creation in the wrong React context
- UI blocking or disappearing during cold start
- semantic drift between Native and JavaScript layers

If behavior contradicts this document, the implementation is wrong.

---

## Core Principle (Non‑Negotiable)

> **SystemSurfaceActivity must survive long enough for JavaScript to decide whether a SystemSession exists.**

During cold start:
- `session === null` does **NOT** mean “finish immediately”
- it means **“decision not made yet”**

---

## Key Concepts

### Runtime Context

Determines *which UI world* React Native is running in.

```ts
type RuntimeContext = 'MAIN_APP' | 'SYSTEM_SURFACE';
```

- `MainActivity` → `MAIN_APP`
- `SystemSurfaceActivity` → `SYSTEM_SURFACE`

---

### System Session

Defines **whether SystemSurfaceActivity has a legitimate reason to exist**.

```ts
type SystemSession =
  | { kind: 'INTERVENTION'; app: AppId }
  | { kind: 'QUICK_TASK'; app: AppId }
  | { kind: 'ALTERNATIVE_ACTIVITY'; app: AppId }
  | null;
```

Invariant:
```ts
SystemSurfaceActivity.isAlive === (SystemSession !== null)
```

---

### Bootstrap State

Bootstrap state exists **only** to protect cold start.

```ts
type SessionBootstrapState = 'BOOTSTRAPPING' | 'READY';
```

- Initial state: `BOOTSTRAPPING`
- Exit condition: **JS finishes OS Trigger evaluation**

Bootstrap is **not a timeout** and **not a native concern**.

---

## Cold Start Timeline (Linear)

```
t0  用户打开 Instagram
t1  Android OS 切换前台应用 → Instagram
t2  AccessibilityService 仍然存活
t3  AccessibilityService 发现 monitored app
t4  Native 决定：需要唤醒 SystemSurface
t5  Native 启动 SystemSurfaceActivity
t6  Android 创建 NEW Activity + NEW RN Context
t7  React Native 初始化
t8  SystemSurfaceRoot 首次 render
     - session = null
     - bootstrapState = BOOTSTRAPPING
     - ❌ 不允许 finish
t9  JS 从 native 读取：
     - wakeReason
     - triggeringApp
t10 JS 在【SystemSurface Context】运行 OS Trigger Brain
t11 OS Trigger Brain 做出决定：
     - START_INTERVENTION / START_QUICK_TASK /
       START_ALTERNATIVE_ACTIVITY / DO_NOTHING
t12 JS dispatch SystemSession event
t13 JS 设置 bootstrapState = READY
t14 SystemSurfaceRoot 再次 render
     - 如果 session !== null → render 对应 Flow
     - 如果 session === null → finish SystemSurfaceActivity

```
┌──────────────┐   ┌────────────────────────┐   ┌─────────────────────┐
│ Android OS   │   │ AccessibilityService   │   │ SystemSurfaceActivity│
└──────┬───────┘   └──────────┬─────────────┘   └──────────┬──────────┘
       │                       │                               │
       │ User opens Instagram  │                               │
       │──────────────────────▶│                               │
       │                       │                               │
       │                       │ Detect foreground change      │
       │                       │──────────────────────────────▶│
       │                       │                               │
       │                       │ Decide wake needed            │
       │                       │──────────────────────────────▶│
       │                       │                               │
       │                       │ Start Activity                │
       │                       │──────────────────────────────▶│
       │                       │                               │
       │                       │                               │ Create RN Context
       │                       │                               │───────────────▶
       │                       │                               │
       │                       │                               │ Initial render
       │                       │                               │ session=null
       │                       │                               │ bootstrap=BOOT
       │                       │                               │ ❌ no finish
       │                       │                               │
       │                       │                               │ Read wakeReason
       │                       │                               │───────────────▶
       │                       │                               │
       │                       │                               │ Run OS Trigger Brain
       │                       │                               │───────────────▶
       │                       │                               │
       │                       │                               │ Dispatch START_*
       │                       │                               │───────────────▶
       │                       │                               │
       │                       │                               │ bootstrap=READY
       │                       │                               │
       │                       │                               │ Render / Finish
       │                       │                               │───────────────▶



---

## SystemSurfaceRoot — Authoritative Logic

```tsx
function SystemSurfaceRoot() {
  const { session, bootstrapState } = useSystemSession();

  if (bootstrapState === 'BOOTSTRAPPING') {
    // Cold start phase — NEVER finish here
    return null;
  }

  if (session === null) {
    // Decision complete, no session needed
    finishSystemSurfaceActivity();
    return null;
  }

  switch (session.kind) {
    case 'INTERVENTION':
      return <InterventionFlow app={session.app} />;

    case 'QUICK_TASK':
      return <QuickTaskFlow app={session.app} />;

    case 'ALTERNATIVE_ACTIVITY':
      return <AlternativeActivityFlow app={session.app} />;
  }
}
```

---

## Context Ownership Rules

### JavaScript (SystemSurface Context)

MUST:
- run OS Trigger Brain
- decide whether to create SystemSession
- dispatch START_* events
- control bootstrap lifecycle

MUST NOT:
- assume session exists on mount
- finish activity during BOOTSTRAPPING

---

### JavaScript (MainApp Context)

MUST:
- request native wake only

MUST NOT:
- create or modify SystemSession
- dispatch START_* events

---

### Native (Kotlin)

MUST:
- wake SystemSurfaceActivity
- pass wakeReason + triggeringApp

MUST NOT:
- create session
- interpret session
- manage bootstrap

---

## Failure Modes & Diagnosis

| Symptom | Root Cause |
|------|-----------|
| App returns to Home immediately | finish() called during BOOTSTRAPPING |
| App hangs with no UI | Session created in MainApp context |
| No intervention shows | OS Trigger Brain not run in SystemSurface |
| Infinite loading | bootstrap never set to READY |

---

## Final Lock Rule

> **SystemSurfaceActivity may only finish after JavaScript has explicitly completed one OS Trigger evaluation cycle.**

If this rule is violated, the architecture is broken.

---

## Status

This document is **authoritative**.
Any future refactor must preserve this lifecycle exactly.

