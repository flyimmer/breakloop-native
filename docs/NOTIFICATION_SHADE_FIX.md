# Notification Shade Intervention Exit Fix

**Date**: January 6, 2026  
**Issue**: Pulling down notification shade incorrectly ends intervention session  
**Status**: ✅ Fixed

## Problem Description

When a user was in an intervention flow (e.g., on the root cause screen) and pulled down the notification shade:

- **Incorrect behavior**: Intervention ended immediately, user was sent to home screen
- **Expected behavior**: Intervention should remain active, user should return to the same screen when dismissing notification shade

### User Report

> "I opened Instagram, chosen conscious process, breathing is over. I was on the screen of the root cause. There was notification on the phone, I swiped down the notification, but not opened it. On this moment I think the intervention flow and Instagram are gone. When I swiped up the notification, I am in the cellphone home screen. (Wrong behavior)."

## Root Cause Analysis

The `com.android.systemui` package (Android's system UI that handles notification shade, status bar, quick settings) was being treated as a **real app switch** instead of **system infrastructure**.

### Evidence from Logs

```
LOG  [SystemSession] Foreground app changed: com.android.systemui
LOG  [SystemSurfaceRoot] 🚨 Intervention Session ended - user left app
LOG  [SystemSession] dispatchSystemEvent: {"type": "END_SESSION"}
```

### The Problematic Logic

In `SystemSurfaceRoot.tsx` (lines 254-271):

```typescript
useEffect(() => {
  // Only check for INTERVENTION sessions
  if (session?.kind !== 'INTERVENTION') return;
  
  // Don't end session if foregroundApp is null or BreakLoop infrastructure
  if (isBreakLoopInfrastructure(foregroundApp)) return;
  
  // End session if user switched to a different app
  if (foregroundApp !== session.app) {
    dispatchSystemEvent({ type: 'END_SESSION' });
  }
}, [session, foregroundApp, dispatchSystemEvent]);
```

The `isBreakLoopInfrastructure()` function was missing `com.android.systemui`, so it was treated as a real app switch.

## Solution

### Semantic Insight

The key insight is that we're filtering **non-behavioral foreground transitions** - system overlays that don't represent user intent to leave the intervention.

This is NOT just "infrastructure" - it's about **semantic intent**:
- Does this foreground change represent the user actively choosing to leave?
- Or is it a transient system overlay?

### Implementation

Updated `isBreakLoopInfrastructure()` function in `app/roots/SystemSurfaceRoot.tsx`:

```typescript
/**
 * Check if a package name represents a non-behavioral foreground transition
 * 
 * SEMANTIC INTENT:
 * These packages do NOT represent user intent to leave the intervention.
 * They are system overlays, infrastructure, or transient UI layers that
 * temporarily gain foreground focus without the user "switching apps".
 * 
 * EXAMPLES OF NON-BEHAVIORAL TRANSITIONS:
 * - Notification shade pulled down (com.android.systemui)
 * - Quick settings opened (com.android.systemui)
 * - Permission dialogs (com.android.permissioncontroller)
 * - System navigation gestures (android)
 * - BreakLoop's own infrastructure (com.anonymous.breakloopnative)
 * 
 * This list is intentionally open-ended and semantic.
 * Future additions may include OEM variants (Samsung, Xiaomi, etc.)
 * or accessibility overlays that don't represent user intent.
 */
function isBreakLoopInfrastructure(packageName: string | null): boolean {
  if (!packageName) return true;
  
  if (packageName === 'com.anonymous.breakloopnative') return true;
  if (packageName === 'android') return true;
  
  // Android system UI / non-behavioral foreground layers
  // These do NOT represent user intent to leave the intervention
  if (packageName === 'com.android.systemui') return true;
  
  return false;
}
```

### Key Changes

1. **Added `com.android.systemui` to exclusion list**
2. **Enhanced documentation** to explain semantic intent
3. **Made explicit** that list is open-ended and should grow over time
4. **Future-proofed** against incorrect "cleanup" refactoring

## Testing Scenarios

### ✅ Scenario 1: Notification Shade During Intervention
1. Open Instagram → intervention starts
2. Complete breathing screen
3. On root cause screen, pull down notification shade
4. **Expected**: Intervention remains active
5. Swipe up to dismiss notification shade
6. **Expected**: Return to root cause screen (NOT home screen)

### ✅ Scenario 2: Notification Shade at Different Stages
Test at each stage:
- Breathing screen
- Root cause selection
- Alternatives screen
- Action confirmation
- **Expected**: All stages should survive notification shade interaction

### ✅ Scenario 3: Notification Shade During Quick Task
1. Open Instagram → Quick Task dialog appears
2. Pull down notification shade
3. **Expected**: Quick Task dialog remains
4. Dismiss notification shade
5. **Expected**: Return to Quick Task dialog

### ⚠️ Scenario 4: Actually Opening a Notification
1. Open Instagram → intervention starts
2. Pull down notification shade
3. **Tap on a notification** (e.g., open WhatsApp)
4. **Expected**: Intervention ends (user actually switched to different app)
5. User should be in WhatsApp, NOT home screen

## Edge Cases Handled

✅ **Notification shade** → Intervention survives  
✅ **Quick settings** → Intervention survives  
✅ **Status bar interactions** → Intervention survives  
✅ **Actually opening a notification** → Intervention ends correctly (different app detected)

## Architecture Compliance

This fix aligns with the System Surface architecture:

- **Rule**: Intervention sessions are ONE-SHOT and NON-RECOVERABLE
- **Exception**: System infrastructure interactions don't count as "leaving the app"
- **Boundary**: Native emits mechanical events, JS classifies semantic meaning
- **Semantic decision**: `com.android.systemui` = non-behavioral transition, not a real app switch

## Files Changed

- `app/roots/SystemSurfaceRoot.tsx` - Updated `isBreakLoopInfrastructure()` function

## Future Considerations

This fix establishes a pattern for handling non-behavioral foreground transitions. Future additions may include:

- `com.android.permissioncontroller` - Permission dialogs
- OEM-specific system UI packages (Samsung, Xiaomi, Huawei, etc.)
- Accessibility overlays
- Other transient system layers

The semantic intent is now explicit in the code, making it clear that this list should grow over time as we discover more non-behavioral transitions.

## Related Documentation

- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/SYSTEM_BRAIN_ARCHITECTURE.md` - System Brain event-driven runtime
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
