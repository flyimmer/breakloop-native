# Documentation Update Summary (HISTORICAL)

> ⚠️ **DEPRECATED / HISTORICAL ONLY**
>
> This document summarizes an update from January 19, 2026, which was based on V1/V2 specifications.
> It has been superseded by the **V3 Architecture** update.
>
> **Reference:** `docs/V3_ARCHITECTURE_UPDATE_SUMMARY.md`


**Date:** January 19, 2026  
**Status:** Complete

## Overview

Updated `CLAUDE.md` and architecture documents according to the following authoritative specification documents:

1. `spec/Intervention_OS_Contract_V1.docx` (Updated 18.01.2026)
2. `spec/Relationship Between System Brain And Os Trigger Brain.docx`
3. `spec/Session And Timer Relationship (clarified).docx`
4. `spec/Architecture Invariants.docx`

## Files Updated

### 1. CLAUDE.md

**Added:**
- **Architecture Invariants (AUTHORITATIVE - Phase 4.2+)** section (lines 183-376)
  - Core Authority Split (Semantic vs UI Authority)
  - Session Is a Projection, Not State
  - UI Gating Responsibility
  - System Brain and OS Trigger Brain Relationship
  - Session Intent (Boundary Object)
  - SystemSurface (UI Renderer Only)
  - POST_CHOICE Invariants
  - What JS Must Never Do
  - Common Anti-Patterns (Explicitly Forbidden)
  - Final Rule with Responsibility Matrix

- **Quick Task Rules (Detailed Specification)** section (lines 529-621)
  - Definitions (t_quickTask, n_quickTask, t_intention)
  - Core Rules
  - Case 1: t_quickTask expires while user is still on app
  - Case 2: t_quickTask expires while user is NOT on app
  - Incomplete Intervention Cancellation rules
  - Logic Flow: t_intention, t_quickTask, n_quickTask
  - Intervention Restart Logic

**Key Changes:**
- Clarified that Native owns ALL semantic state
- JS owns UI rendering and lifecycle ONLY
- Session is ephemeral projection, not semantic state
- System Brain hosts OS Trigger Brain (not peers)
- Explicit POST_CHOICE invariants
- Detailed Quick Task expiration scenarios
- Incomplete intervention cancellation rules

### 2. docs/SYSTEM_BRAIN_ARCHITECTURE.md

**Added:**
- **Relationship with OS Trigger Brain (AUTHORITATIVE)** section (lines 39-68)
  - System Brain hosts OS Trigger Brain clarification
  - System Brain responsibilities
  - OS Trigger Brain responsibilities
  - What OS Trigger Brain must never do
  - Key principle: System Brain must never depend on SystemSurface timing

**Key Changes:**
- Explicitly states System Brain and OS Trigger Brain are NOT peers
- OS Trigger Brain is a pure decision function running INSIDE System Brain
- OS Trigger Brain must never open UI or depend on Activity state

### 3. docs/SYSTEM_SURFACE_ARCHITECTURE.md

**Added:**
- **Architectural Invariants (AUTHORITATIVE - Phase 4.2+)** section (lines 9-194)
  - Session Is a Projection, Not State
  - Core Authority Split (Foundational)
  - UI Gating Responsibility (Critical Clarification)
  - System Brain and OS Trigger Brain Relationship
  - SystemSurface (UI Renderer Only)
  - POST_CHOICE Invariants (Strict)
  - Common Anti-Patterns (Explicitly Forbidden)
  - Final Rule with Responsibility Matrix

**Key Changes:**
- Comprehensive architectural invariants at document start
- Session vs Semantic State distinction
- Semantic State (Source of Truth) definition
- Native owns all semantic state
- JS owns UI rendering and lifecycle only
- UI gating vs semantic authority clarification

### 4. docs/OS_Trigger_Contract V1.md

**Updated:**
- **Header**: Changed status to AUTHORITATIVE, added changelog and last updated date
- **Quick Task System** section completely rewritten with:
  - Updated definitions (clarified per-app vs global scope)
  - Core Rules (numbered 1-5)
  - Case 1: t_quickTask expires while user is still on app (with POST_CHOICE handling)
  - Case 2: t_quickTask expires while user is NOT on app
  - POST_CHOICE State (Critical) subsection with rules and forbidden behaviors
  - Intervention Restart Logic
- **Related Documentation** section reorganized into three categories:
  - Architecture Documents
  - Implementation Documents
  - Specification Documents (Source of Truth)

**Key Changes:**
- Detailed Quick Task expiration scenarios (Case 1 and Case 2)
- Explicit POST_CHOICE state definition and invariants
- Clarified that POST_CHOICE is semantic state owned by Native
- Added forbidden behaviors for POST_CHOICE handling
- Referenced source specification documents

## Key Architectural Principles Established

### 1. Authority Split

**Native (Semantic Authority):**
- ✅ Owns all semantic state
- ✅ Owns all timers and expiration logic
- ✅ Decides whether Quick Task or Intervention is allowed

**JavaScript (UI Authority):**
- ✅ Renders UI for a given Session
- ✅ Collects explicit user intent
- ✅ Manages SystemSurface lifecycle
- ✅ Gates UI rendering until SystemSurface is ready
- ❌ Does NOT make semantic decisions

### 2. Session as Projection

```typescript
Session = null | QUICK_TASK(app) | POST_CHOICE(app) | INTERVENTION(app)
```

- Session is ephemeral projection of semantic state onto UI
- Session lifecycle must NEVER mutate semantic state
- Session is a **view**, not the truth

### 3. System Brain and OS Trigger Brain

- System Brain **hosts** OS Trigger Brain (not peers)
- OS Trigger Brain is a pure decision function running INSIDE System Brain
- OS Trigger Brain must never open UI or depend on Activity state

### 4. Quick Task Rules

**Definitions:**
- `t_quickTask`: Per-app timer for emergency allowance
- `n_quickTask`: Global usage count across all monitored apps
- `t_intention`: Per-app timer set by user during intervention

**Expiration Scenarios:**
- **Case 1** (user still on app): Show POST_CHOICE screen with Continue/Quit options
- **Case 2** (user not on app): Clear state, no immediate intervention

**Incomplete Intervention Cancellation:**
- Cancel only if incomplete (breathing, root-cause, alternatives, action, reflection)
- Preserve if complete (action_timer, timer, idle)

### 5. Forbidden Patterns

- ❌ Running OS Trigger Brain inside SystemSurface
- ❌ Letting Activity lifecycle decide semantics
- ❌ Re-running decision logic because UI closed
- ❌ Treating Session as semantic state
- ❌ SystemSurface creating or modifying timers
- ❌ Native code choosing Quick Task vs Intervention
- ❌ JS creating, modifying, inferring, or repairing semantic state

## Responsibility Matrix

| Responsibility | Native | JS |
|----------------|--------|-----|
| Semantic truth (what is allowed) | ✅ | ❌ |
| Timers / quota / expiration | ✅ | ❌ |
| Decision correctness | ✅ | ❌ |
| When UI can be rendered | ❌ | ✅ |
| Surface lifecycle gating | ❌ | ✅ |
| Queuing decisions until UI ready | ❌ | ✅ |

## Final Rule

> **Semantics decide what is allowed. UI decides when it can be shown. These responsibilities must never be inverted.**

This rule is the foundation of Phase 4.2 and beyond.

## Verification

All updates are consistent with the specification documents and maintain architectural integrity. The documentation now provides:

1. ✅ Clear authority boundaries (Native vs JS)
2. ✅ Session as projection, not state
3. ✅ System Brain and OS Trigger Brain relationship
4. ✅ Detailed Quick Task rules and expiration scenarios
5. ✅ Incomplete intervention cancellation rules
6. ✅ Explicit forbidden patterns
7. ✅ Responsibility matrix for clarity

## Next Steps

Developers should:
1. Read the Architecture Invariants section in CLAUDE.md before making any changes
2. Verify all code changes against the Responsibility Matrix
3. Ensure no forbidden patterns are introduced
4. Maintain the authority split between Native (semantics) and JS (UI)
5. Treat Session as ephemeral projection, never as semantic state
