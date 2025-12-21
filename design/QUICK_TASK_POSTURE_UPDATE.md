# Quick Task Gate - Posture & Color Update

**Date:** December 21, 2025  
**Phase:** C/D - Quick Task Gate UI Refinement  
**File:** `app/screens/QuickTaskDialogScreen.tsx`

---

## Summary

The Quick Task gate has been updated from a modal card overlay to a **full-screen interruption state** with **correct color posture** to match other intervention screens.

---

## Key Changes

### 1. Screen Presentation: Modal → Full-Screen Interruption

**Before:**
- Modal card centered on backdrop
- App context visible behind overlay
- Felt like a "quick decision" moment
- Disconnected from intervention flow

**After:**
- Full-screen takeover
- Background: `#0A0A0B` (same as BreathingScreen, RootCauseScreen)
- Dark, low-stimulation environment
- No underlying context visible
- Feels like an **intentional pause moment**
- Consistent with intervention screen posture

**Rationale:**
The Quick Task gate is the entry point to the intervention flow. It should feel like an interruption state, not a quick popup. The full-screen presentation:
- Signals importance and intentionality
- Removes distractions from underlying app
- Matches the gravity of other intervention screens
- Creates a calm, focused decision environment

---

### 2. Primary Button Color: Bright → Calm Muted

**Before:**
- Color: `#8B7AE8` (primary - full saturation)
- Similar to main app action buttons
- Felt energetic and exciting

**After:**
- Color: `#6B5FC9` (primaryMuted - reduced saturation)
- Matches ActionConfirmationScreen's calm posture
- Feels **default and intentional, not exciting**
- Elevation: `elevation_1` (subtle, not prominent)

**Rationale:**
The conscious process is the default path, not a celebratory action. The muted purple:
- Reduces energetic/motivational cues
- Feels calm and steady
- Signals "this is the normal path" not "this is the exciting choice"
- Distinguishes intervention buttons from main app buttons

**Color Comparison:**
```
Main App Buttons:     #8B7AE8 (primary - energetic)
Intervention Buttons: #6B5FC9 (primaryMuted - calm)
```

---

### 3. Decorative Icons: Removed

**Before:**
- Conscious process: 🧭 (compass emoji)
- Quick Task: ⚡ (lightning emoji)

**After:**
- Both buttons: Text only, no icons
- Clean, minimal presentation

**Rationale:**
- Emojis add visual noise and implied meaning
- ⚡ suggested speed/efficiency (wrong message)
- 🧭 was decorative, not functional
- Text-only buttons are calmer and clearer

---

### 4. Content Alignment: Center-Aligned

**Before:**
- Left-aligned content in modal card

**After:**
- Center-aligned title, info, and footnote
- Balanced, symmetrical presentation
- Calm, focused visual flow

**Rationale:**
Center alignment creates a more meditative, pause-like feeling. It removes the sense of urgency or directionality that left-alignment can imply.

---

## Visual Hierarchy Maintained

Despite the posture and color changes, the hierarchy established in the previous update remains:

1. **Primary Action:** "Go through conscious process"
   - Top position
   - Muted purple background
   - Subtle elevation
   - High contrast text
   - Font weight: 600

2. **Secondary Action:** "Quick Task"
   - Bottom position
   - Neutral gray background
   - No elevation
   - Lower contrast text
   - Font weight: 500

---

## Design Consistency

### Matches Other Interruption Screens

| Screen | Background | Button Color | Posture |
|--------|-----------|--------------|---------|
| BreathingScreen | `#0A0A0B` | N/A (no buttons) | Full-screen, centered |
| RootCauseScreen | `#0A0A0B` | `#6B5FC9` (primary action) | Full-screen, centered |
| ActionConfirmationScreen | `#0F0F10` | `#6B5FC9` (primary action) | Full-screen, bottom-anchored |
| **QuickTaskDialogScreen** | `#0A0A0B` | `#6B5FC9` (primary action) | Full-screen, centered |

### Distinguishes from Main App Buttons

| Context | Button Color | Purpose |
|---------|-------------|---------|
| Main App (Insights, Community, Settings) | `#8B7AE8` (primary) | Energetic, engaging actions |
| Intervention Screens | `#6B5FC9` (primaryMuted) | Calm, intentional decisions |

---

## User Experience Impact

### Before (Modal Card)
- Felt like a quick popup interrupting the app
- Bright colors suggested efficiency/speed
- Modal presentation felt dismissible
- Disconnected from intervention flow

### After (Full-Screen Interruption)
- Feels like an intentional pause moment
- Calm colors suggest thoughtful decision
- Full-screen presentation signals importance
- Integrated with intervention flow
- User is invited to choose, not rushed

---

## Technical Implementation

### Structure
```tsx
<SafeAreaView style={styles.container}>
  {/* Close button (top-right) */}
  <View style={styles.header}>...</View>
  
  {/* Content (vertically centered) */}
  <View style={styles.contentContainer}>
    <View style={styles.titleSection}>...</View>
    <View style={styles.infoSection}>...</View>
    <View style={styles.actionsSection}>
      {/* Primary button (top) */}
      <Pressable style={styles.primaryButton}>...</Pressable>
      
      {/* Secondary button (bottom) */}
      <Pressable style={styles.secondaryButton}>...</Pressable>
    </View>
    <View style={styles.footnoteSection}>...</View>
  </View>
</SafeAreaView>
```

### Key Styles
```tsx
container: {
  flex: 1,
  backgroundColor: '#0A0A0B', // Full-screen interruption
}

contentContainer: {
  flex: 1,
  justifyContent: 'center', // Vertically centered
  paddingHorizontal: 24,
}

primaryButton: {
  backgroundColor: '#6B5FC9', // Calm muted purple
  elevation: 1, // Subtle presence
}

secondaryButton: {
  backgroundColor: '#27272A', // Neutral gray
  borderColor: '#3F3F46', // Minimal emphasis
}
```

---

## Constraints Respected

✅ **No new copy added**  
✅ **No warning or success colors introduced**  
✅ **No animations added**  
✅ **No logic, limits, or expiration changes**  
✅ **Existing copy preserved** (except button labels simplified)  

---

## Testing Checklist

- [ ] Screen appears as full-screen takeover (no app context visible)
- [ ] Background is dark (`#0A0A0B`), matches other interruption screens
- [ ] Primary button uses calm muted purple (`#6B5FC9`)
- [ ] Secondary button uses neutral gray (`#27272A`)
- [ ] No decorative icons on buttons
- [ ] Content is center-aligned
- [ ] Close button works (returns to launcher)
- [ ] Visual hierarchy clear: primary > secondary
- [ ] Screen feels like an intentional pause, not a quick popup
- [ ] Consistent with other intervention screens

---

## Related Documentation

- `design/QUICK_TASK_HIERARCHY_CHANGES.md` - Initial hierarchy changes
- `design/references/quick-task-hierarchy-comparison.md` - Visual comparison
- `design/principles/interaction-gravity.md` - Pause Moment gravity
- `design/ui/tokens.md` - Color and typography tokens
- `design/ui/tone-ambient-hearth.md` - Calm, soft design tone

---

**Status:** ✅ Complete  
**Next Steps:** Integrate into navigation flow and user test

