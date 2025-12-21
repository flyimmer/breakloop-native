# Quick Task Gate - Final Polish

**Date:** December 21, 2025  
**Phase:** C/D - Quick Task Gate UI Final Refinements  
**File:** `app/screens/QuickTaskDialogScreen.tsx`

---

## Summary

Small wording and color refinements applied to improve clarity and reinforce that the conscious process is the default path, while Quick Task is the exception.

---

## Changes Applied

### 1. Title Wording ✅

**Before:**
```
Quick, necessary use?
```

**After:**
```
Quick, necessary task?
```

**Rationale:**
- "Task" is more concrete and bounded than "use"
- Reinforces the exception nature of Quick Task
- Clearer cognitive framing: a task has a beginning and end

---

### 2. Primary Button Wording ✅

**Before:**
```
Go through conscious process
```

**After:**
```
Start conscious process
```

**Rationale:**
- Shorter and clearer (3 words vs 4 words)
- Less abstract cognitive load
- "Start" is more action-oriented and concrete
- Still neutral and non-promotional
- Maintains the calm, default tone

---

### 3. Primary Button Color (Minor Refinement) ✅

**Before:**
```css
backgroundColor: '#6B5FC9' /* primaryMuted */
```

**After:**
```css
backgroundColor: '#6558B8' /* Further reduced saturation (~7% darker) */
```

**Color Comparison:**
```
Main App Primary:     #8B7AE8 (bright, energetic)
Previous Muted:       #6B5FC9 (calm, steady)
New Further Muted:    #6558B8 (steady, default, not promotional)
```

**Rationale:**
- Slightly reduced saturation/brightness (~7%)
- Feels more default and steady, less promotional
- Still clearly visible and readable
- Maintains visual hierarchy (still stronger than secondary button)
- Reinforces "this is the normal path" without excitement

---

## Visual Impact

### Wording Changes

| Element | Before | After | Impact |
|---------|--------|-------|--------|
| Title | "Quick, necessary use?" | "Quick, necessary task?" | More concrete, bounded |
| Primary Button | "Go through conscious process" | "Start conscious process" | Shorter, clearer, more actionable |

### Color Refinement

| Color | Hex | HSL | Use Case |
|-------|-----|-----|----------|
| Main App Primary | `#8B7AE8` | `hsl(251, 70%, 70%)` | Energetic actions |
| Previous Muted | `#6B5FC9` | `hsl(251, 53%, 58%)` | Calm intervention |
| **New Further Muted** | `#6558B8` | `hsl(251, 48%, 53%)` | Default, steady path |

**Saturation Reduction:** 70% → 53% → **48%** (total 22% reduction from main app)  
**Lightness Reduction:** 70% → 58% → **53%** (total 17% reduction from main app)

---

## Constraints Respected

✅ **No layout or spacing changes**  
✅ **No button reordering**  
✅ **No icons or emojis added**  
✅ **No logic, limits, or expiration changes**  
✅ **No new copy added**  
✅ **Secondary button unchanged** ("Quick Task")  
✅ **Minimal changes only**  

---

## User Experience Impact

### Title: "use" → "task"
- **Before:** "Use" feels open-ended, could mean extended usage
- **After:** "Task" feels bounded, specific, and exceptional
- Reinforces that Quick Task is for discrete, urgent actions

### Button: "Go through" → "Start"
- **Before:** "Go through" implies a journey or process to traverse
- **After:** "Start" is simpler, more direct, less cognitive load
- Maintains neutral tone without being promotional

### Color: Slightly darker/less saturated
- **Before:** Calm but still somewhat vibrant
- **After:** More subdued, feels like a default option
- Less "exciting" or "promotional"
- Still clearly visible and accessible

---

## Design Consistency

### Color Hierarchy Maintained

```
Brightest:  #8B7AE8 (Main App - energetic, engaging)
            ↓
Mid-tone:   #6B5FC9 (Previous - calm, steady)
            ↓
Subdued:    #6558B8 (Current - default, not promotional) ← Quick Task Gate
            ↓
Neutral:    #27272A (Secondary button - exception path)
```

### Wording Patterns

| Screen | Primary Action | Tone |
|--------|---------------|------|
| RootCauseScreen | "See Alternatives" | Exploratory |
| AlternativesScreen | (Card selection) | Browsing |
| ActionConfirmationScreen | "Start this activity" | Decisive |
| **QuickTaskDialogScreen** | "Start conscious process" | Default, clear |

---

## Testing Checklist

- [ ] Title reads "Quick, necessary task?"
- [ ] Primary button reads "Start conscious process"
- [ ] Primary button color is `#6558B8` (slightly darker/less saturated)
- [ ] Secondary button unchanged ("Quick Task")
- [ ] Layout and spacing unchanged
- [ ] Visual hierarchy maintained (primary > secondary)
- [ ] Primary button feels default and steady, not promotional
- [ ] No new icons, emojis, or decorative elements

---

## Related Documentation

- `design/QUICK_TASK_HIERARCHY_CHANGES.md` - Initial hierarchy changes
- `design/QUICK_TASK_POSTURE_UPDATE.md` - Posture and color refinement
- `design/references/quick-task-hierarchy-comparison.md` - Visual comparison
- `design/ui/tokens.md` - Design tokens reference

---

**Status:** ✅ Complete  
**Next Steps:** User testing and integration into navigation flow

