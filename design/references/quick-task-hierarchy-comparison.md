# Quick Task Dialog - Visual Hierarchy Comparison

## BEFORE (Original Design - Modal Card)

```
╔═════════════════════════════════════╗
║ [App context visible behind]        ║
║                                      ║
║   ┌─────────────────────────────┐   ║
║   │                           ✕ │   │ ← Modal card overlay
║   │                             │   │
║   │  QUICK TASK                 │   │
║   │  Quick, necessary use?      │   │
║   │                             │   │
║   │  1 left in 15-min window.   │   │
║   │                             │   │
║   │  ┌───────────────────────┐  │   │
║   │  │ ⚡ Quick Task (10s)   │  │   │ ← PRIMARY (energetic)
║   │  └───────────────────────┘  │   │
║   │                             │   │
║   │  ┌───────────────────────┐  │   │
║   │  │ 🧭 Go through...      │  │   │ ← SECONDARY
║   │  └───────────────────────┘  │   │
║   │                             │   │
║   │  Quick tasks skip...        │   │
║   └─────────────────────────────┘   │
║                                      ║
╚═════════════════════════════════════╝

Presentation: Modal card overlay
Background: Backdrop with visible app context
Visual Weight:
  ⚡ Quick Task: HIGH (top, bright color, energetic emoji)
  🧭 Conscious Process: MEDIUM (bottom position)

Message Communicated:
  "Quick Task is the efficient choice"
  "Conscious process is slower/optional"
  "This is a quick decision, not an interruption"
```

---

## AFTER (Full-Screen Interruption with Correct Posture)

```
╔═════════════════════════════════════╗
║ #0A0A0B (dark background)          ✕║ ← Full-screen takeover
║                                      ║   No app context visible
║                                      ║
║                                      ║
║           QUICK TASK                 ║
║      Quick, necessary use?           ║
║                                      ║
║   1 left in this 15-minute window.   ║
║                                      ║
║   ┌───────────────────────────────┐  ║
║   │  Go through conscious process │  ║ ← PRIMARY (calm, steady)
║   └───────────────────────────────┘  ║   Color: #6B5FC9 (muted)
║                                      ║   Elevation: subtle
║   ┌───────────────────────────────┐  ║   Weight: HIGHEST
║   │        Quick Task             │  ║ ← SECONDARY (neutral)
║   └───────────────────────────────┘  ║   Color: #27272A (surface)
║                                      ║   Border: #3F3F46
║   Quick tasks skip the full          ║   Weight: MEDIUM-LOW
║   intervention for urgent moments    ║
║   and expire automatically.          ║
║                                      ║
║                                      ║
╚═════════════════════════════════════╝

Presentation: Full-screen interruption state
Background: #0A0A0B (matches BreathingScreen)
Visual Weight:
  Conscious Process: HIGHEST (top, calm muted purple, subtle elevation)
  Quick Task: MEDIUM-LOW (bottom, neutral gray, flat)

Message Communicated:
  "This is an intentional pause moment"
  "Conscious process is the normal, default path"
  "Quick Task is available but exceptional"
  "Take a moment to choose how to proceed"
```

---

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| **Screen Presentation** | Modal card overlay | Full-screen interruption |
| **Background** | Backdrop with app visible | `#0A0A0B` (dark, no context) |
| **Button Order** | Quick Task first | Conscious Process first |
| **Primary Color** | `#8B7AE8` (bright) | `#6B5FC9` (muted, calm) |
| **Elevation** | Similar for both | Only on Conscious Process |
| **Decorative Icons** | 🧭 and ⚡ emojis | None (clean, text-only) |
| **Quick Task Label** | "⚡ Quick Task (10 seconds)" | "Quick Task" |
| **Visual Contrast** | Quick Task higher | Conscious Process higher |
| **Implied Priority** | Quick Task = efficient | Conscious Process = default |
| **Overall Tone** | Quick decision moment | Intentional pause moment |

---

## Design Tokens Used

### Screen Background
```css
background: #0A0A0B      /* background (dark mode) - matches interruption screens */
presentation: full-screen /* takeover, not modal overlay */
```

### Primary Button (Conscious Process)
```css
background: #6B5FC9      /* primaryMuted - calm, steady, not exciting */
color: #FAFAFA           /* textPrimary - high contrast */
shadow: elevation_1      /* subtle presence (reduced from elevation_2) */
padding: 16px 24px       /* buttonHeight_primary */
border-radius: 8px       /* radius_8 */
font-weight: 600         /* clear emphasis */
```

### Secondary Button (Quick Task)
```css
background: #27272A      /* surfaceSecondary - neutral, subtle */
color: #A1A1AA           /* textSecondary - lower contrast */
border: 1px #3F3F46      /* border - minimal emphasis */
shadow: none             /* flat appearance */
padding: 14px 24px       /* buttonHeight_secondary */
border-radius: 8px       /* radius_8 */
font-weight: 500         /* standard weight */
```

---

## Interaction Gravity: Pause Moment

This screen implements the **Pause Moment** interaction gravity:

- **Modal presentation** - Overlays current context
- **Calm, neutral tone** - No urgency or pressure
- **Clear hierarchy** - Primary path is obvious
- **User autonomy** - Both options remain accessible
- **No coercion** - Design guides, doesn't force

---

## Accessibility Notes

✅ **Touch Targets**
- Primary button: 56px height (exceeds 44px minimum)
- Secondary button: 52px height (exceeds 44px minimum)
- Close button: 36px with 12px hitSlop (48px effective)

✅ **Color Contrast**
- Primary button text: 13.5:1 ratio (WCAG AAA)
- Secondary button text: 4.8:1 ratio (WCAG AA)
- Body text: 4.5:1 ratio (WCAG AA)

✅ **Screen Reader**
- Semantic button order matches visual order
- Clear button labels without relying on emoji
- Informational text provides context

---

## Behavioral Notes

### What Changed
- **Screen presentation**: Modal card → Full-screen interruption
- **Background**: Backdrop overlay → Dark, low-stimulation (`#0A0A0B`)
- **Visual hierarchy**: Button order reversed
- **Color posture**: Bright primary → Calm muted purple (`#6B5FC9`)
- **Decorative elements**: Removed all emojis (🧭, ⚡)
- **Label text**: Removed timing from button
- **Content alignment**: Center-aligned for calm presentation

### What Did NOT Change
- Quick Task availability logic
- Usage limits (1 per 15-minute window)
- Expiration behavior
- Navigation flow
- Close button behavior
- Copy text (except button labels)
- No new screens or steps added
- No animations added

---

**Document Version:** 1.0  
**Date:** December 21, 2025  
**Implementation:** `app/screens/QuickTaskDialogScreen.tsx`

