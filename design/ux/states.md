# BreakLoop UI States & Transitions

## Overview

This document defines all user-facing UI states, transitions, triggers, and edge cases for BreakLoop. This structure serves as the foundation for mobile app implementation, ensuring consistent behavioral logic across platforms.

---

## Root Contexts

Root contexts define the primary screen/view the user sees. Only one root context is active at a time.

### Context: Launcher

**State ID:** `activeContext: "launcher"`

**Description:** Home screen with app grid and dock icons

**Initial State:** Default on app start

**Sub-states:**
- Normal: Base launcher view
- With notification: `simNotification !== null` - Shows notification banner
- Quick task active: `quickTaskActiveUntil > Date.now()` - Shows quick task badge with countdown
- Active session: `userSessionState.joined && !userSessionState.isFinished` - Shows session widget
- Intervention overlay: `interventionState !== "idle"` - Shows intervention flow overlay
- Proactive overlay: `proactiveState !== null` - Shows proactive prompt
- Quick task dialog: `showQuickTaskDialog === true` - Shows quick task decision dialog

**Transitions:**
- → `activeContext: "app-mindful"` - Tap BreakLoop icon
- → `activeContext: "app-{id}"` - Tap any app icon
- → Intervention states - When monitored app launched

**Triggers:**
- App initialization (default)
- `handleHomeButton()` - User taps home/back

---

### Context: BreakLoop App

**State ID:** `activeContext: "app-mindful"`

**Description:** Main BreakLoop application interface

**Sub-states:** See [BreakLoop Config States](#breakloop-config-states)

**Transitions:**
- → `activeContext: "launcher"` - Tap home/back button
- → Intervention states - Can be triggered from within BreakLoop

**Triggers:**
- Tap BreakLoop icon in launcher
- Return from intervention flow

---

### Context: Dummy App

**State ID:** `activeContext: "app-{id}"`

**Description:** Simulated app screen (Instagram, TikTok, etc.)

**Sub-states:**
- Normal: App content display
- With timer: `activeSessions[app.name]` exists - Shows countdown badge

**Transitions:**
- → `activeContext: "launcher"` - Tap home button
- → Intervention states - When session expires or monitored app opened

**Triggers:**
- Tap app icon in launcher
- Quick task activates
- Timer unlocks app

**Edge Cases:**
- Countdown timer visible if session active
- Monitored apps: Clearing session on home button removes unlock token
- Non-monitored apps: No intervention trigger

---

## User Account States

User account states determine authentication and registration status. These states gate certain social features.

### State: Anonymous (Local-Only)

**State ID:** `userAccount.loggedIn: false`

**Description:** User has not registered/created an account

**Characteristics:**
- All data stored locally only
- Can use full intervention system
- Can use community features (planning, viewing activities)
- **Cannot** send friend requests
- **Cannot** generate invite links
- **Cannot** accept invite links

**Gating Triggers:**
- Attempting to add friend from participants → Shows registration modal
- Attempting to generate invite link → Shows registration modal
- Attempting to accept invite link → Shows registration modal

**Transitions:**
- → `userAccount.loggedIn: true` - Complete registration

### State: Registered (Identified)

**State ID:** `userAccount.loggedIn: true`

**Description:** User has created an account with name and email

**Characteristics:**
- All local data remains accessible
- Can send and receive friend requests
- Can generate and accept invite links
- Profile synced (in future implementation)

**State Variables:**
- `userAccount.name: string` - User's display name
- `userAccount.email: string` - User's email
- `userAccount.streak: number` - Current streak count
- `userAccount.isPremium: boolean` - Premium subscription status

**Transitions:**
- → `userAccount.loggedIn: false` - Log out (Settings → Account → Log out)

---

## Profile States

Profile states determine how user profile information is displayed and edited.

### State: My Profile (View Mode)

**State ID:** `isEditingProfile: false`

**Description:** User viewing their own profile

**Location:** Settings → My Profile section

**Display:**
- Profile photo (or placeholder)
- Display name (or empty state hint)
- About Me (or empty state hint)
- Interests (or empty state hint)
- "Edit profile" button

**Empty State:**
- Shows hint: "Your profile is empty. Tap 'Edit profile' to add information."

**Transitions:**
- → `isEditingProfile: true` - Tap "Edit profile" button

### State: My Profile (Edit Mode)

**State ID:** `isEditingProfile: true`

**Description:** User editing their own profile

**State Variables:**
- `profileDraft: object` - Temporary profile data during editing

**Editable Fields:**
- Primary photo (upload/remove)
- Display name (text input)
- About Me (textarea)
- Interests (textarea)

**Actions:**
- Save changes → Updates `userProfile` → Returns to view mode
- Cancel → Discards `profileDraft` → Returns to view mode

**Transitions:**
- → `isEditingProfile: false` - Save or Cancel

### State: Friend Profile (Summary View)

**State ID:** `viewingFriend !== null` + `viewingFriendFullProfile: false`

**Description:** Viewing friend's profile summary

**Location:** Community → Friends → Tap friend card

**Display:**
- Profile photo (or avatar with initial)
- Display name (or fallback to name)
- "Tap to view full profile" hint
- "Chat with [Name]" button (primary action)
- "Things [Name] is up to" section (if friend has activities)

**Transitions:**
- → `viewingFriendFullProfile: true` - Tap profile card
- → `messagingBuddy: friendObject` - Tap "Chat" button
- → `viewingFriend: null` - Back button or close

### State: Friend Profile (Full View)

**State ID:** `viewingFriend !== null` + `viewingFriendFullProfile: true`

**Description:** Viewing friend's complete profile (read-only)

**Display:**
- Profile photo (or avatar with initial)
- Display name (or fallback to name)
- About Me (only if friend has shared)
- Interests (only if friend has shared)
- Menu button (⋮) with actions:
  - Star/Unstar friend
  - Remove friend

**Privacy:**
- Only shows fields that friend has populated
- Respects friend's privacy settings (future)

**Transitions:**
- → `viewingFriendFullProfile: false` - Back button
- → `viewingFriend: null` - Close or navigate away

---

## Social Connection States

Social states define relationships between users.

### State: Friend (Confirmed)

**State ID:** Friend exists in `friendsList` with `status: "confirmed"` or no status field

**Description:** Confirmed friend connection

**Characteristics:**
- Appears in Friends list
- Can send/receive private messages
- Can see friend's shared activities (based on privacy settings)
- Can see friend's mood (if friend shares mood)
- Can add notes about friend (local only)
- Can mark as favorite

**Available Actions:**
- View profile (summary or full)
- Send message
- Star/unstar
- Remove friend

### State: Friend Request Sent (Pending)

**State ID:** Friend exists in `friendsList` with `status: "pending"` + request was sent by current user

**Description:** Outgoing friend request awaiting response

**Display:**
- Shows "Pending" badge next to name in Friends list
- Cannot message until confirmed
- Cannot see shared activities until confirmed

**Transitions:**
- → Confirmed friend - Other user accepts request
- → Removed - Other user declines or current user cancels request

### State: Friend Request Received (Pending)

**State ID:** Incoming request exists in `friendRequestsReceived` array

**Description:** Incoming friend request awaiting current user's response

**Display:**
- Shows in Friends list or dedicated requests section (implementation-specific)
- Shows "Accept" and "Decline" buttons

**Transitions:**
- → Confirmed friend - Current user accepts
- → Removed - Current user declines

### State: Not Connected

**State ID:** User not in `friendsList` and no pending requests

**Description:** No connection between users

**Characteristics:**
- May appear in activity participants lists
- Can send friend request from participants list
- Cannot message
- Cannot see private activities

**Transitions:**
- → Friend Request Sent - Send friend request

---

## Intervention Flow States

Intervention overlay renders on top of launcher when `interventionState !== "idle"`. States form a linear flow with branching options.

### State: Breathing

**State ID:** `interventionState: "breathing"`

**Description:** Countdown breathing exercise before intervention

**Visual:** Large countdown number with pulsing animation

**Initial Values:**
- `breathingCount: settings.interventionDuration` (default: 5 seconds)

**Auto-transition:**
- → `interventionState: "root-cause"` when `breathingCount === 0`

**Manual Transition:**
- → `activeContext: "launcher"` + `interventionState: "idle"` - Close (X button)

**Triggers:**
- `beginInterventionForApp(app)` - Monitored app launch without quick task

**Edge Cases:**
- Timer counts down every second
- Can be cancelled at any time

---

### State: Root Cause

**State ID:** `interventionState: "root-cause"`

**Description:** User selects emotional triggers for app usage

**Visual:** Grid of cause cards (multi-select)

**Available Causes:**
- Boredom, Anxiety, Fatigue, Loneliness, Self-doubt, No goal

**State Variables:**
- `selectedCauses: []` - Array of selected cause IDs

**Validation:**
- "See Alternatives" button disabled if `selectedCauses.length === 0`

**Transitions:**
- → `interventionState: "alternatives"` - "See Alternatives" button (requires causes selected)
- → `interventionState: "timer"` - "I really need to use it" button (bypass)
- → `activeContext: "launcher"` - Close (X button)

**Triggers:**
- Auto from breathing countdown completion

---

### State: Alternatives

**State ID:** `interventionState: "alternatives"`

**Description:** Browse alternative activities with filtering

**Visual:** Three tabs with scrollable activity lists

**Tabs:**
1. **My List** (`altTab: "mylist"`)
   - Saved/custom alternatives
   - Filtered by selected causes
   - Includes user's custom alternatives

2. **Discover** (`altTab: "discover"`)
   - Community alternatives
   - Filtered by selected causes
   - Excludes already saved items

3. **AI For You** (`altTab: "ai"`)
   - AI-generated suggestions
   - Auto-generates on first tab open (if causes selected)
   - Shows loading state during generation
   - Warns if API key missing

**State Variables:**
- `altTab: "mylist" | "discover" | "ai"` - Active tab
- `altPage: 0` - Pagination (3 items per page)
- `isAddingAlt: boolean` - Custom alternative form visible
- `isGeneratingAI: boolean` - AI generation in progress
- `aiSuggestions: []` - Generated AI alternatives

**Pagination:**
- 3 items per page
- Resets to page 0 on tab switch

**Sub-states:**
- Create custom: `isAddingAlt === true` - Form for new alternative
- AI loading: `isGeneratingAI === true` - Loading indicator
- No API key: `GEMINI_API_KEY` missing - Warning message

**Transitions:**
- → `interventionState: "action"` - Select alternative from list
- Tab switch - Changes `altTab`, resets `altPage`
- → `interventionState: "alternatives"` (same state) - Show create form

**Triggers:**
- Tab click changes active tab
- AI tab auto-generates suggestions on first open
- "Add Alternative" button opens form

**Edge Cases:**
- AI generation tracks last generated causes to prevent re-generation
- Context-aware filtering (weather, time of day, night mode blocks certain activities)
- AI tab prevents re-generation when returning from activity view

---

### State: Action

**State ID:** `interventionState: "action"`

**Description:** Confirmation screen showing selected alternative details

**Visual:** Large checkmark, activity title, action steps list

**State Variables:**
- `selectedAlternative: object` - The chosen alternative activity

**Actions:**
- Start Activity button
- Plan for later button
- Close/Back button

**Transitions:**
- → `interventionState: "action_timer"` - "Start Activity" button
- → Opens `AltSchedulerModal` - "Plan for later" button
- → `interventionState: "alternatives"` - Close (X button)

**Triggers:**
- User selects alternative from alternatives screen

**Edge Cases:**
- `selectedAlternative` must exist (validation)
- Back button clears `selectedAlternative`

---

### State: Action Timer

**State ID:** `interventionState: "action_timer"`

**Description:** Running timer for active alternative activity

**Visual:** Large circular countdown timer with activity steps below

**State Variables:**
- `actionTimer: number` - Remaining seconds (counts down)

**Timer Behavior:**
- Counts down every second
- Can reach 0 and remain at 00:00
- Shows formatted time (MM:SS)

**Actions:**
- Complete & Reflect button (when timer > 0: "Finish Early")
- Complete & Reflect button (when timer === 0: "Complete & Reflect")

**Transitions:**
- → `interventionState: "reflection"` - Complete/Finish button

**Triggers:**
- "Start Activity" from action screen

**Edge Cases:**
- Timer continues running even after reaching 0
- Activity steps displayed below timer

---

### State: Timer

**State ID:** `interventionState: "timer"`

**Description:** Set intention timer to unlock app for limited time

**Visual:** Clock icon, grid of time options

**Time Options:**
- 5m, 15m, 30m, 45m, 60m (large buttons)
- 1m (small button below)

**Actions:**
- Select time duration
- Each option unlocks app for selected duration

**Transitions:**
- → Sets `activeSessions[app.name]` with expiry
- → `interventionState: "idle"`
- → `activeContext: "app-{id}"` - App unlocked

**Triggers:**
- "I really need to use it" from root-cause screen

**Edge Cases:**
- Session expiry automatically calculated from selected minutes

---

### State: Reflection

**State ID:** `interventionState: "reflection"`

**Description:** Mood check-in after completing alternative

**Visual:** Welcome message, three emoji buttons, skip option

**Mood Options:**
- 😊 (positive) - `finishReflection(1)`
- 😐 (neutral) - `finishReflection(0)`
- 😫 (negative) - `finishReflection(-1)`
- Skip - `finishReflection(0)`

**Transitions:**
- → `interventionState: "idle"`
- → Saves to `sessionHistory`
- → `activeContext: "launcher"` - Returns to home

**Triggers:**
- "Complete & Reflect" from action_timer screen

**Edge Cases:**
- Skip option defaults to neutral mood
- Session saved with mood rating and alternative details

---

## Quick Task System

Quick Task allows brief monitored app usage without full intervention flow.

### State: Quick Task Dialog

**State ID:** `showQuickTaskDialog: true`

**Description:** Decision dialog for quick app access

**Prerequisites:**
- App in `monitoredApps` list
- `quickTaskUsesInWindow < quickTaskUsesPerWindow`
- Within 15-minute rolling window

**Visual:** Modal dialog with two buttons

**Actions:**
- Quick Task button - Activates quick task
- Go through conscious process button - Starts full intervention
- Close (X) - Cancels, doesn't launch app

**Transitions:**
- → Quick Task Active - "Quick Task" button clicked
- → `interventionState: "breathing"` - "Go through conscious process" button
- → `showQuickTaskDialog: false` - Close button

**Triggers:**
- Monitored app launch with available quick task uses

**Edge Cases:**
- Button disabled if `remainingUses <= 0`
- Shows remaining uses count

---

### State: Quick Task Active

**State ID:** `quickTaskActiveUntil > Date.now()`

**Description:** App unlocked for limited duration

**Visual:** Badge on launcher/app showing countdown

**State Variables:**
- `quickTaskActiveUntil: timestamp` - Expiration time
- `activeQuickTaskApp: object` - The app being used

**Duration:**
- Free: Locked to 3 minutes
- Premium: Customizable (2/3/5 minutes, or 10 seconds for testing)

**Uses Limit:**
- Free: 1 use per 15-minute window
- Premium: 1-2 uses per 15-minute window

**Window Management:**
- 15-minute rolling window
- Resets when window expires
- Light heartbeat refresh every 30s when uses exist

**Auto-transition:**
- → `beginInterventionForApp(app)` when expires (if still in app context)

**Edge Cases:**
- Expiration triggers intervention even if user left app
- Free plan enforcement: Auto-resets to defaults on change
- Window resets automatically after 15 minutes

---

## BreakLoop Config States

Nested within `activeContext: "app-mindful"`. Multiple sub-states can be active simultaneously.

### State: Onboarding

**State ID:** `!hasOnboarded`

**Description:** First-time user setup flow

#### Step 0: Select Values

**State ID:** `onboardingStep: 0`

**Description:** Choose personal values/goals

**Visual:** Grid of value cards (multi-select)

**State Variables:**
- `selectedValues: []` - Array of selected value IDs
- `availableValueCards: []` - All available value options

**Validation:**
- "Next" button disabled if `selectedValues.length === 0`

**Transitions:**
- → `onboardingStep: 1` - "Next" button

#### Step 1: Select Monitored Apps

**State ID:** `onboardingStep: 1`

**Description:** Choose apps to monitor

**Visual:** App selection screen with toggle switches

**State Variables:**
- `monitoredApps: []` - Array of app IDs to monitor
- `customApps: []` - Available apps including custom websites

**Actions:**
- Toggle app in/out of monitored list
- Add custom website

**Transitions:**
- → `hasOnboarded: true` - "Finish" button (enters main app)

---

### State: Main Tabs

**State ID:** `activeTab`

**Description:** Primary navigation within BreakLoop app

**Tabs:**
1. **Insights** (default: `activeTab: "insights"`)
   - Statistics and charts
   - Period selector: "Today", "Week", "Month"
   - State: `statsPeriod: "Today"`

2. **Community** (`activeTab: "community"`)
   - Social features and activities
   - Sub-menu navigation (see [Community Sub-states](#community-sub-states))
   - **Never badged** (per communication model)

3. **Inbox** (`activeTab: "inbox"`)
   - Coordination surface for messages and updates
   - Sub-tabs: Messages / Updates
   - State: `inboxSubTab: "messages" | "updates"` (defaults to last used, or "updates" on first open)
   - **Only tab that shows badge** (unread messages + unresolved updates count)
   - See [Inbox Sub-states](#inbox-sub-states)

4. **Settings** (`activeTab: "settings"`)
   - App configuration
   - Privacy settings
   - Friends management

**Transitions:**
- Tab switch changes `activeTab` value

---

### Community Sub-states

Nested within `activeTab: "community"`.

#### Sub-menu: Friends

**State ID:** `communityMenu: "friends"`

**Description:** Friends list with leaderboard

**Visual:** Scrollable list of friends with success rates

**Sub-states:**
- Normal: Friends list display
- Viewing friend: `viewingFriend !== null` - Friend detail modal
- Adding friend: `isAddingFriend: true` - Add friend modal
- Messaging: `messagingBuddy !== null` - Chat interface

**Transitions:**
- → `viewingFriend: friendObject` - Tap friend card
- → `isAddingFriend: true` - Add friend button
- → `messagingBuddy: friendObject` - Message button

#### Sub-menu: My Upcoming

**State ID:** `communityMenu: "my-upcoming"`

**Description:** User's confirmed and pending activities

**Visual:** Horizontal scrollable list of activity cards

**State Variables:**
- `upcomingActivities: []` - User's joined activities
- `selectedActivity: object | null` - Currently viewing activity

**Transitions:**
- → `selectedActivity: activityObject` - Tap activity card
- → Opens `ActivityDetailsModal`

#### Sub-menu: Discover

**State ID:** `communityMenu: "discover"`

**Description:** Friends' activities and public events

**Visual:** Horizontal scrollable list of activity cards

**State Variables:**
- `friendSharedActivities: []` - Friends' current activities
- `publicEvents: []` - Public events
- `selectedActivity: object | null` - Currently viewing activity

**Transitions:**
- → `selectedActivity: activityObject` - Tap activity card
- → Opens `ActivityDetailsModal`

#### Sub-menu: Plan

**State ID:** `communityMenu: "plan"`

**Description:** Plan new activities

**Visual:** Stub card or existing planned activities

**Actions:**
- "Plan activity" button

**Transitions:**
- → `showPlanModal: true` - Opens `PlanActivityModal`

---

### Inbox Sub-states

Nested within `activeTab: "inbox"`.

#### Sub-tab: Messages

**State ID:** `inboxSubTab: "messages"`

**Description:** Private friend-to-friend conversations

**Visual:** List of conversations ordered by most recent activity

**State Variables:**
- `privateConversations: object` - Conversation data by conversation ID
- `unreadConversationCount: number` - Count of unread conversations

**List Item Display:**
- Friend name
- Last message preview (1 line, truncated)
- Timestamp (relative, e.g., "2h ago")
- Unread indicator (dot or count)

**Empty State:**
- "No messages yet" text

**Transitions:**
- → Opens conversation thread - Tap conversation item
- → `messagingBuddy: friendObject` - Opens full chat interface

**Unread Logic:**
- Conversation is unread if latest message sent by other user AND conversation not opened since
- Opening conversation marks all messages as read
- Inbox badge decrements accordingly
- No read receipts sent to sender

#### Sub-tab: Updates

**State ID:** `inboxSubTab: "updates"`

**Description:** Event-related update notifications

**Visual:** List of unresolved updates ordered by most recent first

**State Variables:**
- `unresolvedUpdates: array` - Array of EventUpdate objects
- `unresolvedCount: number` - Count of unresolved updates

**Update Types:**
1. `event_chat` - New message in event group chat
2. `join_request` - User requested to join your event
3. `join_approved` - Host approved your join request
4. `join_declined` - Host declined your join request
5. `event_updated` - Event details were edited
6. `event_cancelled` - Host cancelled the event
7. `participant_left` - Participant quit the event

**List Item Display:**
- Type-specific icon
- Generated text (e.g., "New message in [Event Title]")
- Optional message preview (for event_chat)
- Timestamp (relative, e.g., "2m ago")
- Chevron right indicator

**Empty State:**
- "All caught up!" text
- "No pending updates" subtext

**Transitions:**
- → Opens Activity Details Modal - Tap update item
- → Resolves update (type-specific logic) - See resolution rules below

**Resolution Logic:**
- `event_chat` → Resolved when Chat tab opened in Activity Details
- `join_request` → Resolved when host accepts/declines
- `join_approved` / `join_declined` → Resolved immediately when activity opened
- `event_updated` / `event_cancelled` / `participant_left` → Resolved immediately when activity opened
- Resolved updates removed from list
- Badge count automatically decrements

**Edge Cases:**
- Opening Inbox does NOT auto-resolve updates
- Must open specific context or take action to resolve
- Updates remain unresolved until explicit user action

---

### State: Active Session Override

**State ID:** `userSessionState.joined === true`

**Description:** Overrides main content when user is in live session

**Prerequisites:** Overrides all other BreakLoop views

**Visual:** Dark background with session info and participant list

**Session Status:**
- `status: "focused"` - Using allowed apps
- `status: "distracted"` - Using non-allowed apps or left session
- `isFinished: true` - Session ended

**State Variables:**
- `userSessionState.sessionId: string` - Active session ID
- `userSessionState.allowedApps: []` - Apps allowed during session
- `leaveCountdown: number` - Seconds remaining before leaving (5s)

**Actions:**
- Leave session button - Starts 5-second countdown
- Auto-leave when countdown reaches 0

**Transitions:**
- → `userSessionState: null` - Session ended
- Status changes based on app usage:
  - Using allowed app → `status: "focused"`
  - Using non-allowed app → `status: "distracted"`
  - Return to BreakLoop → `status: "focused"`

**Edge Cases:**
- Quick task badge shown if active during session
- Status updates when switching apps

---

## Modal States

Modals render on top of current context. Only one modal active at a time (unless nested).

### Modal: Plan Activity

**State ID:** `showPlanModal: true`

**Description:** Create or edit activity

**Modes:**
1. **Solo** (`mode: "solo"`)
   - **AI Suggestion** (`soloMode: "ai"`)
     - Form inputs: topic, location, time preference, date, participants description
     - "Generate suggestions" button
     - Shows 3 AI-generated suggestions
     - Each suggestion: Accept/Edit/Save actions
     - "Back to form" resets suggestions
   - **Manual** (`soloMode: "manual"`)
     - Direct form: title, description, date, time, end time, steps, location
     - Shows "← Back to suggestions" button when `cameFromSuggestions: true`

2. **Group** (`mode: "group"`)
   - Form: title, description, date, time, end time, location
   - Visibility: private/friends/public
   - Max participants, allow auto-join toggle

**Edit Mode:**
- `isEditMode: true` when `editActivity` prop provided
- Pre-fills form with existing activity data
- Determines solo/group mode automatically
- Forces `soloMode: "manual"` for solo activities (no AI suggestions in edit mode)

**State Variables:**
- `mode: "solo" | "group"` - Activity type
- `soloMode: "ai" | "manual"` - Solo sub-mode (preserved across modal close/reopen)
- `suggestions: []` - AI-generated suggestions (preserved when editing suggestion)
- `cameFromSuggestions: boolean` - Tracks if user navigated from AI suggestions to manual edit
- `isLoading: boolean` - Generation in progress
- `error: string` - Error message if generation fails
- `isGettingLocation: boolean` - Location detection in progress

**Validation:**
- Solo manual: Requires title, date, time
- Group: Requires title, date, time

**Transitions:**
- Save/Create → Closes modal → Updates `upcomingActivities` → Resets all state
- Close (from AI suggestions) → Closes modal → Resets all state
- Close (from manual edit with `cameFromSuggestions: true`) → Returns to AI suggestions view
- Close (from manual edit without suggestions) → Closes modal → Resets all state
- Edit suggestion → Switches to manual mode → Sets `cameFromSuggestions: true` → Preserves suggestions
- Back to suggestions → Returns to AI suggestions view → Clears manual form
- Edit activity → Pre-fills form with existing data

**Triggers:**
- "Plan activity" button from community tab
- "Edit activity" from activity details modal

**UI/Scrolling:**
- Modal container: `max-h-[90vh]` with backdrop scrolling
- Header: Fixed at top with close button always accessible
- Content: Scrollable independently from header
- Close button (X): Always visible, positioned absolutely at top-right

**Edge Cases:**
- Form data resets on modal close (except `soloMode` which persists)
- `soloMode` persists across close/reopen to remember user's last selection
- Suggestions preserved when clicking "Edit" on suggestion card
- `cameFromSuggestions` flag enables conditional navigation (back vs. close)
- Edit mode determines mode from activity data
- Edit mode forces manual mode for solo activities (no AI toggle)
- AI suggestions include location and context from form inputs

---

### Modal: Alt Scheduler

**State ID:** `showAltScheduler: true`

**Description:** Schedule alternative activity for future

**State Variables:**
- `altPlanDraft: object | null` - Alternative being scheduled

**Visual:** Similar to Plan Activity modal, pre-filled with alternative data

**Transitions:**
- Save → Adds to daily plan → Closes modal
- Close → Resets draft

**Triggers:**
- "Plan for later" from intervention action screen

---

### Modal: Activity Details

**State ID:** `selectedActivity !== null`

**Description:** Full-screen modal showing activity details and actions

**Visual:** Activity info, status badges, action buttons

**Visibility Logic:**
- `isHost` - User is host of activity (checked: `activity.hostId === currentUserId`)
- `userHasJoined` - User has joined (checked via `findUpcomingActivity()`)
- `activityStatus` - "pending" or "confirmed" (from `upcomingActivity.status`)

**Host Actions (when `isHost === true`):**
- Edit activity → Opens `PlanActivityModal` in edit mode
- Cancel event → Removes from all lists (upcoming, shared, public)

**Participant Actions (when `isHost === false`):**
- Join the event (if `!userHasJoined`)
- Cancel request (if `userHasJoined && activityStatus === "pending"`)
- Quit event (if `userHasJoined && activityStatus === "confirmed"`)

**Request Management (when `isHost === true`):**
- Lists pending join requests
- Accept request → Changes status to "confirmed"
- Decline request → Removes request and pending entry

**Status Badges:**
- "PENDING" - Shows when `userHasJoined && activityStatus === "pending"`
- "CONFIRMED" - Shows when `userHasJoined && activityStatus === "confirmed"`
- "Host" - Shows when `isHost === true`
- Badges only visible when `userHasJoined === true` (except Host badge)

**Transitions:**
- Close → `selectedActivity: null`
- Edit → Opens `PlanActivityModal` with `editActivity` prop
- Join/Accept/Cancel/Quit → Updates activity state → Closes or stays open

**Edge Cases:**
- Same activity shows consistent status across all views
- Status determined by `upcomingActivities` entry, not activity itself
- Badge disappears when user quits event

---

### Modal: Friend Detail

**State ID:** `viewingFriend !== null`

**Description:** Friend profile with stats and settings

**Visual:** Friend info, success rate, privacy settings, notes

**Actions:**
- Update note
- Toggle favorite
- Adjust privacy settings
- Close

**Transitions:**
- Close → `viewingFriend: null` → Returns to friends list

**Triggers:**
- Tap friend card from friends list

---

### Modal: Add Friend

**State ID:** `isAddingFriend: true`

**Description:** Add new friend interface

**Tabs:**
- Phone (`addFriendTab: "phone"`) - Browse phone contacts
- Username (`addFriendTab: "username"`) - Search by username

**Transitions:**
- Add friend → Updates `friendsList` → Closes modal
- Close → `isAddingFriend: false`

**Triggers:**
- "Add friend" button from friends list

---

### Modal: Chat Interface

**State ID:** `messagingBuddy !== null`

**Description:** In-app messaging with friend

**State Variables:**
- `chatMessages: object` - Message history by friend ID
- `chatInput: string` - Current message input

**Transitions:**
- Send message → Updates `chatMessages` → Clears input
- Close → `messagingBuddy: null` → Returns to previous view

**Triggers:**
- Message button from friend detail or friends list

---

### Modal: Edit Apps

**State ID:** `isEditingApps: true`

**Description:** Edit monitored apps list

**Visual:** Full-screen app selection interface (same as onboarding step 1)

**Actions:**
- Toggle apps in/out of monitored list
- Add custom website

**Transitions:**
- Finish → Updates `monitoredApps` → Closes modal
- Close → `isEditingApps: false`

**Triggers:**
- Edit apps button from settings

---

## Proactive Overlay

### State: Proactive Prompt

**State ID:** `proactiveState !== null`

**Description:** Contextual prompts based on time/situation

**Types:**
- Social planning - Weekend approaching
- Sleep hygiene - Late night reminder
- Late night - Activity filtering notice

**Visual:** Notification-style banner

**Transitions:**
- User action → `proactiveState: null`
- Timeout → `proactiveState: null`

**Triggers:**
- Notification click
- Scheduled prompt
- Manual trigger (demo/simulation)

---

## State Transition Matrix

### Intervention Flow Transitions

```
idle → breathing → root-cause → alternatives → action → action_timer → reflection → idle
                                      ↓
                                    timer → [unlocks app]
```

### Context Transitions

```
launcher ↔ app-mindful
launcher ↔ app-{id}
```

### Quick Task Flow

```
[Monitored App Launch]
    ↓
[Quick Task Available?]
    ├─ Yes → Quick Task Dialog → Quick Task Active → [App Unlocked]
    └─ No → Intervention Flow
```

### Activity Join Flow

```
[Discover Activity] → [Join Request] → pending → [Host Accepts] → confirmed
                                          ↓
                                    [Host Declines] → [Removed]
```

---

## Edge Cases & Special Behaviors

### Quick Task Window Management
- 15-minute rolling window automatically resets when expired
- Uses tracking increments on each quick task start
- Light heartbeat refresh every 30s when uses exist
- Free plan enforcement: Auto-resets to defaults if user tries to change

### Intervention State Cancellation
- Intervention can be cancelled at any point via X button
- Home button during intervention clears intervention state
- App launch during Quick Task bypasses intervention check
- Timer unlocks app and sets session expiry, allowing usage

### Activity State Consistency
- Status determined by `upcomingActivities` entry, not source activity
- Same activity shows consistent status badges across all views
- Status badges only visible when `userHasJoined === true`
- Edit mode pre-determines solo/group mode from existing data

### AI Generation Behavior
- Contextual alternatives auto-trigger on AI tab switch (first time only)
- Prevents re-generation when returning from activity view
- Tracks last generated causes to avoid duplicates
- Falls back to generic suggestions if API fails
- Shows warning if API key missing

### Session State Management
- Active session override takes precedence over all other views
- Status transitions: "focused" ↔ "distracted" based on app usage
- Leave countdown: 5-second delay before actually leaving
- Status updates when switching between allowed/non-allowed apps

### Navigation Rules
- Home button always available (except in modals with back button)
- Back navigation: Modal back buttons close modal, intervention back returns to previous step or launcher
- State cleanup: Forms reset on modal close, intervention resets on completion/cancel
- Monitored apps: Clearing session on home button removes unlock token

---

## Trigger Reference

### User Actions
- Tap app icon → Launches app (may trigger intervention)
- Tap BreakLoop icon → Opens BreakLoop app
- Tap home/back button → Returns to launcher
- Select root causes → Updates `selectedCauses`
- Select alternative → Sets `selectedAlternative`
- Start/complete activity → Transitions intervention state
- Join/quit activity → Updates activity state
- Plan/create activity → Opens Plan Activity modal
- Quick task button → Activates quick task
- Timer selection → Unlocks app
- Mood selection → Completes reflection

### Time-Based
- Breathing countdown completion → Auto-transitions to root-cause
- Quick task expiration → Auto-transitions to intervention (if in app)
- Action timer countdown → Updates timer display
- Session leave countdown → Auto-leaves session at 0
- 15-minute quick task window reset → Resets uses counter

### System Events
- Monitored app launch → Checks quick task availability or triggers intervention
- Quick task window availability check → Shows/hides quick task dialog
- AI generation completion → Updates suggestions list
- Activity state updates (join/accept/decline) → Updates UI accordingly

### State-Dependent
- Intervention auto-transitions → Based on timer completion
- Quick task availability checks → Based on window and uses
- Activity button visibility → Based on host/join status
- Modal pre-population → Based on edit mode and existing data

---

## State Variables Reference

### Core State
- `activeContext: "launcher" | "app-mindful" | "app-{id}"`
- `interventionState: "idle" | "breathing" | "root-cause" | "alternatives" | "action" | "action_timer" | "timer" | "reflection"`
- `hasOnboarded: boolean`
- `activeTab: "insights" | "community" | "inbox" | "settings"`
- `communityMenu: "friends" | "my-upcoming" | "discover" | "plan"`
- `inboxSubTab: "messages" | "updates"`

### Intervention State Variables
- `targetApp: object | null`
- `breathingCount: number`
- `selectedCauses: string[]`
- `selectedAlternative: object | null`
- `altTab: "mylist" | "discover" | "ai"`
- `altPage: number`
- `actionTimer: number`
- `isGeneratingAI: boolean`
- `aiSuggestions: object[]`

### Quick Task State Variables
- `showQuickTaskDialog: boolean`
- `pendingQuickTaskApp: object | null`
- `quickTaskActiveUntil: number`
- `activeQuickTaskApp: object | null`
- `quickTaskUsesInWindow: number`
- `quickTaskWindowStart: number`
- `quickTaskUsesPerWindow: number`

### Modal State Variables
- `showPlanModal: boolean`
- `editActivity: object | null` - Activity being edited (passed to PlanActivityModal)
- `showAltScheduler: boolean`
- `selectedActivity: object | null`
- `viewingFriend: object | null`
- `isAddingFriend: boolean`
- `messagingBuddy: object | null`
- `isEditingApps: boolean`

### Plan Activity Modal Internal State
- `mode: "solo" | "group"` - Activity type selection
- `soloMode: "ai" | "manual"` - Solo sub-mode (persists across modal close/reopen)
- `suggestions: object[]` - AI-generated activity suggestions
- `cameFromSuggestions: boolean` - Tracks navigation from AI suggestions to manual edit
- `isLoading: boolean` - AI generation in progress
- `error: string` - Error message for failed AI generation
- `isGettingLocation: boolean` - Location detection in progress
- `aiForm: object` - AI suggestion form inputs (topic, location, timePreference, date, participants)
- `manualForm: object` - Manual form inputs (title, description, date, time, endTime, steps, location)
- `groupForm: object` - Group form inputs (title, description, date, time, endTime, location, maxParticipants, visibility, allowAutoJoin)

### Activity State Variables
- `upcomingActivities: object[]`
- `friendSharedActivities: object[]`
- `publicEvents: object[]`
- `incomingRequests: object[]`
- `pendingRequests: object[]`
- `currentActivity: object | null`

### Session State Variables
- `userSessionState: object | null`
  - `joined: boolean`
  - `sessionId: string`
  - `status: "focused" | "distracted"`
  - `isFinished: boolean`
  - `allowedApps: string[]`
- `leavingSession: boolean`
- `leaveCountdown: number`

### User Account State Variables
- `userAccount: object`
  - `loggedIn: boolean`
  - `name: string`
  - `email: string`
  - `streak: number`
  - `isPremium: boolean`

### Profile State Variables
- `userProfile: object`
  - `displayName: string`
  - `primaryPhoto: string | null`
  - `aboutMe: string`
  - `interests: string`
- `isEditingProfile: boolean`
- `profileDraft: object | null` - Temporary profile data during editing

### Friend/Social State Variables
- `friendsList: array` - Array of friend objects
- `viewingFriend: object | null` - Currently viewing friend
- `viewingFriendFullProfile: boolean` - true = full profile, false = summary
- `isAddingFriend: boolean` - Add friend modal open
- `addFriendTab: "phone" | "whatsapp"` - Active tab in add friend modal
- `messagingBuddy: object | null` - Currently messaging friend

### Inbox State Variables
- `inboxSubTab: "messages" | "updates"` - Active inbox sub-tab
- `unresolvedUpdates: array` - Array of unresolved EventUpdate objects
- `unresolvedCount: number` - Badge count for unresolved updates
- `privateConversations: object` - Conversation data by conversation ID
- `unreadConversationCount: number` - Count of unread conversations

### Registration/Invite State Variables
- `showRegistrationModal: boolean` - Registration modal open
- `pendingFriendRequest: object | null` - Friend request pending registration
- `pendingInviteToken: string | null` - Invite link pending registration
- `showInviteModal: boolean` - Invite generation modal open
- `generatedInviteLink: string | null` - Generated invite link

---

## Implementation Notes

### State Persistence
- Core app state persisted via `useStickyState` hook with localStorage
- Community state persisted via `persistCommunityState` function
- Ephemeral states (modals, temporary UI) not persisted

### State Cleanup
- Forms reset on modal close
- Intervention state resets on completion/cancel
- Temporary states cleared on navigation

### State Validation
- Button states respect validation rules (disabled when prerequisites not met)
- Status checks prevent invalid transitions
- Edge cases handled with defensive checks

### Mobile Considerations
- Touch interactions replace click events
- Modal behavior adapted for mobile gestures
- Navigation patterns follow mobile conventions
- State transitions should feel smooth and responsive

