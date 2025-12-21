# BreakLoop Mobile Screens

This document lists all concrete mobile screens required for the BreakLoop app, derived from `design/ux/states.md` and `design/ux/flows.md`.

**Note:** Authentication and user management screens are excluded as requested.

---

## 1. Root Context Screens

### 1.1 Launcher Screen
- **State:** `activeContext: "launcher"`
- **Description:** Home screen with app grid and dock icons
- **Sub-states:**
  - Normal view
  - With notification banner
  - With quick task badge/countdown
  - With active session widget
  - With intervention overlay
  - With proactive prompt banner

### 1.2 Dummy App Screen
- **State:** `activeContext: "app-{id}"`
- **Description:** Simulated app screens (Instagram, TikTok, etc.)
- **Variants:**
  - Normal app content
  - With countdown timer badge (for active sessions)

---

## 2. Onboarding Screens

### 2.1 Select Values Screen
- **State:** `onboardingStep: 0`
- **Description:** Grid of value cards for multi-select
- **Elements:**
  - Value cards: Career, Health, Love, Kids, Reading, Nature, Social
  - Next button (disabled if nothing selected)

### 2.2 Select Monitored Apps Screen
- **State:** `onboardingStep: 1`
- **Description:** App selection with toggle switches
- **Elements:**
  - App list with toggles
  - Add custom website option
  - Finish button

---

## 3. Intervention Flow Screens

### 3.1 Breathing Screen
- **State:** `interventionState: "breathing"`
- **Description:** Countdown breathing exercise
- **Elements:**
  - Large countdown number with pulsing animation
  - Close (X) button

### 3.2 Root Cause Selection Screen
- **State:** `interventionState: "root-cause"`
- **Description:** Emotional trigger selection
- **Elements:**
  - Grid of cause cards (Boredom, Anxiety, Fatigue, Loneliness, Self-doubt, No goal)
  - "See Alternatives" button (disabled if none selected)
  - "I really need to use it" button
  - Close (X) button

### 3.3 Alternatives Screen
- **State:** `interventionState: "alternatives"`
- **Description:** Browse alternative activities with tabs
- **Tabs:**
  - My List tab - Saved alternatives
  - Discover tab - Community alternatives
  - AI For You tab - AI-generated suggestions with loading state
- **Elements:**
  - Tab navigation
  - Scrollable activity cards (3 per page)
  - Pagination controls
  - "Add Alternative" button (custom form)
  - API key warning (if missing)
  - Close (X) button

### 3.4 Action Confirmation Screen
- **State:** `interventionState: "action"`
- **Description:** Selected alternative details
- **Elements:**
  - Large checkmark icon
  - Activity title
  - Action steps list
  - "Start Activity" button
  - "Plan for later" button
  - Back/Close button

### 3.5 Action Timer Screen
- **State:** `interventionState: "action_timer"`
- **Description:** Running timer for activity
- **Elements:**
  - Large circular countdown timer
  - Activity steps below timer
  - "Finish Early" / "Complete & Reflect" button (context-dependent)

### 3.6 Timer Selection Screen
- **State:** `interventionState: "timer"`
- **Description:** Set intention timer to unlock app
- **Elements:**
  - Clock icon
  - Time option grid (5m, 15m, 30m, 45m, 60m)
  - 1m small button below

### 3.7 Reflection Screen
- **State:** `interventionState: "reflection"`
- **Description:** Mood check-in after activity
- **Elements:**
  - Welcome message
  - Three emoji buttons (😊 positive / 😐 neutral / 😫 negative)
  - Skip option

---

## 4. Quick Task Screens

### 4.1 Quick Task Dialog
- **State:** `showQuickTaskDialog: true`
- **Description:** Decision dialog for quick app access
- **Elements:**
  - "Quick Task" button (shows remaining uses)
  - "Go through conscious process" button
  - Close (X) button
  - Remaining uses count display

---

## 5. BreakLoop Main App Screens

### 5.1 Insights Tab Screen
- **State:** `activeContext: "app-mindful"` + `activeTab: "insights"`
- **Description:** Statistics and charts
- **Elements:**
  - Period selector buttons (Today, Week, Month)
  - Statistics displays
  - Charts/graphs
  - Success rate metrics
  - Session history

### 5.2 Community Tab Screen
- **State:** `activeContext: "app-mindful"` + `activeTab: "community"`
- **Description:** Social features container
- **Sub-menu options:**
  - Friends
  - My Upcoming
  - Discover
  - Plan

---

## 6. Community Sub-screens

### 6.1 Friends List Screen
- **State:** `communityMenu: "friends"`
- **Description:** Friends list with leaderboard
- **Elements:**
  - Scrollable friends list
  - Success rate displays
  - Add friend button
  - Message button per friend
  - Friend notes display

### 6.2 My Upcoming Screen
- **State:** `communityMenu: "my-upcoming"`
- **Description:** User's confirmed and pending activities
- **Elements:**
  - Horizontal scrollable activity cards
  - Status badges (PENDING/CONFIRMED)
  - Empty state if no activities

### 6.3 Discover Screen
- **State:** `communityMenu: "discover"`
- **Description:** Friends' activities and public events
- **Elements:**
  - Friends' current activities section (horizontal scroll)
  - Public events section (horizontal scroll)
  - Activity cards with host info

### 6.4 Plan Screen
- **State:** `communityMenu: "plan"`
- **Description:** Plan activity entry point
- **Elements:**
  - "Plan activity" button
  - Existing planned activities (if any)

---

## 7. Settings Screens

### 7.1 Main Settings Screen
- **State:** `activeContext: "app-mindful"` + `activeTab: "settings"`
- **Description:** App configuration
- **Elements:**
  - Account settings section
  - Values configuration
  - Monitored apps section with "Edit apps" button
  - Intervention duration settings
  - Quick Task settings (duration, uses per window)
  - Premium feature toggles
  - Social privacy settings section

### 7.2 Edit Apps Screen
- **State:** `isEditingApps: true`
- **Description:** Modify monitored apps list
- **Elements:**
  - Full-screen app selection interface
  - Toggle switches per app
  - Add custom website option
  - Finish button

---

## 8. Modal Screens

### 8.1 Plan Activity Modal
- **State:** `showPlanModal: true`
- **Description:** Create or edit activity
- **UI Structure:**
  - Fixed header with title and close button (X) - always visible
  - Scrollable content area (max-height: 90vh)
  - Close button always accessible at top-right
- **Modes:**
  - **Mode Selection:** Solo / Group buttons (hidden in edit mode)
  - **Solo - AI Suggestion Mode:**
    - Sub-mode toggle: "AI suggestion" / "Manual edit" buttons
    - Form: topic, location, time preference, date, participants description
    - "Generate suggestions" button
    - Loading state
    - 3 suggestion cards with Accept/Edit/Save buttons each
    - "Back to form" button (clears suggestions, returns to input form)
  - **Solo - Manual Mode:**
    - Sub-mode toggle: "AI suggestion" / "Manual edit" buttons (hidden in edit mode)
    - "← Back to suggestions" button (shown when navigated from AI suggestions)
    - Form: title, description, date, start time, end time, steps, location
    - "Save to My upcoming" button
  - **Group Mode:**
    - Form: title, description, date, start time, end time, location
    - Visibility selector (private/friends/public)
    - Max participants field
    - Allow auto-join toggle
    - "Create & Publish" button
- **Edit Mode:**
  - No mode selection buttons (determined automatically)
  - No AI suggestion/manual toggle (always manual)
  - No "← Back to suggestions" button
  - Pre-filled form with existing activity data
  - Button text: "Update activity" instead of "Save" or "Create"
- **Edit Mode:**
  - Pre-filled form based on existing activity
  - Update/Save button

### 8.2 Alt Scheduler Modal
- **State:** `showAltScheduler: true`
- **Description:** Schedule alternative for future
- **Elements:**
  - Pre-filled title, description, steps from alternative
  - Date picker
  - Time picker
  - Location field (optional)
  - Save button
  - Close button

### 8.3 Activity Details Modal
- **State:** `selectedActivity !== null`
- **Description:** Full-screen activity details
- **Elements:**
  - Activity title, description, time, location
  - Host information
  - Status badges (PENDING/CONFIRMED/Host)
  - Participant list (if visible)
  - **Action Buttons (context-dependent):**
    - Host view: "Edit activity" + "Cancel event"
    - Participant with pending: "Cancel request"
    - Participant with confirmed: "Quit event"
    - Non-participant: "Join the event"
  - **Join Requests Section (host only):**
    - List of pending requests
    - Accept/Decline buttons per request
  - Close button

### 8.4 Friend Detail Modal
- **State:** `viewingFriend !== null`
- **Description:** Friend profile with stats
- **Elements:**
  - Friend info (avatar, name)
  - Success rate statistics
  - Notes field (editable)
  - Favorite toggle
  - Privacy settings controls
  - Close button

### 8.5 Add Friend Modal
- **State:** `isAddingFriend: true`
- **Description:** Add new friend interface
- **Tabs:**
  - Phone tab - Browse phone contacts
  - Username tab - Search by username
- **Elements:**
  - Tab navigation
  - Contact/user list
  - Add button per contact
  - Search field (username tab)
  - Close button

### 8.6 Chat Interface Modal
- **State:** `messagingBuddy !== null`
- **Description:** In-app messaging with friend
- **Elements:**
  - Message history (scrollable)
  - Message input field
  - Send button
  - Friend avatar/name header
  - Close button

---

## 9. Overlay Screens

### 9.1 Proactive Prompt Overlay
- **State:** `proactiveState !== null`
- **Description:** Contextual notification banner
- **Types:**
  - Social planning prompt (weekend)
  - Sleep hygiene prompt (late night)
  - Late night activity filtering notice
- **Elements:**
  - Message text
  - Dismiss button
  - Tap action (opens relevant BreakLoop section)

### 9.2 Active Session Override Screen
- **State:** `userSessionState.joined === true`
- **Description:** Live focus session interface
- **Elements:**
  - Dark background
  - Session info (duration, goal)
  - Participant list with status indicators (focused/distracted)
  - User status indicator
  - Quick task badge (if active)
  - "Leave session" button
  - Leave countdown (5s) with cancel option

---

## 10. Supplementary Screens

### 10.1 Custom Alternative Form
- **State:** `isAddingAlt: true` (within alternatives screen)
- **Description:** Create custom alternative
- **Elements:**
  - Title field
  - Description field
  - Duration field
  - Action steps field
  - Type selector
  - Save button
  - Cancel button

### 10.2 AI Generation Loading State
- **State:** `isGeneratingAI: true`
- **Description:** Loading indicator during AI generation
- **Elements:**
  - Loading spinner
  - "Generating suggestions..." message

### 10.3 Error/Empty States
- **Description:** Various error and empty state screens
- **Types:**
  - No API key warning (AI features)
  - AI generation error with fallback
  - Empty activity lists
  - No friends yet state
  - Network error states

---

## Screen Count Summary

**Total Screens:** 38 distinct screens/modals

**Breakdown by Category:**
- Root Context: 2 screens
- Onboarding: 2 screens
- Intervention Flow: 7 screens
- Quick Task: 1 screen
- Main App Tabs: 2 screens
- Community Sub-screens: 4 screens
- Settings: 2 screens
- Modals: 6 screens
- Overlays: 2 screens
- Supplementary: 10 states/variations

---

## Navigation Hierarchy

```
Launcher (Root)
├── BreakLoop App
│   ├── Insights Tab
│   ├── Community Tab
│   │   ├── Friends List
│   │   ├── My Upcoming
│   │   ├── Discover
│   │   └── Plan
│   └── Settings Tab
│       └── Edit Apps (full-screen)
├── Dummy Apps (monitored/non-monitored)
├── Intervention Flow Overlay
│   ├── Breathing
│   ├── Root Cause
│   ├── Alternatives (3 tabs)
│   ├── Action
│   ├── Action Timer
│   ├── Timer Selection
│   └── Reflection
└── Quick Task Dialog

Modals (can appear over various screens):
├── Plan Activity Modal
├── Alt Scheduler Modal
├── Activity Details Modal
├── Friend Detail Modal
├── Add Friend Modal
└── Chat Interface Modal

Overlays (can appear over launcher):
├── Proactive Prompt
└── Active Session Override
```

---

## Mobile-Specific UI Patterns

### Gestures
- **Swipe down:** Close modals (iOS)
- **Back button:** Close modals, cancel interventions, navigate back (Android)
- **Pull to refresh:** Update activity/friend lists
- **Horizontal swipe:** Navigate between activity cards

### System Integration
- **Status bar:** Quick task countdown badge
- **Notifications:** Proactive prompts, session status, activity reminders
- **Lock screen:** Session timer display

### Responsive Elements
- **Bottom sheets:** Quick actions, context menus
- **Tab bars:** Main navigation (Insights, Community, Settings)
- **Scrollable lists:** Activity cards, friends list, participant lists
- **Pickers:** Native date/time pickers for scheduling

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Source Documents:** `design/ux/states.md`, `design/ux/flows.md`

