# UX Documentation Summary

This directory contains comprehensive UX documentation for the BreakLoop Android app based on the current implementation (not future plans).

## Documentation Files

### 1. [flow.md](./flow.md)
**Purpose**: Describes all user-facing flows end-to-end

**Contents**:
- **Mermaid flowcharts** for:
  - Quick Task Flow (OFFERING → ACTIVE → POST_CHOICE)
  - Intervention Flow (Breathing → Root Cause → Alternatives → Action/Timer → Reflection)
  - No-Action Flow (blocked entries)
  - Fallback/Error Flow (recovery mechanisms)
- **Detailed step-by-step breakdowns** for each flow including:
  - Trigger conditions
  - Surfaces shown
  - User actions available
  - Exit conditions
  - Next steps
  - Timeout rules
  - Back button behavior
- **State machine diagrams** for Quick Task and Intervention
- **Navigation rules** and error handling

---

### 2. [surfaces.md](./surfaces.md)
**Purpose**: Inventory of every UI surface (activities/screens/dialogs/overlays)

**Contents**:
- **Comprehensive surface table** with columns:
  - Surface name
  - Trigger conditions
  - Blocking level (full-screen vs non-blocking)
  - Dismiss rules
  - Timeout rules
  - Back button behavior
  - Implementation notes
- **Detailed specifications** for each surface:
  - SystemSurfaceActivity (native container)
  - Quick Task surfaces (Dialog, Post-Choice)
  - Intervention surfaces (Breathing, Root Cause, Alternatives, Action Confirmation, Activity Timer, Reflection, Intention Timer)
  - Main app surfaces (MainActivity, Settings, Edit Apps)
- **Surface launch patterns** (native-initiated vs user-initiated)
- **Surface coordination** (mutual exclusion, flow switching)
- **Accessibility** and performance metrics

---

### 3. [ux_issues_template.md](./ux_issues_template.md)
**Purpose**: Template for logging UX issues discovered during testing

**Contents**:
- **Issue template** with fields:
  - Title
  - Flow location
  - Reproduction steps
  - Expected vs Actual behavior
  - Severity (Critical/High/Medium/Low)
  - Frequency (Always/Often/Sometimes/Rare)
  - Evidence (logs, screenshots, video, device)
  - Related code references
  - Proposed fix
- **Example issues** demonstrating proper documentation:
  - Quick Task Dialog not showing
  - Post-QT Choice showing after app switch
  - Breathing screen stuck at 0
  - Hardware back button working when it shouldn't
- **Investigation checklist** for debugging:
  - Log tags to check
  - State variables to inspect
  - Timing measurements
  - Edge cases to test
- **Common patterns** (stuck surface, missing surface, wrong surface, premature dismissal)
- **Priority matrix** (severity × frequency → priority)

---

### 4. [settings_spec.md](./settings_spec.md)
**Purpose**: List all settings with default values and exact behavior impact

**Contents**:
- **Monitored Apps** (default: empty)
  - Which apps trigger interventions
  - Sync to native immediately
- **Quick Task Settings**:
  - **Duration (t_quickTask)**: Default 3 minutes, range 10s-5m
  - **Uses Per Window (n_quickTask)**: Default 1, range 1-10
  - **Window Duration**: Default 15 minutes, range 15m-24h
  - **Premium Status**: Default true (hardcoded)
- **Intervention Preferences**:
  - **Breathing Duration**: Default 5 seconds, range 5-30s
- **Social Privacy** (UI only, not yet functional):
  - Share Current Activity
  - Share Upcoming Activities
  - Share Recent Mood
  - Share Alternatives List
- **Profile Settings** (UI only, not yet functional):
  - Display Name
  - Profile Photo
- **System Settings**:
  - Accessibility Service Status (read-only)
- **Implementation references** for each setting:
  - File locations (JS and Native)
  - Storage keys
  - Sync behavior
  - Validation rules
- **Settings impact matrix** showing what each setting affects and when

---

### 5. [event_log_map.md](./event_log_map.md)
**Purpose**: Maps log tags/events to their meaning and documents state variables

**Contents**:
- **Log tags reference** with detailed explanations:
  - **Core System**: DECISION_GATE, QT_STATE, QT_FINISH, SS_BOOT, SS_LIFE, INTENT, SURFACE_FLAG
  - **Entry/Blocking**: ENTRY_START, ENTRY_BLOCK, ENTRY_IGNORED
  - **Foreground Detection**: FG_RAW, FG_EVENT
  - **Service Lifecycle**: SERVICE_LIFE
  - **Watchdog/Recovery**: SS_WD, SURFACE_RECOVERY
  - **Canary/Build**: SS_CANARY, SS_BUILD
  - **Development**: QT_DEV, QT_GUARD
- **State variables reference**:
  - Quick Task state (`quickTaskMap`, session IDs)
  - Quota state (`cachedQuotaState`)
  - Intention state (`cachedIntentions`)
  - Intervention preservation (`preservedInterventionFlags`)
  - Surface state (`isSystemSurfaceActive`)
  - Foreground state (`currentForegroundApp`, `lastRealForegroundPkg`)
- **State reset matrix** showing when each variable resets and to what value
- **Quota refill logic** (window-based and settings-based)
- **Log analysis examples** with annotated log sequences

---

## How to Use This Documentation

### For Developers

**Debugging a flow issue**:
1. Read `flow.md` to understand the expected flow
2. Check `event_log_map.md` for relevant log tags
3. Filter logs: `adb logcat -s DECISION_GATE QT_STATE SS_BOOT SS_LIFE`
4. Compare actual logs to expected flow in `flow.md`
5. Log issue using template in `ux_issues_template.md`

**Adding a new surface**:
1. Document in `surfaces.md` (trigger, blocking level, dismiss rules, etc.)
2. Update `flow.md` with new flow steps
3. Add relevant log tags to `event_log_map.md`

**Changing a setting**:
1. Update `settings_spec.md` with new default or behavior
2. Update implementation references
3. Test and verify sync behavior

---

### For Testers

**Reporting a bug**:
1. Reproduce the issue
2. Capture logs: `adb logcat -v time > bug_logs.txt`
3. Use template in `ux_issues_template.md`
4. Include:
   - Exact reproduction steps
   - Expected vs actual behavior
   - Severity and frequency
   - Logs and screenshots

**Verifying a flow**:
1. Read `flow.md` for expected behavior
2. Check `surfaces.md` for surface specifications
3. Test each step in the flow
4. Verify timeout, dismiss, and back button behavior

---

### For Product/Design

**Understanding current behavior**:
1. Read `flow.md` for high-level flows
2. Read `surfaces.md` for UI surface details
3. Read `settings_spec.md` for configurable behavior

**Planning changes**:
1. Check `flow.md` to see how change affects existing flows
2. Check `surfaces.md` to see if new surfaces are needed
3. Check `settings_spec.md` to see if new settings are needed

---

## Key Principles

These docs describe **implemented behavior only**, not:
- Future plans
- Planned features
- Deprecated flows
- Experimental code

All information is based on:
- Current codebase (as of 2026-02-12)
- Actual implementation in Kotlin and TypeScript
- Tested behavior on Android devices

---

## Maintenance

**When to update**:
- After implementing a new flow
- After adding/removing a surface
- After changing a setting's behavior
- After fixing a bug that changes flow behavior
- After adding new log tags

**How to update**:
1. Identify which doc(s) are affected
2. Update the relevant sections
3. Verify accuracy against code
4. Test the documented behavior

---

## Quick Reference

### Common Log Filters

**Quick Task flow**:
```bash
adb logcat -s DECISION_GATE QT_STATE QT_FINISH SS_BOOT SS_LIFE INTENT
```

**Surface lifecycle**:
```bash
adb logcat -s SS_BOOT SS_LIFE SURFACE_FLAG SS_WD SURFACE_RECOVERY
```

**Entry blocking**:
```bash
adb logcat -s DECISION_GATE ENTRY_BLOCK ENTRY_START ENTRY_IGNORED
```

**Foreground detection**:
```bash
adb logcat -s FG_RAW FG_EVENT
```

---

### State Variable Quick Lookup

| Variable | File | Line (approx) |
|----------|------|---------------|
| `quickTaskMap` | ForegroundDetectionService.kt | ~113 |
| `cachedQuotaState` | ForegroundDetectionService.kt | ~134 |
| `cachedIntentions` | ForegroundDetectionService.kt | ~136 |
| `isSystemSurfaceActive` | ForegroundDetectionService.kt | ~153 |
| `interventionState` | InterventionProvider.tsx | - |

---

### Settings Quick Lookup

| Setting | Default | File | Storage Key |
|---------|---------|------|-------------|
| Monitored Apps | Empty | osConfig.ts | `monitored_apps_v1` |
| Quick Task Duration | 3 min | osConfig.ts | `quick_task_settings_v1` |
| Quick Task Uses | 1 | osConfig.ts | `quick_task_settings_v1` |
| Quick Task Window | 15 min | osConfig.ts | `quick_task_settings_v1` |
| Breathing Duration | 5 sec | osConfig.ts | `intervention_preferences_v1` |

---

## Related Documentation

- **Architecture**: `docs/ARCHITECTURE_QUICK_REFERENCE.md`
- **Build Guide**: `docs/BUILD_AND_TEST_GUIDE.md`
- **Phase Summaries**: `PHASE_4_*.md` files in root
- **Knowledge Items**: See conversation summaries for Quick Task Architecture

---

## Feedback

If you find inaccuracies or missing information in these docs, please:
1. Verify against current codebase
2. Log an issue using `ux_issues_template.md`
3. Update the relevant doc(s)
4. Test the documented behavior

---

**Last Updated**: 2026-02-12  
**Codebase Version**: Current implementation (all flows functional)  
**Documentation Scope**: Implemented behavior only (no future plans)
