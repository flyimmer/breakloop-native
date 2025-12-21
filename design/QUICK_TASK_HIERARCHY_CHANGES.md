# Quick Task Dialog Hierarchy Changes

**Date:** December 21, 2025  
**Phase:** C/D - Quick Task Gate UI  
**File:** `app/screens/QuickTaskDialogScreen.tsx`

---

## Objective

Rebalance visual hierarchy so that "Go through conscious process" is the primary action, and "Quick Task" is clearly secondary, while preserving user autonomy and avoiding guilt-based design.

**Update:** Adjusted screen presentation to full-screen interruption posture with correct color treatment.

---

## Changes Made

### 1. Screen Presentation ✅

**BEFORE:**
- Modal card overlay on top of app context
- Backdrop with centered dialog card
- App context visible behind overlay

**AFTER:**
- **Full-screen interruption takeover**
- Background: `#0A0A0B` (matches BreathingScreen, RootCauseScreen)
- Dark, low-stimulation environment
- No underlying app context visible
- Content vertically centered
- Matches interruption screen posture

### 2. Button Hierarchy ✅

**BEFORE:**
- Quick Task button was PRIMARY (top position, energetic styling)
- Conscious process was SECONDARY (bottom position, less emphasis)

**AFTER:**
- **Conscious process is PRIMARY** (top position, strongest visual treatment)
  - Background: `#6B5FC9` (primaryMuted - calm, steady, not exciting)
  - Elevation: `elevation_1` (subtle presence)
  - No decorative icons
  - Font weight: `600` (clear emphasis)
  - Color: `#FAFAFA` (high contrast text)

- **Quick Task is SECONDARY** (bottom position, reduced emphasis)
  - Background: `#27272A` (surfaceSecondary - neutral, subtle)
  - Border: `1px solid #3F3F46` (minimal emphasis)
  - No elevation (flat appearance)
  - No accent color
  - Font weight: `500` (same as primary, but lower contrast)
  - Color: `#A1A1AA` (textSecondary - lower contrast)

### 2. Visual Order ✅

**BEFORE:**
```
[⚡ Quick Task (10 seconds)]  ← Top, energetic
[Go through conscious process] ← Bottom, subordinate
```

**AFTER:**
```
[🧭 Go through conscious process] ← Top, primary
[Quick Task]                       ← Bottom, secondary
```

### 3. Color Posture ✅

**BEFORE:**
- Primary button used `#8B7AE8` (full primary color)
- Higher saturation, more energetic presence
- Similar to main app action buttons

**AFTER:**
- Primary button uses `#6B5FC9` (primaryMuted)
- **Reduced saturation** compared to main app buttons
- Calm, steady accent color
- Feels default and intentional, not exciting
- Matches ActionConfirmationScreen's calm posture

### 4. Copy Refinement ✅

**BEFORE:**
- Quick Task button: "⚡ Quick Task (10 seconds)"
- Conscious process button: "🧭 Go through conscious process"
- Timing info in button label
- Decorative/energetic emojis

**AFTER:**
- Quick Task button: "Quick Task"
- Conscious process button: "Go through conscious process"
- No timing in button label
- **No decorative icons** (removed 🧭 and ⚡)
- Timing info moved to explanatory text: "Quick tasks skip the full intervention for urgent moments and expire automatically."

### 5. Guardrail Messaging ✅

**PRESERVED:**
- Usage limit: "1 left in this 15-minute window."
- Explanatory text about expiration behavior
- Informational tone (not threatening or guilt-inducing)

**LOCATION:**
- Usage limit: Above buttons (informational context)
- Expiration explanation: Below buttons (footnote)
- All text center-aligned for calm, balanced presentation

---

## Design Rationale

### Visual Weight Distribution

| Element | Visual Weight | Purpose |
|---------|--------------|---------|
| Conscious Process Button | **Highest** | Primary path - encouraged default |
| Quick Task Button | **Medium-Low** | Exception path - allowed but not promoted |
| Usage Limit Text | **Low** | Informational context |
| Explanatory Text | **Lowest** | Supporting information |

### Color Semantics

- **Background (`#0A0A0B`)**: Full-screen interruption state → matches other intervention screens
- **Primary Muted (`#6B5FC9`)**: Used for conscious process → calm, steady, default path
- **Surface Secondary (`#27272A`)**: Used for Quick Task → neutral, available but not primary
- **Text Primary (`#FAFAFA`)**: Used for primary button text → high contrast, readable
- **Text Secondary (`#A1A1AA`)**: Used for Quick Task text → lower contrast = less emphasis

### Spatial Hierarchy

1. **Top position** = Primary action (thumb-reachable, first in visual flow)
2. **Bottom position** = Secondary action (still accessible, but subordinate)
3. **No reversal of natural reading order** (top-to-bottom = importance)

---

## Constraints Respected

✅ **Did NOT remove Quick Task option**  
✅ **Did NOT add confirmation dialogs**  
✅ **Did NOT add warning or guilt language**  
✅ **Did NOT change logic, limits, or expiration behavior**  
✅ **Did NOT add new screens or steps**  

---

## User Experience Impact

### Before
- Quick Task appeared as the "fast" or "efficient" choice
- Visual hierarchy suggested Quick Task was the preferred path
- Energetic emoji (⚡) added motivational cue toward shortcut

### After
- Conscious process clearly presented as the normal, encouraged path
- Quick Task available but visually subordinate
- User autonomy preserved - both options remain accessible
- No guilt, shame, or warning language
- Hierarchy communicates intent through design, not coercion

---

## Implementation Notes

### File Structure
- Location: `app/screens/QuickTaskDialogScreen.tsx`
- Pattern: Follows existing screen patterns (e.g., `ActionConfirmationScreen.tsx`)
- Tokens: Uses design tokens from `design/ui/tokens.md`
- Gravity: Implements "Pause Moment" interaction gravity

### Styling Approach
- **Screen posture**: Full-screen takeover, not modal overlay
- **Background**: Dark (`#0A0A0B`), low-stimulation, matches BreathingScreen/RootCauseScreen
- **Primary button**: Subtle elevation, calm muted purple (`#6B5FC9`), intentional not exciting
- **Secondary button**: Flat, lower-contrast, neutral dark gray
- **No decorative icons**: Clean, text-only buttons
- **No animations**: Both respond to press with opacity change only
- **Consistent spacing and typography** with other intervention screens
- **Center-aligned content**: Balanced, calm presentation

### Accessibility
- Both buttons have adequate touch targets (44pt+ height)
- High contrast text on both buttons
- Clear visual distinction between primary and secondary
- Screen reader friendly (semantic button order matches visual order)

---

## Testing Checklist

- [ ] Primary button appears above secondary button
- [ ] Conscious process button has stronger visual presence
- [ ] Quick Task button is clearly secondary but still accessible
- [ ] No energetic or motivational cues on Quick Task
- [ ] Usage limit text is visible and informational
- [ ] Explanatory text is present but not threatening
- [ ] Close button works (returns to launcher without launching app)
- [ ] Both action buttons are thumb-reachable
- [ ] Press states work correctly on both buttons

---

## Related Files

- **Design Authority:**
  - `design/principles/interaction-gravity.md` - Pause Moment gravity
  - `design/ui/tokens.md` - Color, typography, spacing tokens
  - `design/ui/screens.md` - Quick Task Dialog specification
  - `design/ux/states.md` - Quick Task System behavior

- **Implementation Reference:**
  - `app/screens/ActionConfirmationScreen.tsx` - Similar button hierarchy pattern
  - `app/screens/RootCauseScreen.tsx` - Similar modal dialog pattern

---

## Future Considerations

### If Quick Task Usage Patterns Show Issues:
- Could add subtle animation to primary button (e.g., gentle pulse)
- Could increase size differential between buttons
- Could add more spacing between buttons
- **Should NOT:** Add warnings, guilt language, or remove Quick Task option

### If Users Report Confusion:
- Could add brief onboarding tooltip on first appearance
- Could adjust copy to be more explicit about paths
- **Should NOT:** Make Quick Task harder to access or add friction

---

**Status:** ✅ Complete  
**Next Steps:** Integrate into navigation flow and test with users

