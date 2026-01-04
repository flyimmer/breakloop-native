# System Session and Runtime Context Implementation Summary

## Overview

This document summarizes the implementation of the dual-root architecture with SystemSession-driven lifecycle management as specified in `ARCHITECTURE_v1_frozen.md`.

## Implementation Date

January 4, 2026

## Completed Components

### 1. RuntimeContext System ✅

**Files Created:**
- `src/contexts/RuntimeContextProvider.tsx` - Detects which Activity we're running in
- Added `getRuntimeContext()` method to `AppMonitorModule.kt`

**Purpose:** Distinguishes between MAIN_APP (MainActivity) and SYSTEM_SURFACE (SystemSurfaceActivity) contexts.

### 2. SystemSession Provider ✅

**Files Created:**
- `src/contexts/SystemSessionProvider.tsx` - Event-driven session state management

**Key Features:**
- Event-based API: `dispatchSystemEvent()` (Rule 2)
- Foreground app tracking for Alternative Activity visibility (Rule 1)
- Session types: INTERVENTION, QUICK_TASK, ALTERNATIVE_ACTIVITY, null
- Single source of truth for SystemSurface lifecycle (Rule 4)

### 3. Dual-Root Architecture ✅

**Files Created:**
- `app/roots/SystemSurfaceRoot.tsx` - Session-driven system UI root
- `app/roots/MainAppRoot.tsx` - Main app tabs and navigation root

**Files Modified:**
- `app/App.tsx` - Refactored to render appropriate root based on RuntimeContext

**Architecture:**
```
App.tsx
  ├─ RuntimeContext === 'MAIN_APP' → MainAppRoot (tabs, settings, community)
  └─ RuntimeContext === 'SYSTEM_SURFACE' → SystemSurfaceRoot (intervention flows)
```

### 4. Flow Components ✅

**Files Created:**
- `app/flows/InterventionFlow.tsx` - Full intervention flow (breathing → reflection)
- `app/flows/QuickTaskFlow.tsx` - Quick Task decision dialog
- `app/flows/AlternativeActivityFlow.tsx` - Activity timer UI

**Key Constraints (Rule 3):**
- Flows do NOT import each other
- Flows do NOT navigate to each other directly
- Flows dispatch SystemSession events for transitions
- SystemSurfaceRoot controls which flow renders based on session.kind

### 5. OS Trigger Brain Integration ✅

**Files Modified:**
- `src/os/osTriggerBrain.ts` - Added `setSystemSessionDispatcher()` and refactored to use event-driven API

**Changes:**
- Added `systemSessionDispatcher` alongside existing `interventionDispatcher`
- `startInterventionFlow()` now dispatches `START_INTERVENTION` event
- `showQuickTaskDialog()` now dispatches `START_QUICK_TASK` event
- Maintains backward compatibility during migration

## Safety Rules Verification

### Rule 1: Alternative Activity Visibility ✅

**Implementation:**
- `SystemSessionProvider` tracks `foregroundApp` via native events
- `SystemSurfaceRoot` checks `foregroundApp !== session.app` before rendering AlternativeActivityFlow
- When hidden, renders `null` but does NOT end session or finish activity

**Verified in:**
- `app/roots/SystemSurfaceRoot.tsx` lines 85-95

### Rule 2: Session State Is Event-Driven ✅

**Implementation:**
- `SystemSessionProvider` exposes only `dispatchSystemEvent()` (no direct setters)
- OS Trigger Brain uses `setSystemSessionDispatcher()` to connect
- Only OS Trigger Brain and Flow Roots dispatch events

**Verified in:**
- `src/contexts/SystemSessionProvider.tsx` - event-based reducer
- `src/os/osTriggerBrain.ts` - uses `systemSessionDispatcher`
- `app/flows/*.tsx` - flows call `dispatchSystemEvent()`

### Rule 3: Flows Must Not Navigate Between Each Other ✅

**Implementation:**
- No flow imports another flow (verified by checking import statements)
- Flows dispatch events: `START_INTERVENTION`, `START_ALTERNATIVE_ACTIVITY`, `END_SESSION`
- SystemSurfaceRoot's `switch (session.kind)` controls rendering

**Verified by:**
- `InterventionFlow.tsx` - no imports of QuickTaskFlow or AlternativeActivityFlow
- `QuickTaskFlow.tsx` - no imports of InterventionFlow or AlternativeActivityFlow
- `AlternativeActivityFlow.tsx` - no imports of InterventionFlow or QuickTaskFlow

### Rule 4: Session Is the Only Authority for SystemSurface ✅

**Implementation:**
- `SystemSurfaceRoot` checks `session === null` to finish activity
- `useEffect` in SystemSurfaceRoot calls `finishSystemSurfaceActivity()` when session becomes null
- Timers, navigation state, flow steps do NOT affect activity lifecycle

**Verified in:**
- `app/roots/SystemSurfaceRoot.tsx` lines 45-55 (session null check)
- No navigation-based lifecycle logic

## Migration Notes

### QuickTaskProvider Status

**Current State:** QuickTaskProvider still exists but is DEPRECATED.

**Reason:** The existing intervention screens (QuickTaskDialogScreen, QuickTaskExpiredScreen) still reference QuickTaskProvider's state. Full migration requires updating these screens to use SystemSession instead.

**Future Work:**
1. Update QuickTaskDialogScreen to use SystemSession context
2. Update QuickTaskExpiredScreen to use SystemSession context
3. Remove QuickTaskProvider entirely
4. Remove old intervention dispatcher from osTriggerBrain

### Backward Compatibility

The implementation maintains backward compatibility:
- `interventionDispatcher` still exists alongside `systemSessionDispatcher`
- OS Trigger Brain checks for `systemSessionDispatcher` first, falls back to old dispatcher
- This allows gradual migration of screens

## File Structure

```
app/
  App.tsx                      # Dual-root selector (REFACTORED)
  roots/                       # NEW
    MainAppRoot.tsx            # Main app tabs
    SystemSurfaceRoot.tsx      # Session-driven system UI
  flows/                       # NEW
    InterventionFlow.tsx       # Intervention flow
    QuickTaskFlow.tsx          # Quick Task flow
    AlternativeActivityFlow.tsx # Alternative Activity flow
  navigation/
    MainNavigation.tsx         # Bottom tabs (UNCHANGED)
    RootNavigator.tsx          # OLD - no longer used by new architecture
  screens/
    conscious_process/         # Intervention screens (UNCHANGED)
    mainAPP/                   # Main app screens (UNCHANGED)

src/
  contexts/
    RuntimeContextProvider.tsx  # NEW
    SystemSessionProvider.tsx   # NEW
    InterventionProvider.tsx    # UNCHANGED
    QuickTaskProvider.tsx       # DEPRECATED (to be removed)
  os/
    osTriggerBrain.ts          # MODIFIED (added SystemSession support)
    osConfig.ts                # UNCHANGED

android/app/src/main/java/com/anonymous/breakloopnative/
  AppMonitorModule.kt          # MODIFIED (added getRuntimeContext())
  SystemSurfaceActivity.kt     # UNCHANGED
  MainActivity.kt              # UNCHANGED
```

## Testing Recommendations

### Critical Test Scenarios

1. **MainActivity Launch**
   - Verify MainAppRoot renders with tabs
   - Verify no system flows are accessible

2. **SystemSurfaceActivity Launch (Intervention)**
   - Verify SystemSurfaceRoot renders
   - Verify InterventionFlow starts with breathing screen
   - Verify session.kind === 'INTERVENTION'

3. **SystemSurfaceActivity Launch (Quick Task)**
   - Verify QuickTaskFlow renders
   - Verify session.kind === 'QUICK_TASK'

4. **Alternative Activity Visibility**
   - Start alternative activity
   - Switch to different app
   - Verify UI is hidden (session remains active)
   - Return to triggering app
   - Verify UI reappears

5. **Session Lifecycle**
   - Complete intervention
   - Verify session becomes null
   - Verify SystemSurfaceActivity finishes

6. **Flow Transitions**
   - Quick Task → Choose "Conscious Process"
   - Verify session transitions to INTERVENTION
   - Verify InterventionFlow renders

## Known Issues / Future Work

1. **QuickTaskProvider Migration**
   - Screens still use QuickTaskProvider
   - Need to update screens to use SystemSession

2. **RootNavigator Cleanup**
   - Old RootNavigator.tsx is no longer used
   - Can be removed after verifying new architecture works

3. **Intervention State Machine Integration**
   - InterventionProvider still manages flow internal state
   - This is correct (flow state !== session state)
   - But connection between InterventionFlow and InterventionProvider could be cleaner

4. **Native Event Integration**
   - Need to test wake reason handling with new architecture
   - Verify QUICK_TASK_EXPIRED, MONITORED_APP_FOREGROUND, etc.

## Conclusion

The dual-root architecture with SystemSession-driven lifecycle has been successfully implemented according to the specification in `ARCHITECTURE_v1_frozen.md`. All four safety rules are enforced in the code.

The implementation provides:
- ✅ Clear separation between MainActivity and SystemSurfaceActivity UIs
- ✅ Session-driven lifecycle (Rule 4)
- ✅ Event-driven session modification (Rule 2)
- ✅ Decoupled flows with no cross-imports (Rule 3)
- ✅ Alternative Activity visibility logic (Rule 1)
- ✅ No UI leakage between roots
- ✅ Single source of truth for system surface existence

Next steps: Complete QuickTaskProvider migration and test all scenarios thoroughly.
