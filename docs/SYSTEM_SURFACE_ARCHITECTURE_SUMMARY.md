# System Surface Architecture - Task Summary

**Date:** December 30, 2025  
**Task:** Formalize system-level UI architecture (conceptual foundation)

## What Was Done

### 1. Created Authoritative Architecture Document

**File:** `docs/SYSTEM_SURFACE_ARCHITECTURE.md`

**Contents:**
- ✅ Conceptual clarification of System Surface vs Intervention Activity
- ✅ Complete state diagrams for both flows
- ✅ Priority chain with locked order (AUTHORITATIVE)
- ✅ Detailed explanation of why flows are separate
- ✅ Clear decision authority (Native vs JavaScript)
- ✅ Future-proofing guidelines

### 2. Updated InterventionActivity Documentation

**File:** `plugins/src/android/java/com/anonymous/breakloopnative/InterventionActivity.kt`

**Changes:**
- ✅ Added conceptual role explanation
- ✅ Clarified it's a neutral System Surface
- ✅ Noted it hosts multiple independent flows
- ✅ Referenced the architecture document

## Key Architectural Decisions (LOCKED)

### System Surface Concept
- **What:** Neutral OS-level container for multiple flows
- **Why:** Infrastructure without semantics
- **Where:** `InterventionActivity` (implementation name)

### Two Separate Flows

**Quick Task Flow (Emergency):**
- Purpose: Emergency bypass for urgent app usage
- Scope: Global across all apps
- Screens: QuickTaskDialog, QuickTaskExpired
- Exit: Navigate to Home after expiry

**Intervention Flow (Conscious Process):**
- Purpose: Full mindfulness intervention
- Scope: Per-app independent
- Screens: Breathing, RootCause, Alternatives, Action, etc.
- Exit: Return to monitored app

### Priority Chain (AUTHORITATIVE)

```
1. Quick Task ACTIVE (global)      → Suppress everything
2. Alternative Activity RUNNING    → Suppress everything  
3. t_intention VALID (per-app)     → Suppress everything
4. n_quickTask > 0 (global)        → Show Quick Task dialog
5. Else                            → Start Intervention Flow
```

**This order MUST NOT change without updating the architecture document.**

### Decision Authority

**Native Code:** Infrastructure only
- ✅ Detect foreground apps
- ✅ Launch System Surface Activity
- ❌ Never interpret semantic logic

**JavaScript:** Semantics only
- ✅ Evaluate priority chain
- ✅ Check timers and states
- ✅ Decide which flow to show
- ✅ Single source of truth

## What This Achieves

### 1. Conceptual Clarity
- ✅ System Surface is neutral, not intervention-specific
- ✅ Two flows are separate and equal
- ✅ Priority chain is explicit and locked
- ✅ Responsibilities are clear

### 2. Implementation Guidance
- ✅ Developers know which code owns which decisions
- ✅ Future features have clear insertion points
- ✅ Testing can target flows independently
- ✅ No ambiguity about nesting or priority

### 3. Prevention of Drift
- ✅ Document is marked AUTHORITATIVE
- ✅ Anti-patterns are explicitly called out
- ✅ Rationale is documented
- ✅ Future changes must update the document

## Next Steps

With this foundation in place, we can now proceed to:

1. **Implement the Priority Chain** in `osTriggerBrain.ts`
   - Follow the locked order exactly
   - Dispatch to correct flows

2. **Refactor Native Code** in `ForegroundDetectionService.kt`
   - Remove semantic logic
   - Just launch System Surface
   - Let JavaScript decide

3. **Add Quick Task Expiry Screen**
   - New screen in Quick Task Flow
   - Show when timer expires
   - Navigate to Home on close

4. **Implement Action Dispatching**
   - `BEGIN_QUICK_TASK` (not `SHOW_QUICK_TASK`)
   - `BEGIN_INTERVENTION`
   - Never both

All implementation must follow the architecture document.

## Verification

Before proceeding with implementation, verify:
- ✅ Architecture document is clear and complete
- ✅ State diagrams are accurate
- ✅ Priority chain makes sense
- ✅ Code comments reference the document
- ✅ No ambiguity remains

**Status:** ✅ Ready for implementation

---

**This is the foundation. All future work builds on this.**

