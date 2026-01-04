---
name: Runtime Context and Session Refactor
overview: Refactor the BreakLoop architecture to introduce explicit RuntimeContext (MAIN_APP vs SYSTEM_SURFACE) with dual roots and session-driven SystemSurface lifecycle, preventing UI leakage and lifecycle bugs.
todos:
  - id: step-1-runtime-context
    content: Create RuntimeContextProvider and useRuntimeContext hook with native getRuntimeContext() method
    status: pending
  - id: step-2-system-session
    content: Create SystemSessionProvider with event-driven API (dispatchSystemEvent) and foregroundApp tracking (Rules 1, 2)
    status: pending
  - id: step-3-system-surface-root
    content: Create SystemSurfaceRoot.tsx with session-driven rendering, Alternative Activity visibility logic (Rule 1), and activity finish on null session (Rule 4)
    status: pending
  - id: step-4-main-app-root
    content: Create MainAppRoot.tsx with tabs and normal navigation (isolated from system flows)
    status: pending
  - id: step-5-refactor-app
    content: Refactor App.tsx to dual-root architecture based on RuntimeContext
    status: pending
  - id: step-6-intervention-flow
    content: Create InterventionFlow.tsx - internal navigation only, dispatches events for transitions (Rule 3)
    status: pending
  - id: step-7-quick-task-flow
    content: Create QuickTaskFlow.tsx - dispatches START_INTERVENTION or END_SESSION, no direct flow navigation (Rule 3)
    status: pending
  - id: step-8-alternative-activity-flow
    content: Create AlternativeActivityFlow.tsx - visibility handled by SystemSurfaceRoot (Rule 1), no flow imports (Rule 3)
    status: pending
  - id: step-9-native-runtime-context
    content: Add getRuntimeContext() method to AppMonitorModule.kt
    status: pending
  - id: step-10-os-trigger-brain
    content: Refactor osTriggerBrain.ts to use dispatchSystemEvent() instead of direct flow actions (Rule 2)
    status: pending
  - id: step-11-cleanup
    content: Remove QuickTaskProvider (absorbed into SystemSessionProvider), verify no UI leakage
    status: pending
  - id: step-12-verify-rules
    content: Verify all 4 safety rules - no flow-to-flow imports (Rule 3), event-only modification (Rule 2), visibility logic (Rule 1), session-only lifecycle (Rule 4)
    status: pending
---

# System Session and Runtime Context Architecture Refactor

## Current State Analysis

The current codebase has architectural issues that violate the principles defined in the spec:

**Current Problems:**

1. **Single Root Component**: `App.tsx` renders a single `RootNavigator` containing both main app tabs AND intervention screens, regardless of which Activity launched it.
2. **Navigation-Based Branching**: The system uses React Navigation state to switch between MainTabs and intervention screens, not session-based rendering.
3. **Mixed Concerns**: Both `MainActivity` and `SystemSurfaceActivity` load the same "main" component and rely on JS navigation logic to determine what to show.
4. **No Explicit RuntimeContext**: There is no mechanism to distinguish whether JS is running in `MainActivity` or `SystemSurfaceActivity`.
5. **No System Session Concept**: Flow state (intervention, Quick Task) is conflated with lifecycle decisions. There is no authoritative `SystemSession` that determines WHETHER the system surface should exist.

**Key Files to Modify:**

- [`app/App.tsx`](app/App.tsx) - Currently 810 lines, handles everything in one component
- [`app/navigation/RootNavigator.tsx`](app/navigation/RootNavigator.tsx) - Mixes main tabs with intervention screens
- [`src/contexts/InterventionProvider.tsx`](src/contexts/InterventionProvider.tsx) - Intervention state only
- [`src/contexts/QuickTaskProvider.tsx`](src/contexts/QuickTaskProvider.tsx) - Quick Task state only
- Kotlin: [`SystemSurfaceActivity.kt`](android/app/src/main/java/com/anonymous/breakloopnative/SystemSurfaceActivity.kt)
- Kotlin: [`AppMonitorModule.kt`](android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorModule.kt)

---

## Implementation Plan

### Step 1: Create RuntimeContext Hook

Create `src/contexts/RuntimeContextProvider.tsx`:

```typescript
type RuntimeContext = 'MAIN_APP' | 'SYSTEM_SURFACE';

const RuntimeContextContext = createContext<RuntimeContext>('MAIN_APP');

export function useRuntimeContext(): RuntimeContext {
  return useContext(RuntimeContextContext);
}

export const RuntimeContextProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const [runtime, setRuntime] = useState<RuntimeContext>('MAIN_APP');
  
  useEffect(() => {
    // Detect from native module which Activity we're in
    if (Platform.OS === 'android' && AppMonitorModule) {
      AppMonitorModule.getRuntimeContext()
        .then((ctx: string) => setRuntime(ctx as RuntimeContext))
        .catch(() => setRuntime('MAIN_APP'));
    }
  }, []);
  
  return (
    <RuntimeContextContext.Provider value={runtime}>
      {children}
    </RuntimeContextContext.Provider>
  );
};
```

**Native Changes Required:**

- Add `getRuntimeContext()` method to `AppMonitorModule.kt` that returns `"MAIN_APP"` or `"SYSTEM_SURFACE"` based on `currentActivity` type.

---

### Step 2: Create SystemSession State and Provider

Create `src/contexts/SystemSessionProvider.tsx`:

```typescript
type SystemSession =
  | { kind: 'INTERVENTION'; app: string }
  | { kind: 'QUICK_TASK'; app: string }
  | { kind: 'ALTERNATIVE_ACTIVITY'; app: string }
  | null;

// Event-based API (see Rule 2 in Session Semantics & Safety Rules)
type SystemSessionEvent =
  | { type: 'START_INTERVENTION'; app: string }
  | { type: 'START_QUICK_TASK'; app: string }
  | { type: 'START_ALTERNATIVE_ACTIVITY'; app: string }
  | { type: 'END_SESSION' };

interface SystemSessionContextValue {
  session: SystemSession;
  foregroundApp: string | null;  // Tracked for Alternative Activity visibility
  dispatchSystemEvent: (event: SystemSessionEvent) => void;
}
```

**Key Rules Encoded:**

- Only ONE session at a time (setting new session replaces old)
- Session is bound to exactly one app
- When `session === null`, SystemSurfaceActivity must finish
- Event-driven modification only (see Rule 2)
- Foreground app tracking for Alternative Activity visibility (see Rule 1)

---

### Step 3: Refactor App.tsx to Dual-Root Architecture

Restructure [`app/App.tsx`](app/App.tsx):

```typescript
function App() {
  const runtime = useRuntimeContext();
  
  if (runtime === 'SYSTEM_SURFACE') {
    return <SystemSurfaceRoot />;
  }
  
  return <MainAppRoot />;
}
```

**Roots are mutually exclusive. Never render both.**

---

### Step 4: Create SystemSurfaceRoot.tsx (Session-Driven)

Create `app/roots/SystemSurfaceRoot.tsx`:

```typescript
function SystemSurfaceRoot() {
  const { session, foregroundApp } = useSystemSession();
  
  // RULE 4: Session is the ONLY authority for SystemSurface existence
  if (session === null) {
    // CRITICAL: Finish activity when no session exists
    finishSystemSurfaceActivity();
    return null;
  }
  
  switch (session.kind) {
    case 'INTERVENTION':
      return <InterventionFlow app={session.app} />;
    
    case 'QUICK_TASK':
      return <QuickTaskFlow app={session.app} />;
    
    case 'ALTERNATIVE_ACTIVITY':
      // RULE 1: Alternative Activity visibility is conditional
      // Session remains active, but UI is hidden when user is in different app
      if (foregroundApp !== session.app) {
        // Render null but DO NOT end session or finish activity
        return null;
      }
      return <AlternativeActivityFlow app={session.app} />;
  }
}
```

**Rules (see Session Semantics & Safety Rules section):**

- NO tabs, NO settings, NO main app UI
- NO navigation-based branching
- `session.kind` is the ONLY selector (Rule 4)
- Alternative Activity renders null when foreground !== session.app (Rule 1)
- Flows dispatch events, they don't navigate to each other (Rule 3)

---

### Step 5: Create MainAppRoot.tsx

Create `app/roots/MainAppRoot.tsx`:

- Contains existing `MainNavigation` (tabs: Insights, Community, Inbox, Settings)
- Contains normal app navigation
- MUST NEVER render system flows
- MUST NEVER depend on SystemSession

---

### Step 6: Refactor Flow Components

**CRITICAL: Rule 3 applies to all flows - they MUST NOT navigate to each other directly.**

**InterventionFlow.tsx:**

- Receives `app` prop (not from global state)
- Internal navigation: breathing -> root-cause -> alternatives -> action -> action_timer -> reflection
- On completion: dispatches `{ type: 'END_SESSION' }` (NOT direct navigation)
- On start alternative: dispatches `{ type: 'START_ALTERNATIVE_ACTIVITY', app }`
- MUST NOT import or reference QuickTaskFlow or AlternativeActivityFlow

**QuickTaskFlow.tsx:**

- Shows Quick Task dialog screen
- On "Quick Task" chosen: starts Quick Task timer, dispatches `{ type: 'END_SESSION' }`, activity finishes, app launches
- On "Conscious Process": dispatches `{ type: 'START_INTERVENTION', app }` (NOT direct navigation)
- MUST NOT import or reference InterventionFlow or AlternativeActivityFlow

**AlternativeActivityFlow.tsx:**

- Shows Activity Timer UI
- Visibility controlled by SystemSurfaceRoot (Rule 1) - flow itself does not handle visibility
- On timer end or finish early: dispatches `{ type: 'END_SESSION' }`
- MUST NOT import or reference InterventionFlow or QuickTaskFlow

---

### Step 7: Session Lifecycle Integration

**Where SystemSession Lives:**

- `SystemSessionProvider` - React Context at root level
- Session state persisted minimally (just `{kind, app}` - no flow details)
- OS Trigger Brain dispatches session events via `dispatchSystemEvent()` (Rule 2)
- Only OS Trigger Brain and Flow Roots may dispatch events (Rule 2)

**How RuntimeContext is Injected:**

- Native `AppMonitorModule.getRuntimeContext()` checks `currentActivity`
- Returns `"MAIN_APP"` for `MainActivity`, `"SYSTEM_SURFACE"` for `SystemSurfaceActivity`
- JS reads this once on mount

**How session.kind Controls Rendering:**

- SystemSurfaceRoot does a `switch (session.kind)` - nothing else (Rule 4)
- Each flow component manages its own internal navigation
- Flow state (breathing count, selected causes) lives INSIDE flow components, not in session
- Flows transition via events, not navigation (Rule 3)

**How This Prevents UI Leakage:**

- MainActivity ALWAYS renders MainAppRoot (tabs)
- SystemSurfaceActivity ALWAYS renders SystemSurfaceRoot (session-driven)
- No navigation path from system flow to main tabs
- Session === null means activity MUST finish (Rule 4)
- Timers, navigation state, flow steps do NOT keep SystemSurface alive (Rule 4)

---

## File Structure After Refactor

```
app/
  App.tsx                      # Dual-root selector
  roots/
    MainAppRoot.tsx            # Tabs + normal navigation
    SystemSurfaceRoot.tsx      # Session-driven system UI
  flows/
    InterventionFlow.tsx       # Full intervention flow
    QuickTaskFlow.tsx          # Quick Task dialog + timer
    AlternativeActivityFlow.tsx # Action timer UI
  navigation/
    MainNavigation.tsx         # Bottom tabs (unchanged)
    CommunityStackNavigator.tsx # (unchanged)
  screens/
    conscious_process/         # Intervention screens (used by InterventionFlow)
    mainAPP/                   # Main app screens (used by MainAppRoot)

src/
  contexts/
    RuntimeContextProvider.tsx  # NEW: Runtime context
    SystemSessionProvider.tsx   # NEW: Session state
    InterventionProvider.tsx    # Existing: flow state machine (internal to InterventionFlow)
    QuickTaskProvider.tsx       # REMOVE: absorbed into SystemSessionProvider
  os/
    osTriggerBrain.ts          # Modified: dispatches session changes
```

---

## Migration Strategy

1. **Phase 1**: Add RuntimeContextProvider and SystemSessionProvider (parallel to existing code)
2. **Phase 2**: Create SystemSurfaceRoot and MainAppRoot
3. **Phase 3**: Wire up App.tsx dual-root
4. **Phase 4**: Refactor OS Trigger Brain to use session dispatcher
5. **Phase 5**: Remove legacy Quick Task provider (absorbed into session)
6. **Phase 6**: Verify session lifecycle rules

---

## Session Semantics & Safety Rules (NON-NEGOTIABLE)

These rules MUST be enforced during implementation. Any code that violates these rules is architecturally incorrect and must be rejected.

---

### Rule 1: Alternative Activity Visibility

**Statement:**

> If `SystemSession.kind === 'ALTERNATIVE_ACTIVITY'`:
> - SystemSurface UI MUST be rendered ONLY when `foregroundApp === session.app`
> - If `foregroundApp !== session.app`:
>   - SystemSurfaceRoot MUST render `null`
>   - Session MUST remain active (do NOT call `END_SESSION`)
>   - SystemSurfaceActivity MUST NOT be finished
>   - UI is considered "hidden", not "ended"

**Why This Rule Exists:**

Alternative Activity is unique among the three session types because it persists across app switches. The user may:
1. Start an alternative activity (e.g., "10-minute stretching")
2. Switch to another app temporarily
3. Return to the triggering app and see the timer still running

Without this rule, switching apps would either:
- Kill the session prematurely (losing timer progress)
- Show intervention UI over unrelated apps (UI leakage)

**Bugs This Prevents:**
- Timer restarting when user returns to app
- Activity timer appearing over unrelated apps
- Session being destroyed when user checks messages mid-activity
- "Ghost" sessions where timer runs but UI is unreachable

**Implementation Constraints:**
- `SystemSessionProvider` MUST track `foregroundApp` state
- `SystemSurfaceRoot` MUST check `foregroundApp` before rendering Alternative Activity
- Native layer MUST continue emitting foreground app change events to JS

---

### Rule 2: Session State Is Event-Driven

**Statement:**

> Session modification MUST use a single event-based API:
>
> ```typescript
> dispatchSystemEvent(event: SystemSessionEvent)
> ```
>
> Where `SystemSessionEvent` is one of:
> - `{ type: 'START_INTERVENTION'; app: string }`
> - `{ type: 'START_QUICK_TASK'; app: string }`
> - `{ type: 'START_ALTERNATIVE_ACTIVITY'; app: string }`
> - `{ type: 'END_SESSION' }`
>
> **Only the OS Trigger Brain and top-level Flow Roots may dispatch SystemSession events.**
> **No leaf component may directly modify SystemSession.**

**Why This Rule Exists:**

Direct setters (e.g., `setSession()`, `startInterventionSession()`) create multiple entry points for session modification, making it impossible to:
1. Audit who can change session state
2. Enforce transition rules (e.g., can't go from QUICK_TASK to ALTERNATIVE_ACTIVITY directly)
3. Add logging/debugging for session transitions
4. Prevent race conditions between concurrent modifications

**Bugs This Prevents:**
- Leaf components (buttons, timers) directly manipulating session state
- Untracked session transitions that bypass business logic
- Multiple components fighting over session state
- Inconsistent session state due to partial updates

**Implementation Constraints:**
- Remove all direct setters from `SystemSessionContextValue`
- `dispatchSystemEvent` is the ONLY way to modify session
- OS Trigger Brain calls `dispatchSystemEvent` for initial session creation
- Flow Roots call `dispatchSystemEvent` for transitions and termination
- Leaf components (screens, buttons) call callbacks passed from Flow Roots

---

### Rule 3: Flows Must Not Navigate Between Each Other

**Statement:**

> `InterventionFlow`, `QuickTaskFlow`, and `AlternativeActivityFlow` MUST NOT navigate to each other directly.
>
> Flows may only:
> - Render their own internal steps (screens)
> - Dispatch a SystemSession event via `dispatchSystemEvent()`
>
> Session transitions are handled exclusively by `SystemSurfaceRoot` reacting to `session.kind` changes.

**Why This Rule Exists:**

If flows can navigate to each other, they become coupled. This creates:
1. Import cycles between flow modules
2. Difficulty reasoning about which flow is "active"
3. Risk of rendering multiple flows simultaneously
4. Navigation stack pollution (old flow screens remaining in stack)

The correct pattern is:
```
QuickTaskFlow dispatches START_INTERVENTION
  → SystemSessionProvider updates session.kind to 'INTERVENTION'
  → SystemSurfaceRoot re-renders
  → SystemSurfaceRoot switch statement renders InterventionFlow
```

**Bugs This Prevents:**
- Flow A rendering Flow B as a child (nested flows)
- React Navigation trying to navigate from Flow A screen to Flow B screen
- "Back" button navigating across flow boundaries
- Memory leaks from unmounted-but-rendered flow components

**Implementation Constraints:**
- Flow components MUST NOT import other Flow components
- Flow components MUST NOT use `navigation.navigate()` to reach other flows
- Flow-to-flow transitions MUST go through `dispatchSystemEvent()`
- Each Flow is responsible ONLY for its internal screen navigation

---

### Rule 4: Session Is the Only Authority for SystemSurface

**Statement:**

> `SystemSurfaceActivity.isAlive === (SystemSession !== null)`
>
> Clarification:
> - Navigation state MUST NOT keep SystemSurface alive
> - Timers MUST NOT keep SystemSurface alive
> - Flow step state MUST NOT keep SystemSurface alive
> - ONLY SystemSession controls existence

**Why This Rule Exists:**

In the current architecture, multiple factors can accidentally keep SystemSurfaceActivity alive:
1. React Navigation has screens in the stack → activity stays alive
2. A timer is running → activity stays alive
3. Intervention state is not 'idle' → activity stays alive

This violates the principle that session is the single source of truth for lifecycle.

**Bugs This Prevents:**
- SystemSurface staying visible after user completes intervention (navigation stack not cleared)
- SystemSurface reappearing because a background timer fired
- "Zombie" SystemSurface that renders nothing but won't close
- Race conditions between timer expiry and user action

**Implementation Constraints:**
- `SystemSurfaceRoot` checks ONLY `session === null` to decide finish
- Flow internal state (breathing count, timer remaining) does NOT affect activity lifecycle
- When session becomes null, `finishSystemSurfaceActivity()` is called immediately
- No `setTimeout` or `useEffect` cleanup can prevent activity finish once session is null

---

## Safety Invariants (Verification Checklist)

- [ ] SystemSurfaceActivity never shows tabs or settings
- [ ] MainActivity never shows intervention screens
- [ ] When session === null, SystemSurfaceActivity finishes within one render cycle
- [ ] Only ONE session can exist at any time
- [ ] Session kind is the ONLY selector for system UI
- [ ] Flow state (breathing count, causes) does NOT affect session lifecycle
- [ ] Alternative Activity UI is hidden (not ended) when foreground !== session.app (Rule 1)
- [ ] All session modifications go through `dispatchSystemEvent()` (Rule 2)
- [ ] No flow component imports another flow component (Rule 3)
- [ ] Flows transition via events, not navigation (Rule 3)
- [ ] Timers, navigation stack, flow state cannot keep SystemSurface alive (Rule 4)
