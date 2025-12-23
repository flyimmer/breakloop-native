# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Eject from react-scripts (one-way operation)
npm run eject
```

## Project Overview

**BreakLoop** is a React-based digital wellbeing application that helps users break mindless scrolling habits through mindful interventions, alternative activity suggestions, and community accountability features.

## Design Documentation

This project includes comprehensive design documentation that serves as the source of truth for UI/UX implementation:

**State Management & Flows:**
- `design/ux/states.md` - Complete UI state definitions, transitions, triggers, and edge cases (997 lines)
- `design/ux/flows.md` - Detailed user flow documentation with 14 major flows covering all user journeys

**Design System:**
- `design/ui/components.md` - Component library specification with all reusable UI components
- `design/ui/screens.md` - Complete screen inventory (38 screens organized by category)
- `design/ui/tokens.md` - Design tokens (colors, spacing, typography, elevation, motion)
- `design/ui/tone-ambient-hearth.md` - Design tone/philosophy ("Ambient Hearth" aesthetic)

**Design Principles:**
- `design/principles/interaction-gravity.md` - Interaction gravity modes for intervention flows
- `design/principles/handoff-rules.md` - Rules for transitioning between Interruption UI and Main App UI

**Component Documentation:**
- `src/components/CauseCard.README.md` - CauseCard component design and implementation guide

**When implementing features:**
- Reference `states.md` for state management and transitions
- Reference `flows.md` for user journey sequences
- Reference `components.md` and `screens.md` for UI structure
- Follow `tone-ambient-hearth.md` and `tokens.md` for styling consistency

## High-Level Architecture

### Single-File Application Pattern
The core application logic resides in `src/App.js` (~8200 lines). This is a deliberate design choice for a prototype/market test. The file orchestrates:
- Multiple screen contexts (launcher, BreakLoop config, dummy apps)
- Intervention flow state machine (breathing → root-cause → alternatives → action → reflection)
- Community/social features with a mock backend layer
- Settings, friends management, and activity planning

**Note:** While the app maintains a single-file core, common utilities, constants, and core business logic have been extracted to shared modules for better maintainability and reusability (especially for React Native).

### Framework-Agnostic Core Logic
The intervention state machine has been extracted into `src/core/intervention/` as pure JavaScript functions with no React dependencies. This allows the same business logic to be reused in React Native or other frameworks. See [Intervention State Machine](#intervention-state-machine) section below.

### Code Organization

**Directory Structure:**
```
src/
├── App.js                      # Main application (8200+ lines)
├── core/                       # Framework-agnostic business logic
│   └── intervention/           # Intervention state machine (pure JS)
│       ├── index.js           # Public API exports
│       ├── state.js           # State definitions and initial context
│       ├── transitions.js     # Pure transition functions (reducer)
│       └── timers.js          # Timer utilities and calculations
├── components/                 # Modular UI components
│   ├── ActivityCard.js
│   ├── ActivityDetailsModal.js
│   ├── ActivitySuggestionCard.jsx
│   ├── AltSchedulerModal.js
│   └── PlanActivityModal.jsx
├── constants/                  # Shared configuration and constants
│   ├── config.js              # App configuration (version, defaults, quick task settings)
│   └── hostLabels.js          # Activity host type labels (card/modal variants)
├── utils/                      # Reusable utility functions
│   ├── activityMatching.js    # Activity ID matching logic
│   ├── eventChat.js           # Event Group Chat storage and utilities
│   ├── eventUpdates.js        # Event Update Signal System (Phase E-2c)
│   ├── gemini.js              # Gemini API integration
│   ├── icons.js               # Icon mapping for apps
│   └── time.js                # Time/date formatting and parsing utilities
├── hooks/
│   └── useStickyState.js      # localStorage persistence hook
├── mockApi.js                  # Mock backend for community features
└── mockActivities.js           # Seed data for activities
```

**Shared Utilities:**
- **Activity Matching** (`utils/activityMatching.js`):
  - `findUpcomingActivity()` - Complex ID matching with 6 different strategies
  - Used by both `ActivityCard` and `ActivityDetailsModal` for consistent status checking
- **Event Chat** (`utils/eventChat.js`):
  - Event-scoped chat message storage and retrieval
  - `loadEventChatState()` - Load all event chat state from localStorage
  - `saveEventChatState()` - Persist event chat state
  - `getEventMessages(eventId)` - Get messages for specific event
  - `addEventMessage(eventId, message)` - Add message to event's chat
  - `generateMessageId()` - Generate unique message IDs
  - `formatMessageTime(timestamp)` - Format relative timestamps (e.g., "2m ago", "3h ago")
  - Storage key: `event_chat_state_v1`
  - Data model: `{ [eventId]: EventChatMessage[] }`
- **Event Updates** (`utils/eventUpdates.js`):
  - Event update signal emission system (Phase E-2c)
  - Creates structured update objects for event-related actions
  - `createEventUpdate()` - Create EventUpdate object
  - `addEventUpdate()` - Add update to storage and emit debug log
  - Signal emitters:
    - `emitEventChatUpdate()` - New message in event chat
    - `emitJoinRequestUpdate()` - User requested to join
    - `emitJoinApprovedUpdate()` - Host approved join request
    - `emitJoinDeclinedUpdate()` - Host declined join request
    - `emitEventUpdatedUpdate()` - Event details edited
    - `emitEventCancelledUpdate()` - Host cancelled event
    - `emitParticipantLeftUpdate()` - Participant quit event
  - Storage key: `event_updates_v1`
  - Data model: `EventUpdate { id, type, eventId, actorId, actorName, message, createdAt, resolved }`
- **Inbox** (`utils/inbox.js`):
  - Inbox utility functions (Phase E-2d)
  - Manages unresolved updates and resolution logic
  - `getUnresolvedUpdates()` - Fetch unresolved updates sorted by time
  - `getUnresolvedCount()` - Calculate badge count
  - `resolveUpdate(updateId)` - Mark single update as resolved
  - `resolveUpdatesByEvent(eventId)` - Resolve all updates for an event
  - `resolveUpdatesByEventAndType(eventId, type)` - Type-specific resolution
  - `formatRelativeTime(timestamp)` - Human-readable timestamps (e.g., "2m ago", "3h ago")
  - Consumes data from `event_updates_v1`
- **Private Messages** (`utils/privateMessages.js`):
  - Private (friend-to-friend) messaging utilities
  - Manages private conversations separate from event group chat
  - `getConversationId(userId1, userId2)` - Generate deterministic conversation ID
  - `loadPrivateConversations()` - Load from localStorage
  - `savePrivateConversations(conversations)` - Save to localStorage
  - `getOrCreateConversation(userId1, userId2)` - Get or create conversation
  - `addMessageToConversation(conversationId, message)` - Add message to conversation
  - `getAllConversationsSorted()` - Get all conversations sorted by last message
  - `getConversation(conversationId)` - Get specific conversation
  - `getOtherParticipantId(conversation, currentUserId)` - Find other user in conversation
  - `migrateOldChatMessages(oldChatMessages, currentUserId)` - One-time migration from old format
  - Storage key: `private_messages_v1`
  - Data model: `PrivateConversation { id, participantIds, messages, createdAt, lastMessageAt }`
- **Host Labels** (`constants/hostLabels.js`):
  - `HOST_LABELS_CARD` - Compact labels for activity cards ("Friend", "Public", "My plan")
  - `HOST_LABELS_MODAL` - Descriptive labels for modals ("Friend activity", "Public event")
  - Icons returned as functions to avoid React context issues
- **Configuration** (`constants/config.js`):
  - App version, user location
  - Quick Task settings (duration options, limits, window duration)
  - Default settings for monitored apps, user account, intervention behavior

### Intervention State Machine

**Location:** `src/core/intervention/` (framework-agnostic)

The intervention flow state machine has been extracted into pure JavaScript functions with no React dependencies. This allows the same business logic to be reused in React Native or other frameworks.

**Architecture:**
- **State-driven**: Uses a reducer pattern with immutable state updates
- **Pure functions**: All transitions are predictable and testable
- **Framework-agnostic**: No React hooks or dependencies

**Files:**
- `state.js` (68 lines) - State definitions, initial context, helper functions
- `transitions.js` (237 lines) - Main reducer and transition logic
- `timers.js` (89 lines) - Timer utilities and calculations
- `index.js` - Public API exports

**States:**
```
idle → breathing → root-cause → alternatives → action → action_timer → reflection → idle
                                     ↓
                                   timer (unlock)
```

**Usage in App.js:**
```javascript
import { 
  createInitialInterventionContext,
  interventionReducer,
  beginIntervention,
  toggleCause,
  startAlternative,
  shouldTickBreathing,
  shouldTickActionTimer
} from './core/intervention';

// Initialize state
const [interventionContext, setInterventionContext] = useState(() => 
  createInitialInterventionContext()
);

// Dispatch actions
const dispatchIntervention = useCallback((action) => {
  setInterventionContext(prev => interventionReducer(prev, action));
}, []);

// Start intervention
setInterventionContext(prev => 
  beginIntervention(prev, app, breathingDuration)
);

// Timer effects
useEffect(() => {
  if (shouldTickBreathing(interventionState, breathingCount)) {
    const timer = setTimeout(() => {
      dispatchIntervention({ type: 'BREATHING_TICK' });
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [interventionState, breathingCount, dispatchIntervention]);
```

**Action Types:**
- `BEGIN_INTERVENTION` - Start intervention for an app
- `BREATHING_TICK` - Decrement breathing countdown
- `SELECT_CAUSE` / `DESELECT_CAUSE` - Toggle cause selection
- `PROCEED_TO_ALTERNATIVES` - Move to alternatives screen
- `PROCEED_TO_TIMER` - User chose "I really need to use it"
- `SELECT_ALTERNATIVE` - Select an alternative activity
- `START_ALTERNATIVE` - Start timer for alternative
- `ACTION_TIMER_TICK` - Decrement action timer
- `FINISH_ACTION` - User manually finishes action
- `FINISH_REFLECTION` - Complete reflection
- `GO_BACK_FROM_ACTION` - Return to alternatives
- `RESET_INTERVENTION` - Reset to idle

**Benefits:**
- ✅ Reusable in React Native
- ✅ Testable (pure functions)
- ✅ Predictable state transitions
- ✅ No framework coupling
- ✅ Single source of truth

**See also:** `INTERVENTION_EXTRACTION_SUMMARY.md` for detailed extraction documentation

### State Management Strategy

**State Architecture:**
- Comprehensive state definitions documented in `design/ux/states.md`
- Root contexts: `launcher`, `app-mindful`, `app-{id}`
- Intervention flow states: `idle`, `breathing`, `root-cause`, `alternatives`, `action`, `action_timer`, `timer`, `reflection`
- Modal states: `showPlanModal`, `showAltScheduler`, `selectedActivity`, etc.
- See `design/ux/states.md` for complete state variable reference and transition matrix

**Persistence Layer:**
- `useStickyState` hook (`src/hooks/useStickyState.js`) wraps localStorage with React state
- Supports a `disablePersistence` option for demo mode
- All user data persists across sessions unless demo mode is enabled

**Mock Backend:**
- `src/mockApi.js` simulates server-side state for community features
- Provides functions like `createJoinRequestState`, `acceptJoinRequestState`, `declineJoinRequestState`
- Uses localStorage key `community_mock_state_v2` for persistence
- Ready to swap with real API calls when backend is available

### Component Architecture

**Modular Components:**
- `ActivityCard` - Displays activity cards in horizontal scrollable lists
  - Receives `upcomingActivities` prop to determine user's join status
  - Shows status badge (PENDING/CONFIRMED) only when activity is in user's `upcomingActivities`
  - Badge logic matches `ActivityDetailsModal` for consistency across all views
  - Uses `findUpcomingActivity()` from `utils/activityMatching.js` for status checking
  - Uses `HOST_LABELS_CARD` from `constants/hostLabels.js` for host type display
- `ActivityDetailsModal` - Full-screen contextual view for viewing/managing activities
  - **Structure**: Three-section tabbed interface (Details / Chat / Participants)
  - **Details Section**:
    - Host actions: Edit activity, Cancel event
    - Participant actions: Join event, Cancel request, Quit event
    - Checks `upcomingActivities` to determine if user has joined
    - Uses shared `findUpcomingActivity()` and `HOST_LABELS_MODAL` utilities
  - **Chat Section** (Event Group Chat v0.1 - Phase E-2b):
    - Event-scoped messaging (chat belongs to the event)
    - Message list with sender name and timestamps
    - Text input with send button
    - Access control: Only host and confirmed participants can chat
    - Messages stored per event using `utils/eventChat.js`
    - Auto-scroll to bottom on new messages
    - Empty state: "No messages yet" with helpful text
    - Restricted state: "Chat is available once you are confirmed" for pending users
  - **Participants Section**:
    - Confirmed participants list (host always shown first)
    - Pending requests management (host-only, with Accept/Decline actions)
  - Full-screen layout with header, section tabs, and close button
- `PlanActivityModal` - AI-powered or manual activity planning interface
  - Supports both create and edit modes
  - Edit mode pre-populates form with existing activity data
  - Uses `parseFormattedDate()`, `parseTimeString()`, `parseTimeRange()` from `utils/time.js` for date/time parsing
- `AltSchedulerModal` - Schedule alternatives for later (Plan for Later flow)
- `ActivitySuggestionCard` - Presents AI suggestions with Accept/Edit/Save actions

**Component Communication:**
- Parent-child prop drilling (no global state library)
- Callback props for user actions
- Shared state managed in App.js and passed down
- Shared utilities imported from `constants/` and `utils/` directories

### Key Features & Flows

**Note:** For detailed flow documentation, see `design/ux/flows.md` which contains 14 comprehensive user flows including:
- First-time onboarding
- Monitored app → Quick Task flow
- Monitored app → Full Intervention flow
- Community activity join flow
- Plan Activity with AI suggestions
- Edit/Cancel activity flows
- And more...

**1. Intervention System**
When a monitored app is launched:
- Quick Task dialog (emergency bypass with time limit)
- Breathing countdown (configurable duration)
- Root cause selection (boredom, anxiety, fatigue, etc.)
- Alternative discovery (My List, Discover, AI For You tabs)
- Action timer with activity steps
- Reflection & streak tracking

**State Flow:** `idle → breathing → root-cause → alternatives → action → action_timer → reflection → idle`
- See `design/ux/states.md` for complete intervention state definitions and transitions

**2. Activity Planning**
Three modes accessible via Community tab:
- **Private + AI**: User provides time/topic/location/participants → Gemini generates 3 specific suggestions → Accept/Edit/Save
- **Private + Manual**: Traditional form input for solo activities
- **Public Hosted**: Create events that publish to friends or public discover feed

**3. Community Features**
- **My Upcoming**: Confirmed solo activities and joined group activities
- **Discover**: Friends' current live activities + public events
- **Ask-to-Join Flow**: Users request → Host accepts/declines → Activity updates to confirmed
- **Live Join**: When starting an activity, host can allow live join for a 5-minute window
- **Activity Management**:
  - **Host Actions** (in Activity Details):
    - Shows "Edit activity" and "Cancel event" buttons
    - Edit activity: Opens PlanActivityModal in edit mode with pre-filled data
    - Cancel event: Removes activity from all lists (upcoming, shared, public)
  - **Participant Actions** (in Activity Details):
    - **"Join the event"**: Shown when activity is NOT in user's `upcomingActivities` list
    - **"Cancel request"**: Shown when activity is in `upcomingActivities` with "pending" status
    - **"Quit event"**: Shown when activity is in `upcomingActivities` with "confirmed" status
  - **Activity Status Logic**:
    - `hosting`: User is the host → Show host actions (Edit/Cancel), never show "Join the event"
    - `pending`: User has requested to join, waiting for approval → Show "Cancel request"
    - `confirmed`: Activity is confirmed (either approved by host or no approval needed) → Show "Quit event"
    - Other statuses: User hasn't joined → Show "Join the event"
  - **Status Badge Consistency**:
    - Both `ActivityCard` and `ActivityDetailsModal` check `upcomingActivities` to determine if user has joined
    - Status badge (PENDING/CONFIRMED) only shows when `userHasJoined = true` (activity found in `upcomingActivities`)
    - Same activity shows same badge status across "My Upcoming" and "Discover" sections
    - When user quits an event, activity is removed from `upcomingActivities`, so badge disappears everywhere

**4. Friends & Privacy**
- Friends list with success rate leaderboard
- Optional sharing: alternatives list, current activity, recent mood
- Privacy toggles in Settings → Social Privacy
- Notes per friend (stored locally)

## AI Integration

**Gemini API** (optional):
- Set `REACT_APP_GEMINI_KEY` environment variable
- Used for:
  - Activity planning suggestions (`PlanActivityModal`)
  - Alternative idea generation (AI For You tab)
  - Deep insights analysis (Insights screen)
- Implementation in `src/utils/gemini.js`
- Gracefully degrades if API key is missing

**Plan an Activity (Private + AI Suggestion):**
- Function: `generateActivitySuggestions()` in `PlanActivityModal.jsx`
- Triggered when user clicks "Generate suggestions" in Community → Plan an activity → Private + AI suggestion mode
- Generates 3 **specific and concrete** activity suggestions using Gemini API
- **AI Behavior:** Provides specific recommendations (e.g., actual movie titles, real venue names, concrete plans) rather than generic suggestions
- **Inputs** (all optional, from user form):
  1. `topic` - User's interest/topic (e.g., "watch a movie in a theater", "stretching", "social")
  2. `location` - Preferred location (e.g., "Park, cafe, online", "Munich downtown")
  3. `timePreference` - Time of day preference: "Morning", "Afternoon", or "Evening"
  4. `date` - ISO date string (defaults to `defaultDate` prop, typically today)
  5. `participantsDescription` - Number of participants and preferences (e.g., "2-4 people, prefer quiet activities", "Recommend a romantic movie for me with my girlfriend")
- **Input Priority Order** (as specified in AI prompt):
  1. **Topic/Interest** (PRIMARY) - Match the topic/interest if provided
  2. **Location** - Can be done at or near the specified location
  3. **Time of Day** - Appropriate for the time preference
  4. **Participants Description** - Consider number of people and their preferences
  5. **Date** - Mentioned but lower priority
- **Default Values** (when inputs are empty):
  - **In AI Prompt:**
    - `topic`: `"general wellness"`
    - `location`: `"flexible location"`
    - `timePreference`: `"any time"`
    - `date`: `"today"`
    - `participantsDescription`: `"no specific participant preferences"`
  - **In Response Processing** (when AI response is missing fields):
    - `title`: `"Suggested Activity"`
    - `description`: `"No description provided"`
    - `time`: From `getDefaultTime()` function (see below)
    - `location`: `"Your preferred location"`
    - `topic`: `"General wellness"`
    - `duration`: `"30-60m"`
  - **Default Time Values** (based on time preference):
    - Morning: `["08:00", "09:30", "07:00"]` (for 3 suggestions)
    - Afternoon: `["14:00", "15:30", "16:00"]`
    - Evening: `["18:30", "19:00", "20:00"]`
    - No preference: `["09:00", "14:00", "18:30"]`
    - Fallback: `"09:00"`
- **Output Format:**
  - JSON array of 3 activity objects
  - Each object contains: 
    - `title` - Specific activity name (e.g., "Watch 'Past Lives' at Cinema München")
    - `description` - Detailed description with concrete recommendations, venue names, movie titles, etc.
    - `duration` - Estimated time like "30-45m" or "120-150m"
    - `time` - Suggested start time in HH:MM format (24-hour)
- **AI Output Requirements:**
  - Must be specific and concrete (not generic wellness suggestions)
  - Should recommend actual movie titles, restaurant names, venue details when relevant
  - Should include location details in descriptions
  - Example: If user asks for "romantic movie with girlfriend", AI suggests specific movie titles at specific theaters
- **Error Handling:**
  - Falls back to `getFallbackSuggestions()` if API fails or returns invalid response
  - Fallback provides 3 generic suggestions using form inputs
  - Shows error message in UI if generation fails

**AI For You Tab (Intervention Flow):**
- Function: `handleGenerateContextualAlternatives()` in `App.js`
- Triggered automatically when user opens "AI For You" tab after selecting root causes
- Generates 3 contextual alternative activity suggestions using Gemini API
- **Input Priority Order** (from most to least important):
  1. **Root causes/emotions** (PRIMARY) - Selected emotional states (boredom, anxiety, fatigue, loneliness, self-doubt, no goal)
  2. **Location** - User's current location (`USER_LOCATION` constant, default: "Munich")
  3. **Social context** - Nearby friends within 50km (same location as proxy)
     - Includes friend names, locations, and current/recent activities
     - Suggests activities that could involve joining friends if appropriate
  4. **User's values/goals** - Core values from `selectedValues` state
     - Maps to labels: Career, Health, Love, Kids, Reading, Nature, Social
     - AI prioritizes activities aligned with these values
  5. **User's saved alternatives/preferences** - Historical activity data
     - Saved alternatives from `savedAlternativeIds`
     - Custom alternatives from `customAlternatives`
     - Recent activities from `sessionHistory` (last 10 sessions)
     - Shows top 5 preferences to guide similar suggestions
  6. **Time of day** - Current time (`currentTime` state)
     - Determines morning/afternoon/evening/night context
     - Influences time-appropriate activity suggestions
  7. **Weather** - Current weather condition (`weather` state: "sunny" or "rainy")
  8. **Target app** - App that triggered the intervention (e.g., "Instagram", "TikTok")
- **Prompt Structure:**
  - Primary context section with emotional state and location
  - Conditional sections for social context, values, and preferences (only if available)
  - Time, weather, and trigger app information
  - Instructions to prioritize emotional state first, then contextual factors
- **Output Format:**
  - JSON array of 3 activity objects
  - Each object contains: `title`, `desc`, `duration`, `actions` (array of 3 steps), `type`
  - Types: social/calm/creative/active/productive/rest
- **Error Handling:**
  - Gracefully handles missing data (e.g., no friends, no values set, empty history)
  - Falls back to basic suggestions if API fails
  - Shows toast notifications for errors

## Important Implementation Details

### Event Update Signal System (Phase E-2c)

**Purpose:**  
A unified architectural system for emitting structured update signals when event-related actions occur. These signals are consumed by Inbox v1 (Phase E-2d).

### Inbox v1 (Phase E-2d)

**Purpose:**  
Provides a dedicated coordination surface for users to receive and manage event-related updates. The Inbox is a top-level tab with two sub-tabs: Messages (placeholder) and Updates (fully functional).

**Architecture:**
- All event-related actions emit `EventUpdate` objects
- Updates stored in localStorage (`event_updates_v1`)
- Updates logged to console for debugging
- No UI rendering in this phase (data-only)

**EventUpdate Data Model:**
```javascript
{
  id: string                    // Unique update ID
  type: string                  // One of: event_chat, join_request, join_approved, 
                                //   join_declined, event_updated, event_cancelled, 
                                //   participant_left
  eventId: string              // Associated event ID
  actorId: string              // User who triggered the update
  actorName: string            // Display name of actor
  message: string              // Short preview or description (optional)
  createdAt: number            // Timestamp
  resolved: boolean            // Always false (resolution logic in future phase)
}
```

**Emission Points:**
1. **Event Chat Message Sent** → `event_chat` update
   - Location: `ActivityDetailsModal.handleSendMessage()`
   - Includes message text preview (truncated to 50 chars)

2. **Join Request Created** → `join_request` update
   - Location: `App.handleRequestToJoin()`
   - Actor: User requesting to join

3. **Join Request Accepted** → `join_approved` update
   - Location: `App.handleAcceptRequest()`
   - Actor: Host who accepted

4. **Join Request Declined** → `join_declined` update
   - Location: `App.handleDeclineRequest()`
   - Actor: Host who declined

5. **Event Updated** → `event_updated` update
   - Location: `App.handleUpdateActivity()`
   - Actor: User who edited the event
   - Message: "Event details updated"

6. **Event Cancelled** → `event_cancelled` update
   - Location: `App.handleCancelActivity()`
   - Actor: Host who cancelled

7. **Participant Left** → `participant_left` update
   - Location: `App.handleQuitActivity()`
   - Actor: User who quit

**Design Constraints:**
- No UI added in Phase E-2c (data-only)
- Updates append-only (no deduplication)

**Inbox v1 Architecture (Phase E-2d):**

**Location:** `src/utils/inbox.js` - Inbox utility functions  
**Navigation:** Bottom tab between Community and Settings  
**Badge:** Shows unresolved update count (Community is NEVER badged)

**Sub-tabs:**
1. **Messages** - Placeholder only, shows "No messages yet" empty state
2. **Updates** - Fully functional, renders all unresolved EventUpdate items

**Update Rendering:**
- Type-specific icons and text for all 7 update types
- Sorted by time (most recent first)
- Shows event title, optional message preview, and relative timestamp
- Tappable items with deep-linking to Activity Details

**Resolution Logic:**
- `event_chat` → Resolves when Chat tab opened in Activity Details
- `join_request` → Resolves when host accepts/declines
- `join_approved` / `join_declined` → Resolves immediately when activity opened
- `event_updated` / `event_cancelled` / `participant_left` → Resolves immediately when activity opened
- Updates removed from list after resolution
- Badge count automatically decrements

**Integration Points:**
- `ActivityDetailsModal` calls `onChatOpened()` when Chat tab opens
- `handleAcceptRequest()` and `handleDeclineRequest()` resolve join_request updates
- `handleUpdateClick()` handles deep-linking and type-specific resolution

### Private Messaging System

**Purpose:**  
Provides unified private (friend-to-friend) messaging accessible from multiple entry points. Completely separate from event group chat.

**Architecture:**

**Entry Points:**
1. Community → Friends list → Chat icon
2. Community → Friend profile → Chat button
3. Inbox → Messages → Conversation list

**Data Storage:**
- Single source of truth: `private_messages_v1` in localStorage
- Format: `{ [conversationId]: PrivateConversation }`
- Conversation ID: Deterministic based on sorted participant IDs (`conv_userId1_userId2`)

**Message Flow:**
- User sends message → `handleSendChatMessage()` → `addMessageToConversation()` → localStorage
- Chat UI reads from `getConversation(conversationId)`
- Inbox reads from `getAllConversationsSorted()`
- Both views show same data

**Key Features:**
- Automatic migration from old `chatMessages` format (runs once)
- Conversations sorted by last message time
- Last message preview in Inbox
- Proper timestamps (shown as "9:30 AM" in chat, "2m ago" in list)
- Opens same conversation regardless of entry point

**Separation from Event Chat:**
- Private messages: Friend-to-friend, stored in `private_messages_v1`
- Event chat: Group chat per event, stored in `event_chat_state_v1`
- No overlap or confusion between the two systems

### Unread & Resolution Semantics (Phase E-2e)

**Purpose:**  
Implement correct, minimal, non-coercive unread and resolution logic for Inbox v1 to ensure users are informed without pressure.

**Private Messages — Unread Logic:**
- Conversation is UNREAD if:
  - Latest message sent by OTHER user
  - Conversation not opened since that message
- Conversation marked READ when user opens it
- All messages in conversation marked read together
- No read receipts sent to other user
- `lastReadAt` field tracks read state per conversation

**Updates — Resolution Logic:**
- Updates remain UNRESOLVED until explicit user action
- Resolution rules per type (unchanged from Phase E-2d)
- Opening Inbox does NOT auto-resolve updates
- Must open specific context or take action

**Badge Logic:**
- **Inbox tab badge:** `unreadConversations + unresolvedUpdates`
- **Messages badge:** Count of unread conversations
- **Updates badge:** Count of unresolved updates
- **Other tabs:** NEVER badged (Community, Insights, Settings)
- Badges update immediately when state changes
- No color escalation, pulsing, or animation

**Key Functions:**
- `isConversationUnread(conversation, userId)` - Check if conversation has unread messages
- `markConversationAsRead(conversationId)` - Mark conversation as read
- `getUnreadConversationCount(userId)` - Count unread conversations

**Stability Rules:**
- If user ignores Inbox → unread state remains as-is
- No escalation occurs
- No reminders or nudges
- Unread indicates STATE, not OBLIGATION

### State Persistence Keys
When debugging or resetting state, be aware of these localStorage keys:
- `mindful_*_v17_2` - Main app state (values, monitored apps, plan, etc.)
- `mindful_*_v17_6` - Settings and friends (includes new privacy fields)
- `community_mock_state_v2` - Community activities and requests
- `event_chat_state_v1` - Event Group Chat messages (Phase E-2b)
- `event_updates_v1` - Event update signals consumed by Inbox (Phase E-2c/E-2d)
- `private_messages_v1` - Private friend-to-friend conversations (unified messaging)
- `private_messages_migrated_v1` - Migration flag for one-time chatMessages migration

### Quick Task System
- Allows brief monitored app usage without full intervention
- 15-minute rolling window with configurable uses per window
- Premium feature: customize duration (10s for testing, 2/3/5 min for prod) and uses (1-2)
- Free plan: locked to 3min duration, 1 use per window

### Modal Rendering Pattern
Modals are rendered at the root level to ensure proper z-index stacking:
- `renderGlobalModals()` function in launcher context
- `AltSchedulerModal` accessible from both intervention flow and community tab
- State props: `showAltScheduler`, `altPlanDraft`

### Time Utilities
`src/utils/time.js` provides comprehensive time and date utilities:

**Time Conversion:**
- `timeToMins(time)` - Convert "HH:MM" to minutes
- `minsToTime(mins)` - Convert minutes to "HH:MM"
- `addMinutes(time, mins)` - Add minutes to a time string
- `formatSeconds(totalSeconds)` - Format countdown timers
- `formatQuickTaskDuration(minutes, options)` - Format duration with optional long format

**Date/Time Parsing** (used by PlanActivityModal for edit mode):
- `parseFormattedDate(dateStr, defaultDate)` - Parses formatted dates (e.g., "Mon, Nov 18") to ISO format (YYYY-MM-DD)
  - Handles year inference for dates that may be in the next year
  - Returns ISO format if already provided
- `parseTimeString(timeStr)` - Parses time strings to HH:MM 24-hour format
  - Supports: "9:30 AM", "09:30 AM", "9:30", "19:30"
  - Converts 12-hour format with AM/PM to 24-hour format
- `parseTimeRange(timeStr)` - Extracts start and end times from range strings
  - Handles: "9:30 AM - 11:00 AM", "9:30 - 11:00", single times
  - Returns: `{ start: "09:30", end: "11:00" }` or `{ start: "09:30", end: "" }`

**Date/Time Formatting in BreakLoopConfig:**
- `formatDateLabel(dateVal)` - Formats ISO date to "Weekday, Month Day" (e.g., "Sat, Dec 13")
- `buildTimeLabel(start, end)` - Formats time range as "HH:MM - HH:MM" or single time "HH:MM"
- Both functions are defined within BreakLoopConfig component scope

## Development Workflow Notes

**From DEVELOPMENT_NOTE_PLAN_ACTIVITY.md:**
- AI stub `generateActivitySuggestions()` returns 3 mock ideas; replace with backend call when ready
- Activities persist via `communityData` → `persistCommunityState` (localStorage)
- Group creation publishes to `publicEvents` when visibility is public
- Modal state resets on close (handleClose) to prevent stuck states
- "Back to form" button clears AI suggestions and returns to input form
- Accepting/saving/creating activities triggers modal reset for clean reopening

**QA Checklist:**
- Solo manual save adds item to My Upcoming with confirmed status
- Solo AI Accept/Save adds confirmed item to My Upcoming
- Solo AI Edit populates manual form and clears suggestions
- Group Create & Publish adds to My Upcoming and Discover (based on visibility)
- Pending join requests render in host modal and can be accepted
- localStorage updates on activity changes (refresh retains new activities)
- **Activity Management:**
  - Host can edit activity (title, description, date, start/end time, location, visibility)
  - Host can cancel event (removes from all lists, shows toast confirmation)
  - Non-host participants can quit event (removes from their upcoming list only)
  - Edit mode pre-populates all fields correctly, including time range parsing
  - Form validation prevents saving incomplete activities
- **Activity Details Modal Button Logic:**
  - `isHost = true`: Shows "Edit activity" and "Cancel event" buttons only
  - `isHost = false` + activity in `upcomingActivities`: Shows "Quit event" (if confirmed) or "Cancel request" (if pending)
  - `isHost = false` + activity NOT in `upcomingActivities`: Shows "Join the event"
  - Status badges ("CONFIRMED", "PENDING") only shown when `userHasJoined = true` (activity found in `upcomingActivities`)
  - Host users see "Host" badge instead of status badges
- **Status Badge Consistency:**
  - `ActivityCard` and `ActivityDetailsModal` both check `upcomingActivities` to determine join status
  - Same activity shows same badge in "My Upcoming" and "Discover" sections
  - Badge disappears when user quits event (activity removed from `upcomingActivities`)
  - All `ActivityCard` instances receive `upcomingActivities={state.upcomingActivities || []}` prop

## Code Style & Patterns

**Lucide React Icons:**
- All icons imported from `lucide-react`
- Consistent sizing: `<Icon size={16} />` for buttons, `<Icon size={12} />` for labels
- **Important:** Icons in exported constants must be wrapped in functions (e.g., `icon: () => <Users size={12} />`) to avoid React context issues

**Tailwind Utility Classes:**
- Extensive use of Tailwind CSS for styling
- Responsive breakpoints for mobile-first design
- Custom animations: `animate-in`, `slide-in-from-bottom`, `zoom-in-95`

**React Patterns:**
- Functional components with hooks
- useMemo for expensive computations and JSX elements
- useCallback for stable function references
- useRef for DOM references and mutable values
- Reducer pattern for complex state machines (intervention flow)

**Code Quality:**
- No debug logging or external fetch calls in production code
- Shared utilities extracted to avoid duplication
- Constants centralized in `constants/` directory
- Core business logic extracted to `core/` directory (framework-agnostic)
- All components use shared utilities for consistent behavior

**State Machine Pattern:**
- Intervention flow uses extracted reducer pattern
- Pure functions for state transitions
- Framework-agnostic core logic in `src/core/intervention/`
- React layer only handles UI and side effects (timers, storage)

## Testing Considerations

- Mock data in `src/mockActivities.js` provides seed data
- Demo mode (`demoMode` state) disables persistence for testing
- Quick Task testing timer: 10 seconds (auto-enabled in demo mode)
- `mockApi.test.js` exists but implementation is minimal

## External Dependencies

Key production dependencies:
- `react: ^19.0.0`
- `react-dom: ^19.0.0`
- `lucide-react: 0.555.0` (icon library)

Development:
- `react-scripts: ^5.0.0` (Create React App tooling)
- `typescript: 5.7.2` (not actively used, but available)

## Environment Variables

```bash
# Optional: Enable AI features
REACT_APP_GEMINI_KEY=your_api_key_here
```

## Recent Refactoring (December 2025)

The codebase underwent incremental refactoring to improve maintainability while preserving all existing functionality:

**Phase 1 - Cleanup & Security:**
- Removed all debug logging (external fetch calls to hardcoded debug endpoints)
- Eliminated 8+ debug fetch calls from `mockApi.js`, `App.js`, and `ActivityDetailsModal.js`
- Cleaned up console.log debug statements

**Phase 2 - Extract Shared Utilities:**
- Created `constants/hostLabels.js` - Extracted duplicate HOST_LABELS from ActivityCard and ActivityDetailsModal
- Created `utils/activityMatching.js` - Extracted `findUpcomingActivity()` logic (20+ lines of duplicate code)
- Enhanced `utils/time.js` - Added date/time parsing functions from PlanActivityModal
  - `parseFormattedDate()`, `parseTimeString()`, `parseTimeRange()`
  - 107 lines of parsing logic now reusable and testable
- Created `constants/config.js` - Centralized app configuration constants
  - Version, location, Quick Task settings, default values

**Impact:**
- **-218 lines** of duplicate/debug code removed
- **+96 lines** added in reusable utilities
- **Net improvement:** -122 lines + better organization
- Build verified: No breaking changes, all functionality preserved
- Components now share utilities for consistent behavior

**Files Created:**
- `src/constants/hostLabels.js` (19 lines)
- `src/constants/config.js` (48 lines)
- `src/utils/activityMatching.js` (29 lines)

**Files Significantly Modified:**
- `src/App.js` (6,442 → 6,385 lines, -57 lines)
- `src/components/PlanActivityModal.jsx` (904 → 797 lines, -107 lines)
- `src/utils/time.js` (30 → 158 lines, +128 lines for new parsing functions)

**Phase 3 - Extract Intervention State Machine (December 2025):**
- Extracted intervention flow logic into framework-agnostic core module
- Created `src/core/intervention/` directory with pure JavaScript functions
- Converted 6 separate `useState` calls to single `interventionContext` state
- Implemented reducer pattern for predictable state transitions
- All intervention logic now reusable in React Native

**Files Created:**
- `src/core/intervention/state.js` (68 lines) - State definitions
- `src/core/intervention/transitions.js` (237 lines) - Transition logic
- `src/core/intervention/timers.js` (89 lines) - Timer utilities
- `src/core/intervention/index.js` (11 lines) - Public API
- `INTERVENTION_EXTRACTION_SUMMARY.md` - Detailed extraction documentation

**Files Modified:**
- `src/App.js` (8,232 lines) - Updated to use extracted intervention core
  - Replaced direct state mutations with `dispatchIntervention()` calls
  - Updated timer effects to use extracted logic
  - Maintained 100% backward compatibility

**Impact:**
- **+394 lines** of framework-agnostic core logic
- **Zero behavior changes** - all functionality preserved
- **Build verified** - compiles successfully
- **Ready for React Native** - same logic can be reused


## React Native Compatibility

The intervention state machine has been extracted to prepare for React Native app development:

**Framework-Agnostic Core:**
- `src/core/intervention/` contains pure JavaScript with no React dependencies
- Can be imported directly into React Native projects
- Same business logic for web and mobile

**Usage in React Native:**
```javascript
// Import the same core logic
import { 
  createInitialInterventionContext,
  interventionReducer,
  beginIntervention,
  shouldTickBreathing
} from './core/intervention';

// Use with React Native state
const [context, setContext] = useState(createInitialInterventionContext());

// Same dispatch pattern
const dispatch = (action) => {
  setContext(prev => interventionReducer(prev, action));
};

// Same timer logic
useEffect(() => {
  if (shouldTickBreathing(context.state, context.breathingCount)) {
    const timer = setTimeout(() => {
      dispatch({ type: 'BREATHING_TICK' });
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [context.state, context.breathingCount]);
```

**What's Portable:**
- ✅ Intervention state machine (`core/intervention/`)
- ✅ Time utilities (`utils/time.js`)
- ✅ Activity matching logic (`utils/activityMatching.js`)
- ✅ Configuration constants (`constants/config.js`)

**What Needs Adaptation:**
- ⚠️ UI components (React Native uses different primitives)
- ⚠️ Storage layer (use AsyncStorage instead of localStorage)
- ⚠️ Navigation (use React Navigation instead of context switching)

**Future Extractions:**
Other state machines can follow the same pattern:
- Community activity flow
- Quick Task system
- Inbox update management

## Git Workflow

Current branch: `Community_Optimization`
Main branch: `main`

Recent commit themes:
- Intervention state machine extraction (December 2025)
  - Extracted core logic to `src/core/intervention/`
  - Prepared codebase for React Native reuse
  - Maintained 100% backward compatibility
- Code refactoring for maintainability (December 2025)
  - Removed debug logging and external fetch calls
  - Extracted shared utilities and constants
  - Created `constants/` and enhanced `utils/` directories
- Bug fixes and syntax error corrections
- Community feature development (plan activity, ask-to-join flow)
- Privacy settings expansion
- Activity management features (edit, cancel, quit event)
- PlanActivityModal edit mode support with start/end time fields

## Documentation Structure

**For Developers:**
- `CLAUDE.md` (this file) - Architecture, implementation details, development workflow
- `DEVELOPMENT_NOTE_PLAN_ACTIVITY.md` - Plan Activity feature-specific notes and QA checklist
- Component READMEs (e.g., `src/components/CauseCard.README.md`) - Component-specific documentation

**For Designers/UX:**
- `design/ux/states.md` - Complete state management reference
- `design/ux/flows.md` - User journey flows
- `design/ui/components.md` - Component library specification
- `design/ui/screens.md` - Screen inventory
- `design/ui/tokens.md` - Design tokens
- `design/ui/tone-ambient-hearth.md` - Design philosophy
- `design/principles/` - Design principles and interaction rules
