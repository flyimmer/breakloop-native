# Phone Call Intervention Fix

**Date**: January 6, 2026  
**Issue**: Incoming phone calls incorrectly end intervention session  
**Status**: ✅ Fixed

## Problem Description

When a user was in an intervention flow and received a phone call:

- **Incorrect behavior**: Intervention ended immediately when call came in, user was sent to home screen after call ended
- **Expected behavior**: Phone call should overlay intervention, user should return to same intervention screen after call ends

### User Report

> "As I was in the intervention flow, a call was coming. As I take the phone call, the intervention screen disappeared. After the phone call, we are on the cellphone home screen. Actually the phone call screen are allowed overlay our intervention flow, but afterward when the call finishes, our intervention flow shall stay on the same place."

## Root Cause Analysis

The `com.google.android.dialer` package (Google's phone dialer app for incoming/outgoing calls) was being treated as a **real app switch** instead of a **non-behavioral foreground transition**.

### Evidence from Logs

```
LOG  [SystemSession] Foreground app changed: com.google.android.dialer
LOG  [SystemSurfaceRoot] 🚨 Intervention Session ended - user left app
LOG  [SystemSession] dispatchSystemEvent: {"type": "END_SESSION"}
```

**Event Sequence:**
1. User in intervention (breathing → root cause screen)
2. Phone call comes in → `com.google.android.dialer` gains foreground
3. SystemSurfaceRoot detects this as "user left app" → Intervention ends
4. Session ends, SystemSurface finishes
5. After call ends, user is on home screen (not intervention)

### The Semantic Issue

**Phone calls are non-behavioral transitions:**
- User didn't **choose** to leave the intervention
- Phone call **interrupted** the intervention (system event)
- After call ends, user expects to **return to where they were**

This is identical to the notification shade issue - both are **system interruptions**, not **user-initiated app switches**.

## Solution

Added phone dialer packages to the infrastructure exclusion list in `isBreakLoopInfrastructure()` function.

### Implementation

Updated `app/roots/SystemSurfaceRoot.tsx`:

```typescript
// Phone call UI / non-behavioral interruptions
// These do NOT represent user intent to leave the intervention
// - Incoming phone calls
// - Outgoing phone calls
// - In-call UI
// User expects to return to intervention after call ends
if (packageName === 'com.google.android.dialer') return true;  // Google Dialer (Pixel, Android One)
if (packageName === 'com.android.incallui') return true;       // AOSP In-Call UI
if (packageName === 'com.android.dialer') return true;         // AOSP Dialer
if (packageName === 'com.android.phone') return true;          // Android Phone app
if (packageName === 'com.samsung.android.incallui') return true; // Samsung In-Call UI
if (packageName === 'com.samsung.android.dialer') return true;   // Samsung Dialer
```

### Why Multiple Packages?

Different Android devices use different dialer implementations:

- **Google Dialer** (`com.google.android.dialer`) - Pixel phones, Android One
- **AOSP Dialer** (`com.android.dialer`) - Stock Android
- **AOSP In-Call UI** (`com.android.incallui`) - Generic in-call screen
- **Android Phone** (`com.android.phone`) - System phone app
- **Samsung** (`com.samsung.android.*`) - Samsung devices
- **Future**: May need to add Xiaomi, Huawei, OnePlus variants

## Testing Scenarios

### ✅ Test 1: Incoming Call During Intervention

**Steps:**
1. Open monitored app → intervention starts
2. Complete breathing → reach root cause screen
3. **Receive an incoming phone call**
4. Answer the call
5. Talk for a few seconds
6. End the call

**Expected Result:**
- ✅ Phone call screen overlays intervention
- ✅ After call ends, you return to root cause screen
- ❌ You should NOT be sent to home screen

### ✅ Test 2: Outgoing Call During Intervention

**Steps:**
1. Open monitored app → intervention starts
2. Complete breathing → reach root cause screen
3. **Make an outgoing call** (dial a number)
4. Talk for a few seconds
5. End the call

**Expected Result:**
- ✅ Phone call screen overlays intervention
- ✅ After call ends, you return to root cause screen

### ✅ Test 3: Missed Call During Intervention

**Steps:**
1. Open monitored app → intervention starts
2. Complete breathing → reach root cause screen
3. **Receive an incoming call**
4. **Don't answer** (let it ring out or decline)

**Expected Result:**
- ✅ Call notification appears
- ✅ After call stops ringing, you return to root cause screen

### ✅ Test 4: Call at Different Intervention Stages

Test at each stage:
- Breathing screen
- Root cause selection
- Alternatives screen
- Action confirmation

**Expected**: All stages should survive phone call interruption

## Edge Cases Handled

✅ **Incoming calls** → Intervention survives  
✅ **Outgoing calls** → Intervention survives  
✅ **Missed calls** → Intervention survives  
✅ **In-call UI** → Intervention survives  
✅ **Multiple OEM dialers** → Intervention survives (Google, Samsung, AOSP)

## Architecture Compliance

This fix aligns with the System Surface architecture:

- **Rule**: Intervention sessions are ONE-SHOT and NON-RECOVERABLE
- **Exception**: System interruptions don't count as "leaving the app"
- **Semantic decision**: Phone calls = non-behavioral interruption, not a real app switch
- **Boundary**: Native emits mechanical events, JS classifies semantic meaning

## Files Changed

- `app/roots/SystemSurfaceRoot.tsx` - Added phone dialer packages to infrastructure list

## Related Issues

This is the **second instance** of the same architectural pattern:

1. **Notification Shade Fix** - `com.android.systemui` (January 6, 2026)
2. **Phone Call Fix** - `com.google.android.dialer` + variants (January 6, 2026)

Both follow the same principle: **Non-behavioral foreground transitions should not end intervention sessions.**

## Future Considerations

Other potential non-behavioral transitions to watch for:

- **Alarms** - `com.android.deskclock`, `com.google.android.deskclock`
- **Timers** - System timer notifications
- **Emergency alerts** - Government alerts, Amber alerts
- **System updates** - OS update notifications
- **Permission dialogs** - `com.android.permissioncontroller`
- **Biometric prompts** - Fingerprint, face unlock
- **OEM-specific** - Xiaomi, Huawei, OnePlus system apps

The semantic intent is now explicit in the code, making it clear that this list should grow as we discover more non-behavioral transitions.

## Related Documentation

- `docs/NOTIFICATION_SHADE_FIX.md` - Notification shade fix (same pattern)
- `docs/SYSTEM_SURFACE_ARCHITECTURE.md` - System Surface architecture
- `docs/NATIVE_JAVASCRIPT_BOUNDARY.md` - Architectural boundary rules
