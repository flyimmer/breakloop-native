# Design Tokens

## Color

### Dark Mode (Primary)

```js
background: '#0A0A0B'        // Deep neutral black
surface: '#18181B'           // Elevated surface
surfaceSecondary: '#27272A'  // Secondary elevated surface
surfaceGlass: 'rgba(24, 24, 27, 0.7)' // Glass-like overlay for pause moments
primary: '#8B7AE8'           // Soft purple, calm but present
primaryMuted: '#6B5FC9'      // Muted primary for subtle states
textPrimary: '#FAFAFA'       // High contrast for readability
textSecondary: '#A1A1AA'     // Medium contrast for hierarchy
textMuted: '#71717A'         // Low contrast for de-emphasized content
border: '#3F3F46'            // Subtle separation
danger: '#E87A7A'            // Soft red, non-alarming
success: '#7AE89D'           // Calm green, non-gamified
warning: '#E8C77A'           // Soft amber for caution
overlay: 'rgba(0, 0, 0, 0.7)' // Modal backdrop
overlaySoft: 'rgba(0, 0, 0, 0.5)' // Lighter backdrop

// Semantic aliases
focus: '#8B7AE8'             // Maps to primary
divider: '#3F3F46'           // Maps to border
```

### Light Mode (Optional)

```js
background: '#FAFAFA'
surface: '#FFFFFF'
surfaceSecondary: '#F4F4F5'
surfaceGlass: 'rgba(255, 255, 255, 0.8)'
primary: '#7C6FD9'
primaryMuted: '#9B91E8'
textPrimary: '#18181B'
textSecondary: '#52525B'
textMuted: '#A1A1AA'
border: '#E4E4E7'
danger: '#DC6B6B'
success: '#6BDC8C'
warning: '#DCBD6B'
overlay: 'rgba(0, 0, 0, 0.4)'
overlaySoft: 'rgba(0, 0, 0, 0.2)'

// Semantic aliases
focus: '#7C6FD9'
divider: '#E4E4E7'
```

## Spacing

```js
space_2: 2
space_4: 4
space_6: 6
space_8: 8
space_12: 12
space_16: 16
space_20: 20
space_24: 24
space_32: 32
space_40: 40
space_48: 48
space_64: 64
```

## Typography

### Font Family

```js
fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
```

### Type Scale

```js
h1: {
  fontSize: 32,
  lineHeight: 40,
  fontWeight: '600',
  letterSpacing: -0.5
}

h2: {
  fontSize: 24,
  lineHeight: 32,
  fontWeight: '600',
  letterSpacing: -0.3
}

h3: {
  fontSize: 20,
  lineHeight: 28,
  fontWeight: '600',
  letterSpacing: -0.2
}

body: {
  fontSize: 16,
  lineHeight: 24,
  fontWeight: '400',
  letterSpacing: 0
}

bodySecondary: {
  fontSize: 14,
  lineHeight: 20,
  fontWeight: '400',
  letterSpacing: 0
}

caption: {
  fontSize: 12,
  lineHeight: 16,
  fontWeight: '500',
  letterSpacing: 0.3
}

button: {
  fontSize: 16,
  lineHeight: 24,
  fontWeight: '500',
  letterSpacing: 0.1
}
```

## Radius

```js
radius_4: 4      // Input fields, small elements
radius_8: 8      // Buttons, tags
radius_12: 12    // Cards, list items
radius_16: 16    // Prominent cards
radius_24: 24    // Modals, sheets
radius_full: 9999 // Pills, avatars
```

## Elevation / Shadow

### Dark Mode

```js
elevation_1: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 2,
  elevation: 1
}

elevation_2: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.4,
  shadowRadius: 4,
  elevation: 2
}

elevation_3: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: 8,
  elevation: 3
}
```

### Light Mode

```js
elevation_1: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1
}

elevation_2: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 2
}

elevation_3: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 3
}
```

## Motion

```js
duration_fast: 150        // Micro-interactions, hovers
duration_normal: 250      // Standard transitions
duration_slow: 400        // Page transitions, reveals
duration_slower: 600      // Emphasis, breathing exercises

easing_standard: 'ease-in-out'
easing_accelerate: 'ease-in'
easing_decelerate: 'ease-out'
```

## Opacity

```js
opacity_disabled: 0.4     // Disabled states
opacity_muted: 0.6        // De-emphasized elements
opacity_hover: 0.8        // Hover states
```

## Dimensions

```js
buttonHeight_secondary: 36   // Tertiary, ghost buttons
buttonHeight_primary: 44     // Standard primary actions
buttonHeight_prominent: 52   // Emphasized calls to action

inputHeight: 44
iconSize_sm: 16
iconSize_md: 20
iconSize_lg: 24
```

