# BreakLoop — Handoff Notes for React Native Implementation

**Purpose:** Document web simulation limitations and implementation notes for native mobile development

**Status:** Authoritative  
**Last Updated:** December 22, 2025

---

## Overview

This document captures important notes about the current web simulation and what must be considered when implementing the native mobile app. The web simulation is the **source of truth** for behavior, but has inherent limitations due to being a single-account browser-based prototype.

---

## Single-Account Simulation Limitations

### What the Web Simulation Does

The current React web app simulates a **single user's experience** with:
- Local-only data storage (localStorage)
- Mock backend API (`src/mockApi.js`)
- Simulated friends and activities (seed data)
- Single-device perspective

### What Cannot Be Tested in Web Simulation

1. **Multi-User Interactions:**
   - Real friend requests between actual users
   - Real-time updates when friend performs action
   - Actual message delivery and synchronization
   - True event participant coordination

2. **Cross-Device Behavior:**
   - Notification delivery on other devices
   - Data sync across multiple devices
   - Offline/online state transitions
   - Background process behavior

3. **Native Platform Features:**
   - Deep linking (invite links)
   - Native share sheets
   - Push notifications
   - Background app refresh
   - Native file pickers (photo upload)
   - Native date/time pickers

4. **Network Conditions:**
   - Slow network handling
   - Offline mode
   - Sync conflicts
   - API error recovery

### Testing Strategy for Native Implementation

**Phase 1: Single-User Testing**
- Use web simulation behavior as reference
- Test all flows with single account
- Verify state management and persistence

**Phase 2: Multi-User Testing**
- Test with 2-3 real accounts
- Verify friend requests work bidirectionally
- Test message delivery between users
- Verify event updates reach all participants

**Phase 3: Multi-Device Testing**
- Test same account on multiple devices
- Verify data synchronization
- Test notification delivery
- Verify offline/online transitions

---

## Frozen vs. Flexible Behavior

### Frozen Behavior (Must Match Web Simulation)

These behaviors are **locked** and must be implemented exactly as in the web simulation:

1. **Intervention Flow:**
   - Breathing → Root Cause → Alternatives → Action → Timer → Reflection
   - State transitions and timing
   - Quick Task dialog and window management
   - Governed by `design/principles/interaction-gravity.md`

2. **Inbox Architecture:**
   - Inbox is ONLY tab with badge
   - Community tab NEVER badged
   - Messages and Updates sub-tabs
   - Update resolution logic (type-specific)
   - Governed by `design/principles/communication-model.md`

3. **Registration Gating:**
   - Specific trigger points (add friend, generate invite, accept invite)
   - Pending action storage and resumption
   - Modal flow and state management

4. **Activity Status Logic:**
   - Status determined by `upcomingActivities` entry, not activity itself
   - Badge consistency across all views
   - Host vs. participant action buttons
   - Join request flow (pending → confirmed)

5. **Profile Privacy:**
   - Only show fields friend has populated
   - No read receipts on messages
   - No typing indicators
   - Governed by `design/principles/social-feature-guardrails.md`

### Flexible Behavior (Can Be Adapted)

These behaviors can be adjusted for native platform best practices:

1. **Navigation Patterns:**
   - Bottom tab bar vs. other navigation patterns
   - Modal presentation styles (sheet, full-screen, card)
   - Back button behavior (can follow platform conventions)

2. **Visual Design:**
   - Colors, spacing, typography (follow design tokens)
   - Animation timing and easing
   - Icon styles (can use platform-specific icons)

3. **Form Inputs:**
   - Date/time picker styles (use native pickers)
   - Text input keyboards (use platform-appropriate keyboards)
   - Photo upload flow (use native image picker)

4. **Notifications:**
   - Notification format and content
   - Notification grouping and priority
   - Notification actions (quick reply, etc.)

5. **Performance Optimizations:**
   - List virtualization
   - Image caching
   - Background sync frequency
   - Data pagination

---

## Backend Integration Notes

### Current Mock Backend (`src/mockApi.js`)

The web simulation uses a mock backend that:
- Stores all data in localStorage
- Simulates server-side state changes
- Provides synchronous responses
- No network latency or errors

**Storage Keys:**
- `community_mock_state_v2` - Community activities and requests
- `event_chat_state_v1` - Event group chat messages
- `event_updates_v1` - Event update signals
- `private_messages_v1` - Private friend-to-friend conversations
- `mindful_*_v17_2` - Main app state
- `mindful_*_v17_6` - Settings and friends

### Backend Requirements for Native App

1. **User Authentication:**
   - Registration endpoint (name, email)
   - Login/logout
   - Session management
   - Password reset (future)

2. **Friend Management:**
   - Send friend request
   - Accept/decline friend request
   - Remove friend
   - Generate invite link
   - Validate invite token

3. **Activity Management:**
   - Create activity (solo/group)
   - Edit activity
   - Cancel activity
   - Join activity (request or auto-join)
   - Accept/decline join request
   - Quit activity
   - List activities (upcoming, discover, friends)

4. **Messaging:**
   - Send private message
   - Fetch conversation history
   - Mark messages as read
   - Send event group chat message
   - Fetch event chat history

5. **Event Updates:**
   - Emit event update signals
   - Fetch unresolved updates
   - Mark update as resolved
   - Push notification integration

6. **Profile Management:**
   - Update profile (display name, about me, interests)
   - Upload profile photo
   - Fetch friend profiles

7. **Intervention Data:**
   - Save session history
   - Sync alternatives list
   - Sync custom alternatives
   - Fetch AI suggestions (Gemini API integration)

### API Design Principles

- **RESTful endpoints** for CRUD operations
- **WebSocket or polling** for real-time updates
- **Optimistic updates** on client for better UX
- **Conflict resolution** for offline edits
- **Rate limiting** to prevent abuse
- **Data pagination** for large lists

---

## State Management for Native App

### Recommended Architecture

1. **Local State:**
   - Use React Context or Redux for app-wide state
   - AsyncStorage for persistence (equivalent to localStorage)
   - Separate stores for different concerns (auth, community, intervention, inbox)

2. **Server State:**
   - Use React Query or SWR for server data caching
   - Automatic refetching and cache invalidation
   - Optimistic updates for mutations

3. **Real-Time Updates:**
   - WebSocket connection for live updates
   - Fallback to polling if WebSocket unavailable
   - Reconnection logic for network interruptions

### State Persistence Strategy

**Always Persist:**
- User account (logged in, name, email)
- User profile (display name, about me, interests)
- Settings (monitored apps, privacy, quick task config)
- Intervention history (session history, alternatives)
- Friends list
- Upcoming activities

**Cache with Expiration:**
- Discover feed activities (refresh on app open)
- Friend shared activities (refresh periodically)
- Inbox updates (refresh on inbox open)
- Conversation messages (refresh on conversation open)

**Never Persist:**
- Temporary UI state (modal open, loading states)
- Intervention flow state (always start fresh)
- Form drafts (except profile draft during editing)

---

## Platform-Specific Considerations

### iOS

**Navigation:**
- Use native navigation patterns (UINavigationController, UITabBarController)
- Swipe-back gesture for modal dismissal
- Modal presentation styles (sheet, full-screen)

**Notifications:**
- APNs integration for push notifications
- Notification categories for actions
- Badge number on app icon

**Deep Linking:**
- Universal Links for invite links
- URL scheme for fallback

**Design:**
- Follow iOS Human Interface Guidelines
- Use SF Symbols for icons
- Native date/time pickers

### Android

**Navigation:**
- Use Android Navigation Component
- Back button handling at each screen level
- Bottom sheet for modals

**Notifications:**
- FCM integration for push notifications
- Notification channels for categorization
- Badge number on app icon (launcher support)

**Deep Linking:**
- App Links for invite links
- Intent filters for URL scheme

**Design:**
- Follow Material Design guidelines
- Use Material Icons
- Native date/time pickers

---

## Known Issues and Workarounds

### Web Simulation Issues

1. **No Real-Time Updates:**
   - Web simulation requires manual refresh to see changes
   - Native app must implement WebSocket or polling

2. **No Background Processing:**
   - Web simulation cannot run timers in background
   - Native app must use background tasks for:
     - Quick task expiration
     - Activity reminders
     - Session tracking

3. **No Push Notifications:**
   - Web simulation uses in-app toasts only
   - Native app must implement push notifications for:
     - New messages
     - Friend requests
     - Join requests
     - Event updates

4. **Single Device Only:**
   - Web simulation cannot test multi-device sync
   - Native app must implement proper sync logic

### Workarounds in Web Simulation

1. **Mock Friends:**
   - Seed data provides simulated friends
   - Native app must handle empty friends list

2. **Simulated Activities:**
   - Seed data provides sample activities
   - Native app must handle empty discover feed

3. **No Photo Upload:**
   - Web simulation uses file input
   - Native app must use native image picker

4. **No Deep Linking:**
   - Web simulation simulates invite link flow
   - Native app must implement proper deep linking

---

## Testing Checklist for Native App

### Core Flows (Must Match Web Simulation)

- [ ] Onboarding (values → monitored apps)
- [ ] Intervention flow (all paths)
- [ ] Quick Task (dialog → timer → expiration)
- [ ] Plan Activity (AI suggestions → manual edit)
- [ ] Join Activity (request → pending → confirmed)
- [ ] Edit Activity (pre-fill → save)
- [ ] Cancel Activity (confirmation → removal)
- [ ] Inbox Messages (list → conversation → read)
- [ ] Inbox Updates (list → tap → resolve)
- [ ] Registration Gating (trigger → modal → resume)
- [ ] Add Friend (from participants, invite link)
- [ ] View/Edit Profile (view → edit → save/cancel)
- [ ] View Friend Profile (summary → full → actions)

### Multi-User Flows (Cannot Test in Web Simulation)

- [ ] Send friend request → Other user receives
- [ ] Accept friend request → Both users see confirmed
- [ ] Send message → Other user receives
- [ ] Join activity → Host receives request
- [ ] Host accepts join → User receives approval
- [ ] Event chat message → All participants receive
- [ ] Cancel event → All participants notified

### Platform-Specific Features

- [ ] Push notifications work correctly
- [ ] Deep linking opens correct screen
- [ ] Native share sheet for invite links
- [ ] Native image picker for profile photo
- [ ] Native date/time pickers for activities
- [ ] Background tasks for timers
- [ ] Offline mode with sync on reconnect

### Edge Cases

- [ ] Inbox badge never on Community tab
- [ ] Updates remain unresolved until action
- [ ] Status badge consistency across views
- [ ] Registration modal closes other modals
- [ ] Invite link idempotency
- [ ] Profile draft discarded on cancel
- [ ] Friend removal confirmation

---

## Migration Path from Web to Native

### Phase 1: Core Features (MVP)

**Scope:** Single-user experience matching web simulation

**Features:**
- Onboarding
- Intervention system (breathing → reflection)
- Quick Task
- Activity planning (solo only)
- Insights (basic stats)
- Settings

**Backend:** Minimal (user auth, session storage)

**Testing:** Single account, single device

### Phase 2: Social Features

**Scope:** Multi-user interactions

**Features:**
- Friends list
- Friend requests (manual add only)
- Private messaging
- Activity sharing (friends-only)
- Join requests
- Event group chat

**Backend:** Full social features

**Testing:** 2-3 real accounts, multi-device

### Phase 3: Community Features

**Scope:** Public activities and discovery

**Features:**
- Public events
- Discover feed
- Invite links (deep linking)
- Profile management
- Inbox (Messages + Updates)

**Backend:** Complete API

**Testing:** 10+ users, production-like environment

### Phase 4: Advanced Features

**Scope:** Premium features and optimizations

**Features:**
- AI suggestions (Gemini integration)
- Advanced insights
- Premium subscription
- Notifications (push)
- Background sync

**Backend:** AI integration, payment processing

**Testing:** Beta users, performance testing

---

## Questions for Product/Design

These questions arose during documentation and should be clarified before native implementation:

1. **Registration:**
   - Is email verification required?
   - What happens to local data after registration?
   - Can users log out and log back in?

2. **Friends:**
   - Can users search for friends by username?
   - Is there a friends limit?
   - Can users block other users?

3. **Activities:**
   - Can activities be recurring (weekly, monthly)?
   - Can users edit past activities?
   - Is there an activity history view?

4. **Messaging:**
   - Is there a message history limit?
   - Can users delete messages?
   - Can users delete entire conversations?

5. **Notifications:**
   - What notification preferences are available?
   - Can users mute specific friends or events?
   - What is the notification priority for each type?

6. **Privacy:**
   - What privacy settings are available?
   - Can users hide their profile from non-friends?
   - Can users control who sees their activities?

7. **Data:**
   - How long is data retained?
   - Can users export their data?
   - Can users delete their account?

---

## Document Version

**Version:** 1.0  
**Created:** December 22, 2025  
**Last Updated:** December 22, 2025  
**Maintained By:** Product/Engineering Team

---

## Related Documents

- `design/ux/states.md` - Complete state definitions
- `design/ux/flows.md` - User journey flows
- `design/principles/interaction-gravity.md` - Intervention design principles
- `design/principles/communication-model.md` - Inbox architecture
- `design/principles/social-feature-guardrails.md` - Social feature constraints
- `CLAUDE.md` - Technical architecture and implementation details

