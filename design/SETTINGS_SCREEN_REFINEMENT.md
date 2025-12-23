# Settings Screen Refinement
**Date:** December 23, 2025  
**Status:** Implemented

## Overview
Refined the Settings screen as a tab-root screen (not a modal) with focus on My Profile as the canonical identity surface and improved visual hierarchy.

---

## Structural Changes Implemented

### Removed Elements
- ❌ "BreakLoop" app header
- ❌ Close (X) button
- ✅ Settings remains as screen title (softened visual dominance)

### Visual Hierarchy
- **Screen Title:** "Settings" in `h3` style (20px, weight 600) with `textSecondary` color (#52525B) for reduced dominance
- **Section Headers:** Small caps (14px, weight 500, uppercase) with icons for clarity
- **Cards:** White surface with subtle elevation (elevation_1) on off-white background (#FAFAFB)

---

## My Profile Section

### Profile-State Driven (December 2025)

**Critical Design Principle:**
- My Profile UI is driven by **profile state**, NOT authentication state
- User can have a profile regardless of sign-in status
- No registration pressure in My Profile section

### State Rules

#### When Profile EXISTS (hasProfile = true)
**Condition:** User has displayName, aboutMe, interests, or primaryPhoto

**Shows:**
- Profile photo (80px diameter) or placeholder with User icon
- Display name (or "You" if name not set)
- "Edit profile" button (secondary text link)

**Does NOT show:**
- About Me text (hidden in view mode)
- Interests text (hidden in view mode)
- Long explanatory text

#### When Profile DOES NOT EXIST (hasProfile = false)
**Condition:** User has no profile data at all

**Visual Anchoring Strategy (Final UX Refinement):**
- **Larger profile placeholder**: 100px diameter (vs 80px when profile exists)
  - Creates strong visual anchor
  - Prevents "empty container" feeling
  - Uses generic User silhouette icon (40px)
  - Centered horizontally
- **Compact card**: Reduced padding (24px vertical, 20px horizontal)
  - Avoids tall vacant space
  - Feels purposeful, not blank
- **Clear identity meaning**: Card communicates "this space represents your identity"

**Shows:**
- Large neutral profile photo placeholder (User icon, 100px diameter)
- Display name: "Not set" (normal weight, primary text color)
- Single purpose line: "Your profile helps friends recognize you."
  - 14px, muted color (#A1A1AA)
  - One sentence only
  - No encouragement language
- "Set up profile" button (secondary style, low emphasis)
  - Border style, not filled
  - Muted text color (#52525B)
  - Not primary blue or purple accent

**Does NOT show:**
- ❌ About Me field
- ❌ Interests field
- ❌ Stats or counts
- ❌ "Complete your profile" language
- ❌ Benefits lists
- ❌ Registration prompts
- ❌ Multiple explanatory sentences

**Tone:**
- Calm, optional, no pressure
- Communicates: "This space represents your identity here" + "You don't need to fill it" + "If you do, it will be used consistently"

**Why Empty State Doesn't Feel Blank:**
1. **Visual anchor**: Large placeholder (100px) creates presence
2. **Clear purpose**: Single sentence explains what this is
3. **Compact layout**: Reduced padding prevents vacant feeling
4. **Identity meaning**: Card has clear role even when empty
5. **Optional action**: Low-emphasis button, not a CTA

### View-First Behavior
- Shows profile information in view mode by default
- Edit mode accessed via "Edit profile" or "Set up profile" button
- Profile fields displayed with clear labels and hierarchy in edit mode

### Identity Presentation
- **Identity Block**: Photo and name as single visual unit
  - Photo: 80px diameter
  - Spacing between photo and name: 12px
  - Both centered for clear vertical alignment
  - Creates "this is you" feeling, not "this is a form"
- **Card Padding**: Uniform 20px padding
- **Clean, minimal**: No additional text or sections in view mode (when profile exists)

### Simplified View Mode
- **Core identity only**: Photo + Name
- **About Me and Interests**: Hidden in view mode, accessible in edit mode
- **Rationale**: Reduces visual density in Settings, shows identity at a glance
- **Full details**: Available when user taps "Edit profile"
- **Data preserved**: All profile fields remain in data model and edit mode

---

## Account Section (Separate from Profile)

### Authentication State
- **Account section** is affected by authentication state
- **My Profile section** is NOT affected by authentication state
- Clear separation of concerns

### When Signed In
- Shows user info with avatar (48px circle with initial)
- Email address in muted color
- Log Out button with icon (secondary style)

### When Not Signed In
- Sign In button: Primary style (purple background)
- Register button: Secondary style (white with border)
- Stacked vertically with 12px gap
- Does not block other settings visually
- Feels like an option, not a gate
- No aggressive prompts or barriers

---

## Other Sections Implemented

### Account Section
- Shows logged-in user info with avatar (48px circle with initial)
- Email address in muted color
- Log Out button with icon (secondary style)
- When not logged in: Sign In / Register buttons

### Social Privacy Section
- Four toggle switches:
  - Share Current Activity
  - Share Upcoming Activities
  - Share Recent Mood
  - Share Alternatives List
- Description: "Controls what your friends can see."
- Uses design tokens for switch colors (primary/primaryMuted)

### Monitored Apps Section
- Displays apps as chips (rounded rectangles with `surfaceSecondary` background)
- "Edit" button to modify list
- Clean, scannable layout

### Preferences Section
- Shows Intervention Duration and App Switch Interval
- Values displayed in `primary` color for emphasis
- Simple two-column layout

### Quick Task (Emergency) Section
- "Free" badge in section header
- Duration and Uses per 15 minutes displayed
- Upgrade hint in muted color: "Upgrade to Premium to customize these."
- Upgrade to Premium button (primary style)

### Footer
- "Advanced / Development Tools" link (muted)
- Version number: "v17.6 (BreakLoop Privacy)" (muted, centered)

---

## Design Tokens Used

### Colors (Light Mode)
- `background`: #FAFAFB (soft off-white)
- `surface`: #FFFFFF (cards)
- `surfaceSecondary`: #F4F4F6 (chips, subtle backgrounds)
- `primary`: #7C6FD9 (buttons, links, values)
- `primaryMuted`: #9B91E8 (switch track)
- `textPrimary`: #18181B (headlines, names)
- `textSecondary`: #52525B (body text, labels)
- `textMuted`: #A1A1AA (helper text, metadata)
- `border`: #E4E4E7 (dividers, button borders)

### Typography
- **Screen Title:** h3 (20px, weight 600, -0.2 tracking)
- **Section Titles:** caption (12px, weight 500, 0.3 tracking, uppercase)
- **Profile Name:** h3 (20px, weight 600, -0.2 tracking)
- **Body Text:** body (16px, weight 400)
- **Secondary Text:** bodySecondary (14px, weight 400)
- **Field Labels:** caption (12px, weight 500, 0.3 tracking)

### Spacing
- Section margins: 24px
- Card padding: 16-20px
- Profile photo: 80px
- Account avatar: 48px
- Content horizontal padding: 16px

### Radius
- Cards: radius_12 (12px)
- Buttons: radius_8 (8px)
- Avatars: radius_full (9999)

### Elevation
- Cards: elevation_1 (subtle shadow)

---

## Visual Intent Achieved

✅ **Calm:** Soft colors, generous spacing, no aggressive prompts  
✅ **Native:** Uses system fonts, standard React Native components, platform-appropriate patterns  
✅ **Trustworthy:** Clear hierarchy, honest copy, no dark patterns  
✅ **Identity feels important:** Profile photo is prominent (80px), name is strong (h3), edit is accessible  
✅ **Not performative:** No scores, rankings, or achievement displays

---

## Implementation Notes

### State Management
- Currently uses local `useState` for demonstration
- Ready to connect to actual state management system
- All handlers (`handleEditProfile`, `handleLogOut`, etc.) are stubbed with console.logs

### Responsive Behavior
- Uses `SafeAreaView` for proper insets on iOS
- `ScrollView` with `contentContainerStyle` for proper padding
- All sections stack vertically with consistent spacing

### Accessibility
- All interactive elements are properly sized (44px minimum touch target)
- Color contrast meets WCAG standards
- Icons paired with text labels for clarity

### Future Enhancements
- Connect to actual state management
- Implement edit profile flow
- Add navigation to edit apps screen
- Connect premium upgrade flow
- Add demo mode toggle
- Add intervention duration sliders

---

## Edit Mode Implementation

### Entry & Exit
- **Enter:** Tap "Edit profile" button in view mode
- **Exit:** Save or Cancel buttons only (no X button, no header close)
- Edit mode replaces view mode inline (no modal, no navigation)

### Structure
- **No "BreakLoop" header** - Removed
- **No close (X) button** - Removed
- **"My Profile" section label** - Kept as subtle uppercase label with icon
- **Form fields** - Primary focus, no large page title

### Profile Photo Section
- Circular placeholder with Camera icon (80px diameter)
- "Add Photo" button in iOS blue (#007AFF) - secondary, not a CTA
- Helper text: "Visible to friends once you connect." (12px, muted)

### Form Fields
All fields are optional with calm placeholders:

1. **Display Name**
   - Single-line text input
   - Placeholder: "Your name (optional)"
   - Height: 44px

2. **About Me**
   - Multi-line text area (3 lines, 88px height)
   - Placeholder: "Tell others a bit about yourself (optional)"
   - Helper text: Examples provided in muted color
   - No character limits or validation warnings

3. **Preferences / Interests**
   - Multi-line text area (3 lines, 88px height)
   - Placeholder: "Your interests or preferences (optional)"
   - No pressure to fill

### Action Buttons
- **Save**: iOS blue (#007AFF), full width, 44px height
- **Cancel**: White with border, full width, 44px height
- Stacked vertically with 12px gap
- No validation required to save

### Visual Characteristics
- **No purple accents** - Uses iOS blue (#007AFF) for primary action
- **No urgency** - All fields optional, calm placeholders
- **No modal feeling** - Inline edit, no overlay, no dramatic transitions
- **Calm hierarchy** - Form fields are focus, not aggressive CTAs

### State Management
- `isEditingProfile: boolean` - Controls view/edit mode
- `profileDraft: object` - Temporary state during editing
- Save: Commits draft to userProfile
- Cancel: Discards draft, returns to view mode

---

## Files Modified

- `app/screens/mainAPP/SettingsScreen.tsx` - Complete implementation with edit mode

---

## Design Principles Followed

From `design/principles/social-feature-guardrails.md`:
- Profile is about "Who is this person?" not "How good is this person?"
- No scores, rankings, success rates, or streaks
- Profile supports human context and trust

From `design/ui/tone-ambient-hearth.md`:
- Calm, restrained visual language
- Non-coercive interactions
- Trustworthy and honest

From `design/ux/states.md`:
- View-first profile behavior
- Empty state with helpful, non-judgmental hints
- Clear state transitions

