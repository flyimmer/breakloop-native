# BreakLoop User Flows

## Overview

This document defines user journeys through the BreakLoop app by sequencing states defined in `states.md`. Each flow represents a complete user scenario from trigger to resolution.

**Source of Truth:** All state IDs and transitions reference `design/ux/states.md`

**Platform:** React Native (Expo) - Android + iOS  
**Navigation:** React Navigation v7 (Stack Navigator + Bottom Tabs)

---

## Flow 1: First-Time Onboarding

**Entry Point:** App first launch

**Prerequisites:** `hasOnboarded: false`

**Steps:**

1. **Initial State**
   - State: App first launch + `!hasOnboarded`
   - Action: App opens
   - Transition: → Onboarding screens

2. **Onboarding Step 0: Select Values**
   - State: `onboardingStep: 0`
   - Display: Grid of value cards (Career, Health, Love, Kids, Reading, Nature, Social)
   - User Action: Tap value cards to multi-select
   - State Update: `selectedValues: []` populates with selections
   - Validation: "Next" button disabled if `selectedValues.length === 0`
   - Action: Tap "Next" button
   - Transition: → `onboardingStep: 1`

3. **Onboarding Step 1: Select Monitored Apps**
   - State: `onboardingStep: 1`
   - Display: App selection screen with toggle switches
   - User Action: Toggle apps on/off, optionally add custom websites
   - State Update: `monitoredApps: []` + `customApps: []`
   - Action: Tap "Finish" button
   - Transition: → `hasOnboarded: true` + `activeTab: "insights"`

4. **Completion**
   - State: `hasOnboarded: true`
   - Display: Main BreakLoop app (`MainTabs` route, Insights tab by default)
   - User is now in main app interface

**Exit Points:**
- Normal completion: User in main app with values and monitored apps configured
- No early exit (onboarding must complete)

**Mobile Considerations:**
- Android: Back button during onboarding stays within onboarding flow
- iOS: No swipe-to-go-back gesture during onboarding
- Persists progress across app restarts

---

## Flow 2: Normal Day (No Intervention)

**Entry Point:** Regular app usage

**Prerequisites:** `hasOnboarded: true`, no monitored app launch

**Steps:**

1. **Main App View**
   - State: `MainTabs` route + `interventionState: "idle"`
   - Display: Main BreakLoop app with bottom tab navigation
   - Sub-states may include:
     - Quick task badge if `quickTaskActiveUntil > Date.now()`
     - Active session widget if `userSessionState.joined: true`
     - Notification banner if `simNotification !== null`

2. **Navigate Tabs**
   - User Action: Tap Insights/Community/Inbox/Settings tabs
   - State Update: `activeTab` changes (within `MainTabs` route)
   - Display updates accordingly

3. **App Switching (OS Level)**
   - User Action: Switch to another app via OS app switcher
   - State: App remains in background, state preserved
   - Note: No launcher screen in React Native

**Exit Points:**
- User remains in normal usage pattern
- No intervention triggered

**Mobile Considerations:**
- Standard OS navigation (home button, task switcher)
- App state persists when switching apps
- Notification banners respect OS notification behavior

---

## Flow 3: Monitored App → Quick Task

**Entry Point:** Launch monitored app with available quick task uses

**Prerequisites:**
- `hasOnboarded: true`
- App in `monitoredApps` list
- `quickTaskUsesInWindow < quickTaskUsesPerWindow`
- Within 15-minute rolling window

**Steps:**

1. **Main App View**
   - State: `MainTabs` route + `interventionState: "idle"`

2. **Trigger Monitored App Launch**
   - User Action: Monitored app launch detected (OS-level integration required)
   - Trigger: Quick task availability check
   - State Update: `pendingQuickTaskApp: appObject` + `showQuickTaskDialog: true`
   - Transition: → `QuickTaskDialogScreen` modal

3. **Quick Task Dialog**
   - State: `showQuickTaskDialog: true`
   - Display: Modal dialog with two options
     - "Quick Task" button (shows remaining uses)
     - "Go through conscious process" button
     - Close (X) button
   - **Decision Point:**

   **Path A: Accept Quick Task**
   - User Action: Tap "Quick Task" button
   - State Updates:
     - `quickTaskActiveUntil: Date.now() + duration` (3min free, customizable premium)
     - `activeQuickTaskApp: appObject`
     - `quickTaskUsesInWindow: +1`
     - `showQuickTaskDialog: false`
   - Transition: → Returns to monitored app (unlocked via session state)
   - Display: App content with countdown badge (OS-level integration)

   **Path B: Full Intervention**
   - User Action: Tap "Go through conscious process"
   - State Update: `showQuickTaskDialog: false`
   - Transition: → See Flow 4 (Full Intervention)

   **Path C: Cancel**
   - User Action: Tap X or outside dialog
   - State Update: `showQuickTaskDialog: false` + `pendingQuickTaskApp: null`
   - Transition: → `activeContext: "launcher"` (app doesn't launch)

4. **Using App (Path A continuation)**
   - State: `activeContext: "app-{id}"` + `quickTaskActiveUntil > Date.now()`
   - Display: App content + countdown badge
   - Timer counts down every second

5. **Quick Task Expiration**
   - Trigger: `quickTaskActiveUntil <= Date.now()`
   - **Decision Point:** Is user still in app?

   **If still in app:**
   - Transition: → Flow 4 (Full Intervention triggered)

   **If user left app:**
   - State Update: `activeQuickTaskApp: null`
   - Next monitored app launch triggers intervention

6. **Return to BreakLoop (Before Expiration)**
   - User Action: Switch back to BreakLoop app
   - State Update: Session state preserved
   - Transition: → `MainTabs` route

**Exit Points:**
- Quick task completed within time limit (user continues using monitored app)
- Quick task expires → triggers full intervention (navigates to intervention flow)
- Dialog cancelled → returns to `MainTabs`

**React Native Considerations:**
- Android: Back button behavior handled by React Navigation
- iOS: Swipe-back gesture handled by React Navigation
- Quick task badge requires OS-level integration (notification badge)
- Window resets automatically after 15 minutes
- Navigation: Quick task dialog is a modal screen in RootNavigator stack

---

## Flow 4: Monitored App → Full Intervention

**Entry Point:** Launch monitored app without quick task or after bypass

**Prerequisites:**
- `hasOnboarded: true`
- App in `monitoredApps` list
- No quick task available OR quick task declined OR quick task expired

**Steps:**

1. **Trigger Intervention**
   - User Action: Launch monitored app (OS-level integration)
   - Function Call: `beginIntervention(app)` via InterventionProvider
   - State Updates:
     - `targetApp: appObject`
     - `interventionState: "breathing"`
     - `breathingCount: settings.interventionDuration` (default: 5)
   - Navigation: `InterventionNavigationHandler` detects state change → navigates to `BreathingScreen`
   - Transition: → `BreathingScreen` modal

2. **Breathing Countdown**
   - State: `interventionState: "breathing"`
   - Display: Large countdown number with pulsing animation
   - Timer: Counts down every second
   - User Action Options:
     - Wait for countdown completion
     - Tap X to cancel
   - **Decision Point:**

   **Path A: Complete Breathing**
   - Trigger: `breathingCount === 0`
   - Transition: → `interventionState: "root-cause"`

   **Path B: Cancel**
   - User Action: Tap X button or back gesture
   - State Update: `interventionState: "idle"` + `targetApp: null`
   - Navigation: `InterventionNavigationHandler` detects state change → navigates back to `MainTabs`
   - Transition: → `MainTabs` (intervention cancelled)

3. **Root Cause Selection (Path A continuation)**
   - State: `interventionState: "root-cause"`
   - Display: Grid of cause cards (Boredom, Anxiety, Fatigue, Loneliness, Self-doubt, No goal)
   - User Action: Tap cause cards to multi-select
   - State Update: `selectedCauses: []` populates
   - Validation: "See Alternatives" button disabled if `selectedCauses.length === 0`
   - **Decision Point:**

   **Path A1: See Alternatives**
   - User Action: Tap "See Alternatives" button
   - Requirement: `selectedCauses.length > 0`
   - Transition: → `interventionState: "alternatives"` + `altTab: "mylist"`

   **Path A2: Bypass (Need to Use App)**
   - User Action: Tap "I really need to use it" button
   - Transition: → `interventionState: "timer"`

   **Path A3: Cancel**
   - User Action: Tap X button or back gesture
   - State Reset: `interventionState: "idle"` + `selectedCauses: []` + `targetApp: null`
   - Navigation: Returns to `MainTabs`
   - Transition: → `MainTabs`

4. **Timer Unlock (Path A2 continuation)**
   - State: `interventionState: "timer"`
   - Navigation: `IntentionTimerScreen` modal
   - Display: Clock icon + time option grid (5m, 15m, 30m, 45m, 60m + 1m small button)
   - User Action: Tap time duration
   - State Updates:
     - `activeSessions[app.name]: { expiry: Date.now() + selectedMinutes }`
     - `interventionState: "idle"`
   - Navigation: Returns to `MainTabs`
   - Transition: → `MainTabs` (app unlocked via session state)

5. **Browse Alternatives (Path A1 continuation)**
   - State: `interventionState: "alternatives"`
   - Display: Three tabs with scrollable activity lists
   - Tabs:
     - **My List** (`altTab: "mylist"`): Saved alternatives filtered by causes
     - **Discover** (`altTab: "discover"`): Community alternatives
     - **AI For You** (`altTab: "ai"`): AI-generated suggestions

6. **AI Tab First Open (Optional)**
   - User Action: Tap "AI For You" tab
   - State Update: `altTab: "ai"` + `isGeneratingAI: true`
   - Function Call: `handleGenerateContextualAlternatives()`
   - Display: Loading indicator
   - Completion: `aiSuggestions: []` populates + `isGeneratingAI: false`
   - Edge Case: Shows warning if `GEMINI_API_KEY` missing

7. **Select Alternative**
   - User Action: Tap activity card from any tab
   - State Update: `selectedAlternative: activityObject`
   - Transition: → `interventionState: "action"`

8. **Action Confirmation**
   - State: `interventionState: "action"`
   - Display: Large checkmark, activity title, action steps list
   - **Decision Point:**

   **Path B1: Start Activity**
   - User Action: Tap "Start Activity" button
   - State Update: `actionTimer: activity.duration * 60` (seconds)
   - Transition: → `interventionState: "action_timer"`

   **Path B2: Plan for Later**
   - User Action: Tap "Plan for later" button
   - State Update: `showAltScheduler: true` + `altPlanDraft: selectedAlternative`
   - Transition: → Opens `AltSchedulerModal` (see Flow 9)

   **Path B3: Back to Alternatives**
   - User Action: Tap X or back button
   - State Update: `selectedAlternative: null`
   - Transition: → `interventionState: "alternatives"`

9. **Activity Timer (Path B1 continuation)**
   - State: `interventionState: "action_timer"`
   - Display: Large circular countdown timer + activity steps below
   - Timer: Counts down every second, can reach 0 and stay at 00:00
   - Button Text:
     - If `actionTimer > 0`: "Finish Early"
     - If `actionTimer === 0`: "Complete & Reflect"

10. **Complete Activity**
    - User Action: Tap "Complete & Reflect" button (any time)
    - Transition: → `interventionState: "reflection"`

11. **Reflection**
    - State: `interventionState: "reflection"`
    - Navigation: `ReflectionScreen` modal
    - Display: Welcome message + three emoji buttons + skip option
    - User Action: Select mood (😊 positive / 😐 neutral / 😫 negative / Skip)
    - Function Call: `finishReflection(moodValue)` via dispatchIntervention
    - State Updates:
      - Saves to `sessionHistory`
      - `interventionState: "idle"`
      - Clears intervention variables
    - Navigation: `InterventionNavigationHandler` detects state change → navigates back to `MainTabs`
    - Transition: → `MainTabs`

**Exit Points:**
- Reflection completed → `MainTabs` with intervention cleared
- Timer unlock → `MainTabs` (app unlocked for session duration)
- Cancel at any stage → `MainTabs` (intervention cancelled)

**React Native Considerations:**
- Intervention screens are modal-style (presentation: 'modal' in RootNavigator)
- Back gesture/button behavior (React Navigation):
  - Breathing/Root-cause: Cancels intervention (navigates to MainTabs)
  - Alternatives: Can navigate back (navigates to previous screen or MainTabs)
  - Action: Returns to alternatives (navigates back to AlternativesScreen)
  - Action Timer: Custom back behavior (may remain in timer)
  - Reflection: Custom back behavior (may require completion)
- Timer continues in background if user switches apps
- Navigation state managed by React Navigation stack
- State-driven navigation: `InterventionNavigationHandler` watches intervention state and navigates accordingly

---

## Flow 5: Alternative Activity → Reflection (Standalone)

**Entry Point:** User opens BreakLoop and starts activity without intervention trigger

**Prerequisites:** `hasOnboarded: true`, user in BreakLoop app

**Steps:**

1. **In BreakLoop App**
   - State: `activeContext: "app-mindful"` + `activeTab: "community"`
   - User Action: Navigate to Community → My Upcoming

2. **View Activity**
   - State: `communityMenu: "my-upcoming"`
   - Display: Horizontal scrollable list of activity cards
   - User Action: Tap activity card
   - State Update: `selectedActivity: activityObject`
   - Transition: → Opens `ActivityDetailsModal`

3. **Activity Details Modal**
   - State: `selectedActivity !== null`
   - Display: Full-screen modal with activity details
   - User Action: Tap "Start activity" button (if available)
   - Transition: → Starts activity session (implementation specific)

4. **Activity In Progress**
   - Display: Timer interface (similar to action_timer)
   - Timer counts down activity duration
   - User can complete early or wait for completion

5. **Complete Activity**
   - User Action: Tap "Complete & Reflect" button
   - Transition: → `interventionState: "reflection"`

6. **Reflection**
   - State: `interventionState: "reflection"`
   - Display: Mood selection interface
   - User Action: Select mood (😊 / 😐 / 😫 / Skip)
   - Function Call: `finishReflection(moodValue)`
   - State Updates:
     - Saves to `sessionHistory`
     - `interventionState: "idle"`
     - `selectedActivity: null`
   - Transition: → `activeContext: "app-mindful"` (returns to community tab)

**Exit Points:**
- Reflection completed → back to BreakLoop app
- User can close modal before starting → returns to community tab

**Mobile Considerations:**
- Activity continues if user switches apps (timer keeps running)
- Notification reminder when activity timer completes (optional)
- Back button from reflection completes reflection with neutral mood

---

## Flow 6: Timer-Based App Unlock

**Entry Point:** User selects time duration from intervention flow

**Prerequisites:** In intervention flow at timer screen (`interventionState: "timer"`)

**Steps:**

1. **Timer Selection Screen**
   - State: `interventionState: "timer"`
   - Entry: From root-cause "I really need to use it" button
   - Display: Time options grid (5m, 15m, 30m, 45m, 60m, 1m)

2. **Select Duration**
   - User Action: Tap time button (e.g., "15m")
   - State Updates:
     - `activeSessions[targetApp.name]: { expiry: Date.now() + 15*60*1000 }`
     - `interventionState: "idle"`
     - `targetApp: null`
   - Transition: → `activeContext: "app-{id}"` (app unlocked)

3. **Using App with Timer**
   - State: `activeContext: "app-{id}"` + `activeSessions[app.name]` exists
   - Display: App content + countdown badge in status bar
   - Timer: Decrements every second
   - Visual Update: Badge shows remaining time

4. **User Continues Using App**
   - Timer counts down while user uses app
   - User can switch to other apps, timer continues

5. **Return to App Before Expiry**
   - User Action: Return to launcher, then reopen app
   - State Check: `activeSessions[app.name].expiry > Date.now()`
   - Result: App opens directly (no intervention)
   - Timer badge continues displaying

6. **Session Expires**
   - Trigger: `activeSessions[app.name].expiry <= Date.now()`
   - **Decision Point:** Is user still in app?

   **Path A: User still in app**
   - Trigger: Session expiry detected
   - Function Call: `beginInterventionForApp(app)`
   - Transition: → Flow 4 (Full Intervention)
   - Display: Intervention overlay appears over app

   **Path B: User not in app**
   - State Update: `activeSessions[app.name]: null`
   - Result: Next app launch triggers intervention check

7. **Leave App Before Expiry (Monitored Apps)**
   - User Action: Tap home/back button
   - State Update: `activeSessions[app.name]: null` (session cleared)
   - Transition: → `activeContext: "launcher"`
   - Result: Next launch requires new intervention or quick task

**Exit Points:**
- Session expires → intervention triggered
- User leaves app → session cleared (monitored apps only)
- Session completes → launcher

**Mobile Considerations:**
- Android: Back button clears session for monitored apps
- iOS: Home gesture clears session for monitored apps
- Timer badge visible in notification area (if OS supports)
- Session survives app switching (timer continues)
- Non-monitored apps retain session after leaving

---

## Flow 7: Proactive Prompt Flow

**Entry Point:** Scheduled prompt or notification trigger

**Prerequisites:** `hasOnboarded: true`, specific time/context conditions met

**Prompt Types:**
- Social planning (weekend approaching)
- Sleep hygiene (late night)
- Late night activity filtering notice

**Steps:**

1. **Launcher with Proactive Prompt**
   - State: `activeContext: "launcher"` + `proactiveState !== null`
   - Trigger: Scheduled time condition or notification click
   - Display: Notification-style banner over launcher
   - Content: Contextual message based on prompt type

2. **User Interaction Options**
   - **Option A: Tap Prompt**
     - State Update: `proactiveState: null`
     - Transition: → `activeContext: "app-mindful"` (opens BreakLoop)
     - Optional: Navigate to relevant tab (e.g., Community for social planning)

   - **Option B: Dismiss**
     - User Action: Tap dismiss/close button or swipe away
     - State Update: `proactiveState: null`
     - Transition: → Remains on `activeContext: "launcher"`

   - **Option C: Timeout**
     - Trigger: No interaction after timeout period (e.g., 30 seconds)
     - State Update: `proactiveState: null`
     - Transition: → Banner fades away

**Example Flow: Social Planning Prompt**

3. **Weekend Social Planning**
   - Prompt Message: "Weekend approaching! Plan social activities with friends?"
   - User Action: Tap prompt
   - Transition: → `activeContext: "app-mindful"` + `activeTab: "community"` + `communityMenu: "plan"`

4. **Plan Activity Modal Opens**
   - State Update: `showPlanModal: true`
   - Display: Plan Activity modal (see Flow 8)
   - User can create group activity

**Example Flow: Sleep Hygiene Prompt**

3. **Late Night Reminder**
   - Time: After 11 PM
   - Prompt Message: "It's late! Consider winding down for better sleep."
   - User Action: Tap prompt
   - Transition: → `activeContext: "app-mindful"` + `activeTab: "insights"`
   - Display: Sleep insights or evening-appropriate activities

4. **Late Night Activity Filtering**
   - Context: Night mode activated
   - Alternative filtering: Excludes high-energy activities
   - Shows: Calm, rest-focused alternatives

**Exit Points:**
- Prompt dismissed → launcher (no state change)
- Prompt acted upon → BreakLoop app opened with relevant context
- Timeout → prompt disappears

**Mobile Considerations:**
- Android: Appears as persistent notification + in-app banner
- iOS: Appears as notification + in-app banner
- Swipe gestures for dismiss (mobile-native)
- Prompts respect Do Not Disturb settings
- Prompts can stack (multiple triggers shown sequentially)

---

## Flow 8: Community Activity Join Flow

**Entry Point:** User discovers activity and wants to join

**Prerequisites:** `hasOnboarded: true`, activity exists in discover feed

**Activity Types:**
- Friend-hosted activity (ask-to-join required)
- Public event (instant join or ask-to-join based on settings)

**Steps:**

1. **Browse Discover Feed**
   - State: `activeContext: "app-mindful"` + `activeTab: "community"` + `communityMenu: "discover"`
   - Display: Horizontal scrollable lists
     - Friends' current activities
     - Public events
   - Activities sourced from:
     - `friendSharedActivities: []`
     - `publicEvents: []`

2. **Select Activity**
   - User Action: Tap activity card
   - State Update: `selectedActivity: activityObject`
   - Transition: → Opens `ActivityDetailsModal`

3. **Activity Details Modal**
   - State: `selectedActivity !== null`
   - Display: Full-screen modal with:
     - Activity title, description, time, location
     - Host information
     - Status badges (if already joined)
     - Participant list (if visible)
   
4. **Check Join Status**
   - Function: `findUpcomingActivity()` checks `upcomingActivities` array
   - Result: `userHasJoined: boolean` + `activityStatus: "pending" | "confirmed"`
   
5. **Button Display Logic**
   - **If `isHost === true`** (user is host):
     - Buttons: "Edit activity" + "Cancel event"
     - Status Badge: "Host"
   
   - **If `userHasJoined === true` + `activityStatus === "pending"`**:
     - Button: "Cancel request"
     - Status Badge: "PENDING"
   
   - **If `userHasJoined === true` + `activityStatus === "confirmed"`**:
     - Button: "Quit event"
     - Status Badge: "CONFIRMED"
   
   - **If `userHasJoined === false`**:
     - Button: "Join the event"
     - Status Badge: None

**Path A: Request to Join (Ask-to-Join Flow)**

6. **Request to Join**
   - User Action: Tap "Join the event" button
   - Function Call: `createJoinRequestState()` in mockApi
   - State Updates:
     - Adds to `pendingRequests` (user's outgoing requests)
     - Adds to host's `incomingRequests`
     - Adds to `upcomingActivities` with `status: "pending"`
   - Display: Toast notification "Join request sent"
   - Button Changes: → "Cancel request"
   - Badge Appears: "PENDING"

7. **Wait for Host Response**
   - State: Activity in `upcomingActivities` with `status: "pending"`
   - User sees "PENDING" badge on activity card everywhere:
     - My Upcoming section
     - Discover section (same activity)

8. **Host Accepts Request**
   - Host Action: In their activity details modal, tap "Accept" on join request
   - Function Call: `acceptJoinRequestState()` in mockApi
   - State Updates:
     - Removes from `incomingRequests`
     - Updates `upcomingActivities` entry: `status: "confirmed"`
     - Activity added to user's confirmed list
   - Notification: User receives "Request accepted" notification

9. **User Views Accepted Activity**
   - State Check: `activityStatus === "confirmed"`
   - Display Changes:
     - Button: "Quit event"
     - Badge: "CONFIRMED" (everywhere)
   - Activity appears in My Upcoming with confirmed status

**Path B: Instant Join (Auto-join Enabled)**

6. **Instant Join**
   - Prerequisite: Activity has `allowAutoJoin: true`
   - User Action: Tap "Join the event" button
   - State Updates:
     - Adds to `upcomingActivities` with `status: "confirmed"` (immediate)
     - No `pendingRequests` entry
   - Display: Toast notification "Joined activity"
   - Button Changes: → "Quit event"
   - Badge Appears: "CONFIRMED"

**Path C: Cancel Request**

6. **Cancel Pending Request**
   - User Action: Tap "Cancel request" button
   - Function Call: `declineJoinRequestState()` in mockApi
   - State Updates:
     - Removes from `pendingRequests`
     - Removes from host's `incomingRequests`
     - Removes from `upcomingActivities`
   - Display: Toast notification "Request cancelled"
   - Button Changes: → "Join the event"
   - Badge Disappears: No badge shown

**Path D: Quit Confirmed Event**

6. **Quit Event**
   - User Action: Tap "Quit event" button
   - State Updates:
     - Removes from `upcomingActivities`
     - User removed from activity's participants list
   - Display: Toast notification "Left activity"
   - Button Changes: → "Join the event"
   - Badge Disappears: No badge shown (user no longer joined)

10. **View in My Upcoming**
    - User Action: Navigate to Community → My Upcoming
    - State: `communityMenu: "my-upcoming"`
    - Display: Activity cards with status badges
    - Consistency: Same badge as in Discover feed (PENDING or CONFIRMED)

**Exit Points:**
- Join request sent → activity in "My Upcoming" with PENDING badge
- Join request accepted → activity confirmed in "My Upcoming"
- Join request cancelled → activity removed from "My Upcoming"
- Quit event → activity removed from "My Upcoming"
- Modal closed → returns to previous view

**Mobile Considerations:**
- Android: Back button closes modal
- iOS: Swipe-down gesture closes modal
- Status updates reflect immediately across all views
- Toast notifications for all join/quit actions
- Pull-to-refresh to update activity lists

---

## Flow 9: Active Session Override Flow

**Entry Point:** User joins live focus session with friends

**Prerequisites:**
- `hasOnboarded: true`
- User has accepted or created session invitation
- Session started by host

**Steps:**

1. **Session Join**
   - Trigger: User accepts session invite or session starts
   - State Updates:
     - `userSessionState: { joined: true, sessionId, status: "focused", isFinished: false, allowedApps: [] }`
   - Transition: → Session override activates

2. **Session Override Display**
   - State: `userSessionState.joined === true`
   - Override: Takes precedence over all other BreakLoop views
   - Display: Dark background with:
     - Session info (duration, focus goal)
     - Participant list with status indicators
     - "Leave session" button
     - Quick task badge (if active)

3. **Using Allowed Apps**
   - User Action: Switch to allowed app (e.g., Spotify, Notes)
   - State Update: `userSessionState.status: "focused"`
   - Display (in session view): Status indicator shows "Focused"
   - Participant list: User shown as focused

4. **Return to BreakLoop During Session**
   - User Action: Open BreakLoop app
   - State Check: `userSessionState.joined === true`
   - Display: Session override view (not normal BreakLoop interface)
   - Status: Remains "focused"

5. **Using Non-Allowed Apps**
   - User Action: Switch to non-allowed app (e.g., Instagram, TikTok)
   - State Update: `userSessionState.status: "distracted"`
   - Display (in session view): Status indicator shows "Distracted"
   - Participant list: User shown as distracted
   - Optional: Gentle notification reminder about session

6. **Return to Allowed App**
   - User Action: Switch back to allowed app or BreakLoop
   - State Update: `userSessionState.status: "focused"`
   - Display: Status indicator returns to "Focused"

7. **Initiate Leave Session**
   - User Action: Tap "Leave session" button (from session override view)
   - State Updates:
     - `leavingSession: true`
     - `leaveCountdown: 5` (seconds)
   - Display: Countdown timer (5, 4, 3, 2, 1)
   - User Action Options:
     - Wait for countdown to complete
     - Tap "Cancel" to stay in session

8. **Cancel Leave**
   - User Action: Tap "Cancel" during countdown
   - State Updates:
     - `leavingSession: false`
     - `leaveCountdown: 0`
   - Display: Returns to normal session view

9. **Complete Leave**
   - Trigger: `leaveCountdown === 0`
   - State Updates:
     - `userSessionState: null`
     - Session data cleared
   - Transition: → `activeContext: "app-mindful"` (normal BreakLoop interface)
   - Display: Returns to last active tab (likely Community)

10. **Session Ends (Host Ends or Time Expires)**
    - Trigger: Session expiry or host ends session
    - State Updates:
      - `userSessionState.isFinished: true`
      - Then: `userSessionState: null`
    - Display: Session summary (optional)
    - Transition: → `activeContext: "app-mindful"`

**Edge Cases:**

**Quick Task During Session**
- State: `quickTaskActiveUntil > Date.now()` + `userSessionState.joined === true`
- Display: Quick task badge shown in session view
- Behavior: Quick task countdown continues, but session status tracking remains active

**Intervention During Session**
- Scenario: User tries to open monitored, non-allowed app
- Result: Intervention may trigger (depends on implementation)
- Alternative: Session reminder notification instead of full intervention

**App Switching During Session**
- State updates: Status changes "focused" ↔ "distracted" based on current app
- Session view: Always accessible by opening BreakLoop
- Participant updates: Real-time status visible to all participants

**Exit Points:**
- Leave session (5s countdown) → returns to BreakLoop
- Session ends → returns to BreakLoop
- Session cancelled by host → returns to BreakLoop

**Mobile Considerations:**
- Android: Back button from session view doesn't leave session (stays in view)
- iOS: Home gesture minimizes app but doesn't leave session
- Notification: Persistent notification shows session status while in other apps
- Lock screen: Shows session timer on lock screen (if supported)
- Battery: Session tracking runs in background (optimize for battery)

---

## Flow 10: Plan Activity with AI Suggestions

**Entry Point:** User wants to plan activity with AI assistance

**Prerequisites:**
- `hasOnboarded: true`
- In BreakLoop Community tab
- Optional: `REACT_APP_GEMINI_KEY` set for AI features

**Steps:**

1. **Navigate to Plan**
   - State: `activeContext: "app-mindful"` + `activeTab: "community"` + `communityMenu: "plan"`
   - Display: Plan section with "Plan activity" button

2. **Open Plan Activity Modal**
   - User Action: Tap "Plan activity" button
   - State Update: `showPlanModal: true`
   - Transition: → Opens `PlanActivityModal`
   - Display: Mode selection (Solo / Group)

3. **Select Solo Mode**
   - User Action: Tap "Solo" option
   - State Update: `mode: "solo"`
   - Display: Sub-mode selection (AI Suggestion / Manual)

4. **Select AI Suggestion**
   - User Action: Tap "AI suggestion" option
   - State Update: `soloMode: "ai"`
   - Display: Form with inputs:
     - Topic/Interest (optional)
     - Location (optional)
     - Time preference: Morning/Afternoon/Evening (optional)
     - Date (defaults to today)
     - Participants description (optional)

5. **Fill Form (Optional)**
   - User Actions: Fill any/all fields
   - Examples:
     - Topic: "watch a movie in a theater"
     - Location: "Munich downtown"
     - Time: "Evening"
     - Participants: "me with my girlfriend"

6. **Generate Suggestions**
   - User Action: Tap "Generate suggestions" button
   - State Update: `isLoading: true`
   - Function Call: `generateActivitySuggestions()`
   - API Call: Gemini API with context
   - Input Priority (as per AI prompt):
     1. Topic/Interest (PRIMARY)
     2. Location
     3. Time of day
     4. Participants description
     5. Date
   - Display: Loading indicator

7. **View AI Suggestions**
   - State Updates:
     - `suggestions: [activity1, activity2, activity3]`
     - `isLoading: false`
   - Display: 3 activity suggestion cards with:
     - Title (specific, e.g., "Watch 'Past Lives' at Cinema München")
     - Description (detailed with venue names, movie titles, etc.)
     - Duration (e.g., "120-150m")
     - Time (suggested start time, e.g., "19:00")
   - Each card has 3 action buttons:
     - Accept
     - Edit
     - Save

**Decision Point: User Chooses Action**

**Path A: Accept Suggestion**

8. **Accept Suggestion (Path A)**
   - User Action: Tap "Accept" button on suggestion card
   - State Updates:
     - Adds to `upcomingActivities` with `status: "confirmed"`
     - `showPlanModal: false`
   - Display: Toast notification "Activity planned"
   - Transition: → Modal closes → Community tab

9. **View in My Upcoming**
   - User Action: Navigate to Community → My Upcoming
   - Display: New activity card appears with confirmed status

**Path B: Edit Suggestion**

8. **Edit Suggestion (Path B)**
   - User Action: Tap "Edit" button on suggestion card
   - State Updates:
     - `soloMode: "manual"`
     - `cameFromSuggestions: true` (enables back navigation)
     - Pre-fills manual form with suggestion data:
       - Title: From suggestion
       - Description: From suggestion
       - Date: From form input
       - Time: From suggestion
       - End time: Calculated from duration
       - Location: From suggestion
     - `suggestions` preserved (NOT cleared)
   - Display: Manual form with pre-filled values
   - UI: "← Back to suggestions" button appears at top of form

9. **Navigate Back to Suggestions (Optional)**
   - User Action: Tap "← Back to suggestions" button OR tap close button (X)
   - State Updates:
     - `soloMode: "ai"`
     - `cameFromSuggestions: false`
     - Clears manual form
   - Display: Returns to AI suggestions view with 3 suggestion cards
   - Note: User can continue editing other suggestions or close modal

10. **Modify and Save**
   - User Action: Edit fields, then tap "Save to My upcoming" button
   - Validation: Requires title, date, time
   - State Updates:
     - Adds to `upcomingActivities` with `status: "confirmed"`
     - `showPlanModal: false`
     - `cameFromSuggestions: false`
   - Display: Toast notification "Activity planned"
   - Transition: → Modal closes

**Path C: Save Suggestion (Future Use)**

8. **Save Suggestion (Path C)**
   - User Action: Tap "Save" button on suggestion card
   - State Update: Adds to saved activities list (implementation-specific)
   - Display: Toast notification "Activity saved"
   - Result: Modal remains open with suggestions

**Path D: Back to Form**

8. **Back to Form (Path D)**
   - User Action: Tap "Back to form" button (below suggestions)
   - State Updates:
     - `suggestions: []` (clears suggestions)
   - Display: Returns to empty form
   - User can modify inputs and regenerate

**Error Handling:**

8. **API Error / No API Key**
   - Trigger: `REACT_APP_GEMINI_KEY` missing or API fails
   - State Update: `error: "Error message"`
   - Display: Error message + fallback suggestions
   - Fallback: `getFallbackSuggestions()` provides 3 generic activities

**Exit Points:**
- Activity accepted → added to My Upcoming
- Activity saved after editing → added to My Upcoming
- Modal closed from AI suggestions → returns to Community tab (no activity saved)
- Modal closed from Manual edit (with suggestions) → returns to AI suggestions view
- Modal closed from Manual edit (without suggestions) → returns to Community tab
- Back to form → clears suggestions, stays in modal
- Back to suggestions → returns to AI suggestions view, preserves suggestions

**Mobile Considerations:**
- Form inputs use mobile-native keyboards (text, date pickers, time pickers)
- Suggestion cards scrollable horizontally on small screens
- Loading state prevents multiple API calls
- Form state resets on modal close (except `soloMode` and suggestions when navigating back)
- Modal scrolling: Backdrop is scrollable, close button (X) always accessible at top
- Modal height: Limited to 90vh, content scrolls independently
- Android: Back button closes modal or returns to suggestions (context-aware)
- iOS: Swipe-down gesture closes modal or returns to suggestions (context-aware)

---

## Flow 10.1: Plan Activity with Unified Form (December 2024 Update)

**Entry Point:** User wants to plan activity (private or public)

**Prerequisites:**
- `hasOnboarded: true`
- In BreakLoop Community tab

**Architecture Change:** 
The Plan Activity Modal now uses a **Unified Form UX** where visibility (Private/Friends/Public) is a dropdown field instead of separate top-level tabs. This allows seamless conversion between private and public activities.

**Steps:**

1. **Open Plan Activity Modal**
   - User Action: Tap "Plan activity" button
   - State Update: `showPlanModal: true`
   - Display: Modal with mode toggle at top:
     - **✨ AI Suggestion** (default)
     - **📝 Manual Entry**

**Path A: AI Suggestion → Manual Entry**

2. **AI Suggestion Mode**
   - State: `mode: "ai"`
   - Display: Form inputs (Topic, Location, Time Preference, Date, Participants)
   - User Action: Fill form and tap "Generate suggestions"
   - Result: 3 AI-generated activity cards

3. **Edit AI Suggestion**
   - User Action: Tap "Edit" on any suggestion card
   - State Updates:
     - `mode: "manual"` (switches to Manual Entry)
     - `formData` populated with suggestion data
     - `suggestions` preserved for back navigation
   - Display: Unified manual form with pre-filled data

4. **Unified Manual Form**
   - Display: Single-column form with fields in order:
     1. **Title** (required)
     2. **Visibility Dropdown** (🔒 Private / 👥 Friends / 🌐 Public)
     3. **Date & Time Row** (Date | Start Time | End Time)
     4. **Location** (with GPS button)
     5. **Description** (textarea)
     6. **Steps** (only shown if visibility = "private")
     7. **Capacity Section** (only shown if visibility ≠ "private"):
        - Max Participants (number input)
        - Allow Immediate Join (checkbox)

5. **Change Visibility**
   - User Action: Select "Friends" or "Public" from Visibility dropdown
   - State Update: `formData.visibility: "friends" | "public"`
   - Display Changes:
     - "Steps" field hides
     - "Max Participants" field appears
     - "Allow Immediate Join" checkbox appears
   - Note: This is the key benefit - users can convert AI suggestions from private to public seamlessly

6. **Save Activity**
   - User Action: Tap "Create & publish" button (or "Save to My upcoming" if private)
   - Validation: Requires title, date, time
   - Logic:
     - If `visibility === "private"`: Calls `onCreateSolo()`
     - If `visibility === "friends" | "public"`: Calls `onCreateGroup()`
   - State Updates:
     - Adds to `upcomingActivities`
     - If public/friends: Also adds to `friendSharedActivities` or `publicEvents`
     - `showPlanModal: false`
   - Display: Toast notification + modal closes

**Path B: Direct Manual Entry**

2. **Manual Entry Mode**
   - User Action: Tap "📝 Manual Entry" toggle
   - State: `mode: "manual"`
   - Display: Same unified manual form (fields 1-7 above)

3. **Fill Form**
   - User Actions: Fill required fields (title, date, time)
   - Optional: Change visibility, add location, description, etc.

4. **Save Activity**
   - Same as step 6 above

**Path C: Back Navigation**

2. **From Manual to AI Suggestions**
   - Condition: User came from AI suggestions (`suggestions.length > 0`)
   - Display: "← Back to suggestions" button at top of manual form
   - User Action: Tap back button
   - State Updates:
     - `mode: "ai"`
     - Clears `formData`
     - Preserves `suggestions`
   - Display: Returns to AI suggestions view

**Benefits of Unified Form:**

1. **Flexible Workflow:**
   - Use AI to find a jogging route → keep it Private
   - Use AI to find a restaurant → change to Public
   - Same form for all scenarios

2. **Reduced Complexity:**
   - No separate Private/Public tabs
   - Visibility is just another field
   - Conditional fields only appear when relevant

3. **Seamless Conversion:**
   - Can convert any activity from private to public
   - Can adjust capacity settings dynamically
   - No mode switching required

**State Management:**

```javascript
// Unified state object
formData: {
  title: string,
  description: string,
  date: string,        // ISO format
  time: string,        // HH:MM
  endTime: string,     // HH:MM
  location: string,
  visibility: "private" | "friends" | "public",  // Key field
  maxParticipants: number,  // Only used if visibility ≠ "private"
  allowAutoJoin: boolean,   // Only used if visibility ≠ "private"
  steps: string,            // Only used if visibility === "private"
}
```

**Exit Points:**
- Activity saved → added to appropriate lists based on visibility
- Modal closed → returns to Community tab
- Back to suggestions → returns to AI view

**Mobile Considerations:**
- Visibility dropdown uses native select on mobile
- Conditional fields smoothly appear/disappear
- Form scrolls independently within modal
- GPS button for location uses device geolocation API

---

## Flow 11: Alt Scheduler Modal (Plan for Later)

**Entry Point:** User wants to schedule alternative for future

**Prerequisites:** In intervention flow at action screen (`interventionState: "action"`)

**Steps:**

1. **Action Confirmation Screen**
   - State: `interventionState: "action"` + `selectedAlternative !== null`
   - Display: Alternative details with action buttons

2. **Plan for Later**
   - User Action: Tap "Plan for later" button
   - State Updates:
     - `showAltScheduler: true`
     - `altPlanDraft: selectedAlternative`
   - Transition: → Opens `AltSchedulerModal`

3. **Alt Scheduler Modal**
   - State: `showAltScheduler: true`
   - Display: Form pre-filled with alternative data:
     - Title: From alternative
     - Description: From alternative
     - Steps: From alternative
     - Duration: From alternative
     - Date: Default to today
     - Time: Empty (user must select)
     - Location: Empty (optional)

4. **Set Schedule**
   - User Action: Fill date and time fields
   - Validation: Requires date and time

5. **Save to Plan**
   - User Action: Tap "Save" button
   - State Updates:
     - Adds to daily plan (implementation-specific)
     - Or adds to `upcomingActivities` as solo activity
     - `showAltScheduler: false`
     - `altPlanDraft: null`
   - Display: Toast notification "Scheduled for [date] at [time]"
   - Transition: → Modal closes → Returns to action screen

6. **Return to Intervention**
   - State: Back to `interventionState: "action"`
   - User can now:
     - Start activity immediately
     - Close intervention (X button)

**Alternative Entry Point: From Community Tab**

1. **Community Tab**
   - State: `activeContext: "app-mindful"` + `activeTab: "community"`
   - User can also open Alt Scheduler directly from Community tab (implementation-specific)

**Exit Points:**
- Activity scheduled → returns to intervention action screen
- Modal closed without saving → returns to action screen
- Scheduled activity appears in My Upcoming or daily plan

**Mobile Considerations:**
- Date picker: Native mobile date picker
- Time picker: Native mobile time picker
- Form validation prevents saving incomplete schedules
- Back button closes modal without saving

---

## Flow 12: Edit Existing Activity

**Entry Point:** User wants to modify planned activity

**Prerequisites:**
- `hasOnboarded: true`
- User is host of activity (`isHost: true`)
- Activity exists in `upcomingActivities`

**Steps:**

1. **View Activity in My Upcoming**
   - State: `activeContext: "app-mindful"` + `activeTab: "community"` + `communityMenu: "my-upcoming"`
   - Display: List of upcoming activities

2. **Open Activity Details**
   - User Action: Tap activity card
   - State Update: `selectedActivity: activityObject`
   - Transition: → Opens `ActivityDetailsModal`

3. **Activity Details Modal (Host View)**
   - State: `selectedActivity !== null` + `isHost: true`
   - Display: Activity details with host actions:
     - "Edit activity" button
     - "Cancel event" button
     - Status Badge: "Host"

4. **Edit Activity**
   - User Action: Tap "Edit activity" button
   - State Updates:
     - `showPlanModal: true`
     - `editActivity: selectedActivity` (passes to modal)
     - `isEditMode: true` (determined in modal)
   - Transition: → Opens `PlanActivityModal` in edit mode

5. **Plan Activity Modal (Edit Mode)**
   - State: `showPlanModal: true` + `isEditMode: true`
   - Display: Manual edit form only (no AI suggestion/manual toggle in edit mode)
   - Pre-filled Form:
     - Mode: Determined from activity data (solo/group)
     - Solo Mode: Automatically set to `"manual"` (no AI suggestions in edit mode)
     - Title: From `editActivity.title`
     - Description: From `editActivity.description`
     - Date: Parsed from `editActivity.dateLabel` via `parseFormattedDate()`
     - Start Time: Parsed from `editActivity.time` via `parseTimeRange()`
     - End Time: Parsed from `editActivity.time` via `parseTimeRange()`
     - Location: From `editActivity.location`
     - Steps: From `editActivity.steps` (if solo)
     - Visibility: From `editActivity.visibility` (if group)
   - Note: No "← Back to suggestions" button in edit mode (no suggestions to return to)

6. **Parse Time Fields**
   - Function: `parseTimeRange(editActivity.time)`
   - Examples:
     - "9:30 AM - 11:00 AM" → `{ start: "09:30", end: "11:00" }`
     - "19:30 - 21:00" → `{ start: "19:30", end: "21:00" }`
     - "9:30 AM" → `{ start: "09:30", end: "" }`
   - Uses `parseTimeString()` for AM/PM conversion

7. **Parse Date Field**
   - Function: `parseFormattedDate(editActivity.dateLabel)`
   - Examples:
     - "Mon, Nov 18" → "2024-11-18" (infers year)
     - "2024-11-18" → "2024-11-18" (ISO format preserved)
   - Handles year inference for dates in next year

8. **Modify Fields**
   - User Action: Edit any fields
   - Validation: Same as create mode (title, date, time required)

9. **Save Changes**
   - User Action: Tap "Save" or "Update" button
   - State Updates:
     - Updates activity in `upcomingActivities` array (matched by ID)
     - Updates in `friendSharedActivities` or `publicEvents` (if shared)
     - `showPlanModal: false`
     - `editActivity: null`
   - Display: Toast notification "Activity updated"
   - Transition: → Modal closes → Returns to `ActivityDetailsModal`

10. **View Updated Activity**
    - State: `selectedActivity` updated with new data
    - Display: Activity details modal shows updated information
    - User Action: Close modal
    - Transition: → Returns to Community tab

**Exit Points:**
- Activity updated → returns to activity details modal
- Modal closed without saving → returns to activity details (no changes)

**Mobile Considerations:**
- Date/time pickers pre-populated with existing values
- Form validation prevents incomplete saves
- All parsing functions handle various input formats
- Back button discards changes (with confirmation prompt)

---

## Flow 13: Host Manages Join Requests

**Entry Point:** User is host of activity with pending join requests

**Prerequisites:**
- `hasOnboarded: true`
- User is host of activity (`isHost: true`)
- Activity has pending join requests (`incomingRequests.length > 0`)

**Steps:**

1. **View Activity Details**
   - State: `selectedActivity !== null` + `isHost: true`
   - Display: Activity details modal with:
     - Host actions (Edit, Cancel)
     - Join requests section (if pending requests exist)

2. **View Join Requests**
   - Display: List of pending join requests
   - Each request shows:
     - User name
     - User avatar
     - Request timestamp (optional)
     - "Accept" button
     - "Decline" button

3. **Accept Join Request**
   - User Action: Tap "Accept" button on request
   - Function Call: `acceptJoinRequestState(activityId, requesterId)`
   - State Updates:
     - Removes from `incomingRequests`
     - Updates requester's `upcomingActivities` entry: `status: "confirmed"`
     - Adds requester to activity's participants list
   - Display: Toast notification "[User] accepted"
   - Request removed from list

4. **Requester View (After Acceptance)**
   - Requester's State: `upcomingActivities` entry updated to `status: "confirmed"`
   - Display Changes:
     - Badge: "PENDING" → "CONFIRMED"
     - Button: "Cancel request" → "Quit event"
   - Notification: "Request accepted" (optional)

5. **Decline Join Request**
   - User Action: Tap "Decline" button on request
   - Function Call: `declineJoinRequestState(activityId, requesterId)`
   - State Updates:
     - Removes from `incomingRequests`
     - Removes from requester's `pendingRequests`
     - Removes from requester's `upcomingActivities`
   - Display: Toast notification "[User] declined"
   - Request removed from list

6. **Requester View (After Decline)**
   - Requester's State: Activity removed from `upcomingActivities`
   - Display Changes:
     - Badge disappears
     - Button: "Cancel request" → "Join the event" (can request again)
   - Notification: "Request declined" (optional)

7. **Multiple Requests**
   - Host can accept/decline multiple requests sequentially
   - Each action updates immediately
   - List updates in real-time

8. **Close Modal**
   - User Action: Tap back or close button
   - State Update: `selectedActivity: null`
   - Transition: → Returns to Community tab

**Exit Points:**
- All requests handled → returns to activity details (empty request list)
- Modal closed → returns to Community tab

**Mobile Considerations:**
- Request list scrollable if many requests
- Tap targets large enough for easy acceptance/decline
- Toast notifications for each action
- Pull-to-refresh to update request list
- Optimistic UI updates (immediate feedback)

---

## Flow 14: Cancel Hosted Event

**Entry Point:** User wants to cancel their hosted activity

**Prerequisites:**
- `hasOnboarded: true`
- User is host of activity (`isHost: true`)

**Steps:**

1. **View Activity Details**
   - State: `selectedActivity !== null` + `isHost: true`
   - Display: Activity details with "Cancel event" button

2. **Cancel Event**
   - User Action: Tap "Cancel event" button
   - Display: Confirmation dialog (optional)
     - "Are you sure? All participants will be notified."
     - "Cancel Event" button (destructive style)
     - "Keep Event" button

3. **Confirm Cancellation**
   - User Action: Tap "Cancel Event" in confirmation dialog
   - State Updates:
     - Removes from host's `upcomingActivities`
     - Removes from `friendSharedActivities` (if shared with friends)
     - Removes from `publicEvents` (if public)
     - Removes from all participants' `upcomingActivities`
     - Clears all related join requests
   - Display: Toast notification "Event cancelled"
   - Transition: → Modal closes → Returns to Community tab

4. **Participant View (After Cancellation)**
   - Participants' State: Activity removed from `upcomingActivities`
   - Notification: "Activity cancelled by host" (optional)
   - Activity no longer appears in their My Upcoming section

5. **Discover Feed Update**
   - Activity removed from Discover feed for all users
   - No longer searchable or joinable

**Exit Points:**
- Event cancelled → modal closes, returns to Community tab
- Confirmation cancelled → stays in activity details modal

**Mobile Considerations:**
- Confirmation dialog prevents accidental cancellation
- Destructive action uses red/warning color
- Toast notification confirms action
- Pull-to-refresh shows updated activity list

---

## Flow 15: Inbox → Messages (Private Conversations)

**Entry Point:** User wants to view or send private messages

**Prerequisites:** `hasOnboarded: true`

**Steps:**

1. **Navigate to Inbox**
   - User Action: Tap Inbox tab from main navigation
   - State: `activeTab: "inbox"`
   - Default Sub-tab: Last used, or "updates" if first time
   - Badge: Shows combined count (unread messages + unresolved updates)

2. **Switch to Messages Sub-tab**
   - User Action: Tap "Messages" sub-tab
   - State Update: `inboxSubTab: "messages"`
   - Display: List of conversations ordered by most recent activity

3. **View Conversations List**
   - Display: Each conversation shows:
     - Friend name
     - Last message preview (1 line, truncated)
     - Timestamp (relative, e.g., "2h ago")
     - Unread indicator (dot or count) if conversation is unread
   - Empty State: "No messages yet"

4. **Receiving New Message (Background)**
   - Trigger: Friend sends private message
   - State Updates:
     - Message added to conversation
     - Conversation marked unread (if not currently open)
     - `unreadConversationCount` increments
     - Inbox badge increments
   - Optional: Push notification "Message from [Friend Name]"

5. **Open Conversation**
   - User Action: Tap conversation in list
   - State Update: `messagingBuddy: friendObject`
   - Transition: → Opens full chat interface
   - State Updates:
     - All messages in conversation marked as read
     - `unreadConversationCount` decrements
     - Inbox badge decrements
   - Display: Full message thread with input field

6. **Send Message**
   - User Action: Type message and tap send
   - State Updates:
     - Message added to conversation
     - Conversation timestamp updated
     - Conversation moves to top of list
   - Display: Message appears in thread

7. **Close Conversation**
   - User Action: Tap back button
   - State Update: `messagingBuddy: null`
   - Transition: → Returns to Messages list

**Alternative Entry Points:**
- Community → Friends → Tap friend → "Chat" button
- Community → Friends → Tap chat icon on friend card
- Friend Profile → "Chat with [Name]" button

**Exit Points:**
- Conversation closed → returns to Messages list
- Navigate to other tab → conversation state preserved

**Mobile Considerations:**
- Android: Back button closes conversation
- iOS: Swipe-back gesture closes conversation
- Messages persist across app restarts
- No read receipts sent to sender
- No typing indicators

**Privacy & Stability:**
- Unread state remains until user opens conversation
- No escalation or reminders
- Unread indicates STATE, not OBLIGATION

---

## Flow 16: Inbox → Updates (Event Notifications)

**Entry Point:** User wants to view event-related updates

**Prerequisites:** `hasOnboarded: true`

**Steps:**

1. **Navigate to Inbox**
   - User Action: Tap Inbox tab from main navigation
   - State: `activeTab: "inbox"`
   - Default Sub-tab: "updates" (if first time) or last used
   - Badge: Shows combined count (unread messages + unresolved updates)

2. **View Updates Sub-tab**
   - State: `inboxSubTab: "updates"` (default on first open)
   - Display: List of unresolved updates ordered by most recent first
   - Empty State: "All caught up!" with "No pending updates" subtext

3. **View Updates List**
   - Display: Each update shows:
     - Type-specific icon
     - Generated text based on type:
       - `event_chat`: "New message in [Event Title]"
       - `join_request`: "[User] wants to join [Event Title]"
       - `join_approved`: "Your request to join [Event Title] was accepted"
       - `join_declined`: "Your request to join [Event Title] was declined"
       - `event_updated`: "[Event Title] details updated"
       - `event_cancelled`: "[Event Title] was cancelled"
       - `participant_left`: "[User] left [Event Title]"
     - Optional message preview (for event_chat)
     - Timestamp (relative, e.g., "2m ago")
     - Chevron right indicator

4. **Receiving New Update (Background)**
   - Trigger: Event-related action occurs (see Phase E-2c emission points)
   - State Updates:
     - EventUpdate object created and stored
     - `unresolvedUpdates` array updated
     - `unresolvedCount` increments
     - Inbox badge increments
   - Optional: Push notification based on update type

5. **Tap Update Item**
   - User Action: Tap update in list
   - Function Call: `handleUpdateClick(update)`
   - Behavior varies by type:

**Path A: event_chat Update**

6. **Handle Event Chat Update**
   - Action: Opens Activity Details Modal → Chat tab
   - State Update: `selectedActivity: eventObject`
   - Transition: → ActivityDetailsModal with Chat tab active
   - Resolution: When Chat tab opens, calls `onChatOpened(eventId)`
   - Function Call: `resolveUpdatesByEventAndType(eventId, "event_chat")`
   - Result: All event_chat updates for this event marked resolved
   - State Updates:
     - Updates removed from `unresolvedUpdates`
     - `unresolvedCount` decrements
     - Inbox badge decrements

**Path B: join_request Update**

6. **Handle Join Request Update**
   - Action: Opens Activity Details Modal → Participants tab
   - State Update: `selectedActivity: eventObject`
   - Transition: → ActivityDetailsModal with Participants tab showing
   - Display: Pending join requests with Accept/Decline buttons
   - Resolution: When host accepts or declines request
   - Function Call: `handleAcceptRequest()` or `handleDeclineRequest()`
   - Inside handler: `resolveUpdatesByEventAndType(eventId, "join_request")`
   - Result: join_request update marked resolved
   - State Updates:
     - Update removed from `unresolvedUpdates`
     - `unresolvedCount` decrements
     - Inbox badge decrements

**Path C: Other Update Types**

6. **Handle Other Updates**
   - Types: join_approved, join_declined, event_updated, event_cancelled, participant_left
   - Action: Opens Activity Details Modal
   - State Update: `selectedActivity: eventObject`
   - Transition: → ActivityDetailsModal
   - Resolution: Immediate upon opening
   - Function Call: `resolveUpdate(updateId)`
   - Result: Update marked resolved immediately
   - State Updates:
     - Update removed from `unresolvedUpdates`
     - `unresolvedCount` decrements
     - Inbox badge decrements

7. **View Activity Details**
   - User views activity information
   - Can take further actions (join, quit, edit, etc.)
   - Update remains resolved

8. **Close Activity Details**
   - User Action: Tap back or close button
   - State Update: `selectedActivity: null`
   - Transition: → Returns to Updates list
   - Display: Resolved update no longer appears in list

**Exit Points:**
- Update resolved → removed from list
- Navigate to other tab → state preserved
- All updates resolved → shows empty state

**Mobile Considerations:**
- Android: Back button closes activity details
- iOS: Swipe-back gesture closes activity details
- Updates persist across app restarts
- Badge updates immediately upon resolution
- Pull-to-refresh updates list

**Resolution Rules (Summary):**
- Opening Inbox does NOT auto-resolve updates
- Must open specific context or take action
- Type-specific resolution logic ensures proper handling
- Resolved updates never reappear

**Edge Cases:**
- Multiple updates for same event: Each resolved independently
- Event deleted: Updates remain until manually resolved
- User ignores update: Remains unresolved indefinitely (no escalation)

---

## Flow 17: Registration Gating

**Entry Point:** Anonymous user attempts action requiring registration

**Prerequisites:** `userAccount.loggedIn: false`

**Gating Triggers:**
1. Attempting to add friend from activity participants
2. Attempting to generate invite link
3. Attempting to accept invite link

**Steps:**

1. **User Attempts Gated Action**
   - State: `userAccount.loggedIn: false`
   - Examples:
     - Tap "Add friend" button on participant in Activity Details
     - Tap "Generate invite" in Friends list
     - Open invite link from outside app

2. **Store Pending Action**
   - State Updates (varies by trigger):
     - Add friend: `pendingFriendRequest: participantObject`
     - Generate invite: No pending state (just show modal)
     - Accept invite: `pendingInviteToken: string`

3. **Show Registration Modal**
   - State Update: `showRegistrationModal: true`
   - Display: Registration form with:
     - "Create account to continue" message
     - Name input field
     - Email input field
     - "Create account" button
     - Close (X) button

4. **User Decision Point**

**Path A: Complete Registration**

5. **Fill Registration Form**
   - User Action: Enter name and email
   - Validation: Both fields required

6. **Submit Registration**
   - User Action: Tap "Create account" button
   - Function Call: `handleCompleteRegistration(name, email)`
   - State Updates:
     - `userAccount.loggedIn: true`
     - `userAccount.name: name`
     - `userAccount.email: email`
     - `showRegistrationModal: false`
   - Display: Toast notification "Account created!"

7. **Resume Pending Action**
   - Automatic execution based on trigger:

   **If pending friend request:**
   - Function Call: `handleAddFriend(pendingFriendRequest)`
   - State Updates:
     - Adds friend to `friendsList` with `status: "pending"`
     - Clears `pendingFriendRequest: null`
   - Display: Toast "Friend request sent to [Name]"

   **If pending invite acceptance:**
   - Function Call: `handleOpenInviteLink(pendingInviteToken)`
   - Processes invite token
   - Sends friend request to invite sender
   - Clears `pendingInviteToken: null`
   - Display: Toast "Friend request sent to [Name]!"

   **If generate invite:**
   - Returns to invite generation flow
   - User can now generate invite link

8. **Continue Normal Flow**
   - User is now registered
   - Can access all social features
   - Pending action completed

**Path B: Cancel Registration**

5. **Close Registration Modal**
   - User Action: Tap X or outside modal
   - State Updates:
     - `showRegistrationModal: false`
     - Pending state cleared (if applicable)
   - Result: Action not completed
   - User remains anonymous

**Exit Points:**
- Registration completed → pending action executed
- Registration cancelled → returns to previous screen, action not completed

**Mobile Considerations:**
- Android: Back button closes modal (cancels registration)
- iOS: Swipe-down gesture closes modal
- Form validation prevents empty submissions
- Email format validation (basic)

**Edge Cases:**
- Multiple gating triggers: Only one pending action stored at a time
- User already has pending action: New action overwrites previous
- Registration modal closes other modals first (e.g., invite modal)

---

## Flow 18: Add Friend from Activity Participants

**Entry Point:** User wants to add participant as friend

**Prerequisites:**
- `hasOnboarded: true`
- Viewing Activity Details Modal
- Participant is not already a friend

**Steps:**

1. **View Activity Participants**
   - State: `selectedActivity !== null`
   - Location: Activity Details Modal → Participants tab
   - Display: List of confirmed participants

2. **Identify Non-Friend Participant**
   - Display: Participant card shows "Add friend" button (if not already friend)

3. **Tap Add Friend**
   - User Action: Tap "Add friend" button on participant
   - Trigger: Registration check

**Path A: User is Registered**

4. **Send Friend Request (Registered)**
   - State Check: `userAccount.loggedIn: true`
   - Function Call: `handleAddFriend(participant)`
   - State Updates:
     - Adds to `friendsList` with `status: "pending"`
     - Creates friend request object
   - Display: Toast "Friend request sent to [Name]"
   - Button Changes: "Add friend" → "Request sent" (disabled)

5. **Wait for Response**
   - Friend request appears in recipient's inbox/friends list
   - Status remains "pending"

6. **Friend Accepts Request**
   - State Update: Friend status changes to "confirmed"
   - Button disappears (already friends)
   - Friend now appears in Friends list

**Path B: User is Anonymous**

4. **Trigger Registration Gate**
   - State Check: `userAccount.loggedIn: false`
   - State Update: `pendingFriendRequest: participant`
   - Transition: → Flow 17 (Registration Gating)
   - Display: Registration modal

5. **After Registration**
   - Automatic: Friend request sent
   - Display: Toast "Friend request sent to [Name]"
   - Returns to Activity Details

**Exit Points:**
- Friend request sent → participant card updated
- Registration cancelled → no friend request sent
- Modal closed → returns to activity details

**Mobile Considerations:**
- Button state updates immediately
- Toast confirms action
- Can send multiple friend requests from same activity

---

## Flow 19: Generate and Share Invite Link

**Entry Point:** User wants to invite someone via link

**Prerequisites:** `hasOnboarded: true`

**Steps:**

1. **Navigate to Friends List**
   - State: `activeTab: "community"` + `communityMenu: "friends"`
   - Display: Friends list with "Add friend" button

2. **Open Add Friend Modal**
   - User Action: Tap "Add friend" button
   - State Update: `isAddingFriend: true`
   - Display: Add friend modal with tabs (Phone / WhatsApp)

3. **Open Invite Modal**
   - User Action: Tap "Generate invite link" button (or similar)
   - State Update: `showInviteModal: true`
   - Display: Invite generation interface

4. **Generate Invite**
   - User Action: Tap "Generate invite" button
   - Trigger: Registration check

**Path A: User is Registered**

5. **Create Invite Link (Registered)**
   - State Check: `userAccount.loggedIn: true`
   - Function Call: `handleGenerateInvite()`
   - Invite Token Generated: `invite-[userId]-[timestamp]`
   - Invite Link Format: `breakloop://invite/[token]`
   - State Update: `generatedInviteLink: inviteLink`
   - Display: Toast "Invite link generated!"
   - Display: Link shown with "Share" button

6. **Share Invite Link**
   - User Action: Tap "Share" button
   - Function Call: `handleShareInvite()`
   - Action: Opens native share sheet
   - Options: Copy to clipboard, share via apps

7. **Close Invite Modal**
   - User Action: Tap close or back
   - State Updates:
     - `showInviteModal: false`
     - `generatedInviteLink: null` (cleared)
   - Transition: → Returns to Friends list

**Path B: User is Anonymous**

5. **Trigger Registration Gate**
   - State Check: `userAccount.loggedIn: false`
   - State Update: `showInviteModal: false` (close invite modal first)
   - Transition: → Flow 17 (Registration Gating)
   - Display: Registration modal

6. **After Registration**
   - Returns to invite generation flow
   - User can now generate invite
   - Continues from step 5 (Path A)

**Exit Points:**
- Invite shared → modal closed
- Registration cancelled → returns to friends list
- Modal closed without sharing → invite link discarded

**Mobile Considerations:**
- Native share sheet integration
- Clipboard copy option
- Link format supports deep linking
- Invite tokens are unique per generation

---

## Flow 20: Accept Invite Link

**Entry Point:** User opens invite link from outside app

**Prerequisites:** App installed, invite link valid

**Steps:**

1. **Open Invite Link**
   - Trigger: User taps invite link (e.g., from message, email)
   - Link Format: `breakloop://invite/[token]`
   - App Opens: Deep link handler activates

2. **Validate Invite Token**
   - Function Call: `handleOpenInviteLink(token)`
   - Validation Checks:
     - Token format valid
     - Token not expired
     - Sender exists
     - Not already friends with sender
   - Result: `validation.valid: boolean` + `validation.invite: object`

3. **Validation Failed**
   - Display: Toast "Invalid or expired invite link"
   - Transition: → App opens to last screen or launcher
   - Exit: Flow ends

4. **Validation Passed**
   - Invite Object Contains:
     - `fromUserId: string`
     - `fromUserName: string`
     - `token: string`
   - Trigger: Registration check

**Path A: User is Registered**

5. **Send Friend Request (Registered)**
   - State Check: `userAccount.loggedIn: true`
   - Function Call: Continues in `handleOpenInviteLink()`
   - State Updates:
     - Adds sender to `friendsList` with `status: "pending"`
     - Creates friend request to sender
   - Display: Toast "Friend request sent to [Sender Name]!"
   - Transition: → App opens to Friends list (or Community tab)

6. **Wait for Sender Response**
   - Friend request appears in sender's inbox
   - Status remains "pending" in user's friends list

7. **Sender Accepts Request**
   - State Update: Friend status changes to "confirmed"
   - Both users now friends
   - Can message and see shared activities

**Path B: User is Anonymous**

5. **Trigger Registration Gate**
   - State Check: `userAccount.loggedIn: false`
   - State Update: `pendingInviteToken: token`
   - Transition: → Flow 17 (Registration Gating)
   - Display: Registration modal

6. **After Registration**
   - Automatic: Friend request sent to invite sender
   - Function Call: Resumes `handleOpenInviteLink(pendingInviteToken)`
   - Display: Toast "Friend request sent to [Sender Name]!"
   - State Update: `pendingInviteToken: null`
   - Transition: → App opens to Friends list

**Exit Points:**
- Friend request sent → opens to Friends list
- Invalid invite → opens to last screen
- Registration cancelled → opens to last screen, no friend request sent

**Mobile Considerations:**
- Deep link handling on both Android and iOS
- App may need to launch from background
- Invite validation happens before UI updates
- Toast notifications confirm actions

**Edge Cases:**
- Already friends with sender: Shows "You're already friends" toast
- Sender no longer exists: Shows "Invalid invite" toast
- Multiple invites from same sender: Only one friend request created
- Invite link opened multiple times: Idempotent (no duplicate requests)

---

## Flow 21: View and Edit My Profile

**Entry Point:** User wants to view or edit their own profile

**Prerequisites:** `hasOnboarded: true`

**Steps:**

1. **Navigate to Settings**
   - State: `activeTab: "settings"`
   - Display: Settings screen with sections

2. **View My Profile Section**
   - Location: Settings → My Profile section
   - State: `isEditingProfile: false` (view mode)
   - Display:
     - Profile photo (or placeholder with camera icon)
     - Display name (or empty state hint)
     - About Me (or empty state hint)
     - Interests (or empty state hint)
     - "Edit profile" button

3. **Empty State (If Profile Not Filled)**
   - Display: "Your profile is empty. Tap 'Edit profile' to add information."
   - Hint text in gray/muted color

4. **Tap Edit Profile**
   - User Action: Tap "Edit profile" button
   - State Updates:
     - `isEditingProfile: true`
     - `profileDraft: { ...userProfile }` (copy current profile)
   - Transition: → Edit mode

5. **Edit Mode Display**
   - State: `isEditingProfile: true`
   - Display: Editable form with:
     - Profile photo editor:
       - Current photo or placeholder
       - Upload button (camera icon)
       - Remove button (X) if photo exists
     - Display name input field
     - About Me textarea
     - Interests textarea
     - "Save changes" button
     - "Cancel" button

6. **Edit Profile Fields**
   - User Actions:
     - Upload photo: Opens file picker → Updates `profileDraft.primaryPhoto`
     - Remove photo: Clears `profileDraft.primaryPhoto`
     - Edit display name: Updates `profileDraft.displayName`
     - Edit about me: Updates `profileDraft.aboutMe`
     - Edit interests: Updates `profileDraft.interests`

7. **User Decision Point**

**Path A: Save Changes**

8. **Save Profile Changes**
   - User Action: Tap "Save changes" button
   - State Updates:
     - `userProfile: { ...profileDraft }` (apply changes)
     - `isEditingProfile: false`
     - `profileDraft: null`
   - Display: Toast "Profile updated!"
   - Transition: → View mode

9. **View Updated Profile**
   - State: `isEditingProfile: false`
   - Display: Profile shows updated information
   - Empty state hint removed if fields now filled

**Path B: Cancel Changes**

8. **Cancel Editing**
   - User Action: Tap "Cancel" button
   - State Updates:
     - `isEditingProfile: false`
     - `profileDraft: null` (discard changes)
   - Transition: → View mode (no changes applied)

**Exit Points:**
- Profile saved → returns to view mode with updates
- Editing cancelled → returns to view mode without changes
- Navigate away → editing state preserved (or cancelled, implementation-specific)

**Mobile Considerations:**
- File picker for photo upload (native)
- Photo preview before saving
- Textarea auto-expands for long text
- Form validation (optional, e.g., max lengths)
- Android: Back button cancels editing
- iOS: Swipe-back gesture cancels editing

**Privacy Notes:**
- Profile data stored locally
- Future: Profile synced after registration
- Friends can view profile based on privacy settings (future)

---

## Flow 22: View Friend Profile

**Entry Point:** User wants to view friend's profile

**Prerequisites:**
- `hasOnboarded: true`
- Friend exists in `friendsList`

**Steps:**

1. **Navigate to Friends List**
   - State: `activeTab: "community"` + `communityMenu: "friends"`
   - Display: Scrollable list of friends

2. **Tap Friend Card**
   - User Action: Tap friend card in list
   - State Updates:
     - `viewingFriend: friendObject`
     - `viewingFriendFullProfile: false` (summary view)
   - Transition: → Friend Profile Summary View

3. **Friend Profile Summary View**
   - State: `viewingFriend !== null` + `viewingFriendFullProfile: false`
   - Display:
     - Header with back button and friend name
     - Profile photo (or avatar with initial)
     - Display name (or fallback to name)
     - "Tap to view full profile" hint
     - "Chat with [Name]" button (primary action)
     - "Things [Name] is up to" section (if friend has activities)

4. **User Decision Point**

**Path A: View Full Profile**

5. **Tap Profile Card**
   - User Action: Tap profile card area
   - State Update: `viewingFriendFullProfile: true`
   - Transition: → Friend Profile Full View

6. **Friend Profile Full View**
   - State: `viewingFriend !== null` + `viewingFriendFullProfile: true`
   - Display:
     - Header with back button and friend name
     - Menu button (⋮) with actions:
       - Star/Unstar friend
       - Remove friend
     - Profile photo (or avatar)
     - Display name (or fallback to name)
     - About Me (only if friend has filled)
     - Interests (only if friend has filled)
   - Read-Only: No edit capability

7. **Friend Menu Actions**
   - User Action: Tap menu button (⋮)
   - Display: Dropdown menu with options

   **Star/Unstar Friend:**
   - User Action: Tap "Star friend" or "Unstar friend"
   - State Update: Toggles `friend.isFavorite`
   - Display: Toast "[Name] starred" or "[Name] unstarred"
   - Result: Starred friends appear at top of friends list (future)

   **Remove Friend:**
   - User Action: Tap "Remove friend"
   - Display: Confirmation dialog "Remove [Name] from your friends?"
   - User Confirms: Tap "Remove"
   - State Updates:
     - Removes friend from `friendsList`
     - Adds to `deletedFriends` array
     - `viewingFriend: null`
   - Display: Toast "[Name] removed"
   - Transition: → Returns to Friends list

8. **Back to Summary**
   - User Action: Tap back button
   - State Update: `viewingFriendFullProfile: false`
   - Transition: → Friend Profile Summary View

**Path B: Chat with Friend**

5. **Tap Chat Button**
   - User Action: Tap "Chat with [Name]" button
   - State Update: `messagingBuddy: friendObject`
   - Transition: → Opens chat interface (private messages)
   - See Flow 15 (Inbox → Messages) for chat details

**Path C: View Friend's Activities**

5. **View Activities Section**
   - Display: "Things [Name] is up to" section
   - Shows activities where friend is host
   - User Action: Tap activity card
   - State Update: `selectedActivity: activityObject`
   - Transition: → Opens Activity Details Modal

**Path D: Close Profile**

5. **Close Friend Profile**
   - User Action: Tap back button (from summary view)
   - State Update: `viewingFriend: null`
   - Transition: → Returns to Friends list

**Exit Points:**
- Profile closed → returns to Friends list
- Chat opened → opens chat interface
- Activity opened → opens Activity Details Modal
- Friend removed → returns to Friends list

**Mobile Considerations:**
- Android: Back button navigates: Full → Summary → Friends list
- iOS: Swipe-back gesture navigates: Full → Summary → Friends list
- Smooth transitions between summary and full views
- Menu dropdown closes on selection or outside tap

**Privacy:**
- Only shows profile fields friend has filled
- Respects friend's privacy settings (future)
- No edit capability on friend profiles

---

## Decision Points Summary

### At App Launch (Monitored)
- **Quick task available?**
  - Yes → Quick Task Dialog (Flow 3)
  - No → Full Intervention (Flow 4)

### At Root Cause Screen
- **User action:**
  - Select causes + "See Alternatives" → Alternatives screen
  - "I really need to use it" → Timer screen
  - Close (X) → Cancel intervention

### At Alternatives Screen
- **User action:**
  - Select alternative → Action confirmation
  - Tab switch → Different alternative list
  - Close (X) → Cancel intervention

### At Action Screen
- **User action:**
  - "Start Activity" → Activity timer
  - "Plan for later" → Alt Scheduler modal
  - Close (X) → Back to alternatives

### At Quick Task Dialog
- **User action:**
  - "Quick Task" → App unlocked with timer
  - "Go through conscious process" → Full intervention
  - Close (X) → Cancel, don't launch app

### At Activity Details Modal
- **User status:**
  - Is host → Show Edit/Cancel buttons
  - Has joined (pending) → Show "Cancel request"
  - Has joined (confirmed) → Show "Quit event"
  - Not joined → Show "Join the event"

### At Plan Activity Modal (AI Mode)
- **After AI suggestions:**
  - Accept → Save to My Upcoming
  - Edit → Switch to manual form (pre-filled)
  - Save → Save for future reference
  - Back to form → Clear suggestions, retry

### At Active Session
- **App usage:**
  - Allowed app → Status: "focused"
  - Non-allowed app → Status: "distracted"
  - BreakLoop → Status: "focused"
- **Leave session:**
  - 5-second countdown → Can cancel or leave

### At Inbox Tab
- **Sub-tab selection:**
  - Messages → View private conversations
  - Updates → View event notifications
- **Tap conversation:**
  - Opens chat interface → Marks messages as read
- **Tap update:**
  - Opens Activity Details → Resolves update (type-specific)

### At Registration Gate
- **User status:**
  - Anonymous → Show registration modal
  - Registered → Execute action immediately
- **User action:**
  - Complete registration → Resume pending action
  - Cancel → Action not completed

### At Friend Profile
- **View mode:**
  - Summary → View basic info + chat button
  - Full → View complete profile (read-only)
- **Actions:**
  - Chat → Opens private messages
  - Star/Unstar → Toggles favorite status
  - Remove → Confirmation dialog → Removes friend

### At My Profile
- **Mode:**
  - View → Display profile info + edit button
  - Edit → Editable form with save/cancel
- **Actions:**
  - Save → Updates profile → Returns to view mode
  - Cancel → Discards changes → Returns to view mode

---

## OS-Specific Considerations

### Android
- **Back Button Behavior:**
  - Launcher → Exits app (OS default)
  - BreakLoop app → Returns to launcher
  - Modal → Closes modal
  - Intervention → Cancels intervention (breathing/root-cause) or returns to previous step
  - Active session → Stays in session (doesn't leave)
- **Notifications:**
  - Proactive prompts as persistent notifications
  - Session status in notification shade
  - Quick task timer in notification area
- **App Switching:**
  - Recent apps button preserves state
  - Session tracking continues in background
  - Intervention overlay persists when switching back

### iOS
- **Home Gesture:**
  - Swipe up → Returns to iOS home (same as Android back button behavior)
  - Monitored apps: Clears session token on home gesture
- **Modal Gestures:**
  - Swipe down → Closes modal (alternative to back button)
  - Pull down on intervention → Cancels intervention
- **Notifications:**
  - Proactive prompts as notifications
  - Session status in notification center
  - Quick task timer badge on app icon
- **App Switching:**
  - App switcher preserves state
  - Session tracking continues in background

### Both Platforms
- **State Persistence:**
  - All user data persists across app restarts
  - Ephemeral states (modals, timers) may reset
  - Active sessions survive app switching
- **Navigation:**
  - Home/back always returns to launcher (except in modals)
  - Consistent navigation patterns across contexts
- **Performance:**
  - Timer updates every second (lightweight)
  - Session tracking optimized for battery
  - AI generation shows loading state

---

## Edge Cases & Error Handling

### Quick Task Expiration
- **While in app:** Triggers full intervention immediately
- **After leaving app:** Next launch triggers intervention
- **Window reset:** Automatically after 15 minutes

### Intervention Cancellation
- **Any stage:** X button returns to launcher, clears state
- **Home button:** Clears intervention, returns to launcher
- **Monitored app launch:** Cancels previous intervention, starts new one

### Activity Status Consistency
- **Same activity, multiple views:** Status badge consistent everywhere
- **Status source:** Determined by `upcomingActivities` entry, not activity itself
- **Badge visibility:** Only shown when `userHasJoined === true`

### AI Generation Failures
- **No API key:** Shows warning, fallback suggestions
- **API error:** Toast notification, fallback suggestions
- **Invalid response:** Fallback suggestions

### Session State Conflicts
- **Quick task + session:** Both can be active, quick task badge shown in session view
- **Intervention + session:** Intervention can trigger for non-allowed apps (implementation-dependent)

### Modal State Cleanup
- **Close modal:** All form state resets
- **Navigation:** Modal doesn't block navigation (closes on context switch)

### Network/Data Issues
- **Community activities:** Gracefully handle empty lists
- **Friend data:** Show placeholder if missing
- **Sync errors:** Toast notification, retry option

---

## Flow Interconnections

```
┌─────────────────┐
│   Onboarding    │
│   (Flow 1)      │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Normal Day     │◄──────┐
│  (Flow 2)       │       │
└────────┬────────┘       │
         │                │
         v                │
┌─────────────────┐       │
│ Monitored App   │       │
│ Launch          │       │
└────────┬────────┘       │
         │                │
    ┌────▼────┐           │
    │ Quick   │           │
    │ Task?   │           │
    └─┬────┬──┘           │
      │    │              │
  Yes │    │ No           │
      │    │              │
      v    v              │
┌─────────┐ ┌─────────┐  │
│ Quick   │ │  Full   │  │
│ Task    │ │ Interv. │  │
│(Flow 3) │ │(Flow 4) │  │
└────┬────┘ └────┬────┘  │
     │           │        │
     │           v        │
     │   ┌───────────┐   │
     │   │Alternative│   │
     │   │  (Flow 5) │   │
     │   └─────┬─────┘   │
     │         │          │
     │         v          │
     │   ┌───────────┐   │
     │   │ Scheduler │   │
     │   │ (Flow 11) │   │
     │   └─────┬─────┘   │
     │         │          │
     └─────────┴──────────┘
                │
                v
      ┌─────────────────┐
      │   Community     │
      │   Activities    │
      └────────┬────────┘
               │
       ┌───────┴────────┐
       │                │
       v                v
┌──────────────┐ ┌──────────────┐
│Plan Activity │ │ Join Activity│
│  (Flow 10)   │ │  (Flow 8)    │
└──────────────┘ └──────────────┘
       │                │
       └───────┬────────┘
               │
               v
      ┌─────────────────┐
      │ Manage Activity │
      │ (Flows 12-14)   │
      └─────────────────┘
```

---

## State Lifecycle Summary

### Intervention States
```
idle → breathing → root-cause → alternatives → action → action_timer → reflection → idle
                                      ↓
                                    timer → [app unlocked] → idle
```

### Activity States
```
[created] → "confirmed" (solo)
          → "pending" → "confirmed" (ask-to-join)
          → "pending" → [declined/cancelled]
          → "confirmed" → [quit]
```

### Session States
```
[invited] → joined → focused ↔ distracted → [finished/left] → null
```

### Quick Task States
```
[available] → dialog → active → expired → intervention
```

---

## Flow Priority Matrix

**User Initiated (High Priority):**
- Onboarding (Flow 1)
- Community Activity Join (Flow 8)
- Plan Activity with AI (Flow 10)
- Edit Activity (Flow 12)
- Inbox → Messages (Flow 15)
- Inbox → Updates (Flow 16)
- View/Edit My Profile (Flow 21)
- View Friend Profile (Flow 22)

**System Initiated (Medium Priority):**
- Monitored App → Quick Task (Flow 3)
- Monitored App → Full Intervention (Flow 4)
- Proactive Prompt (Flow 7)
- Registration Gating (Flow 17)

**Contextual (Low Priority):**
- Normal Day (Flow 2)
- Timer-Based Unlock (Flow 6)
- Active Session Override (Flow 9)

**Management (As Needed):**
- Alternative Activity → Reflection (Flow 5)
- Alt Scheduler (Flow 11)
- Host Manages Requests (Flow 13)
- Cancel Hosted Event (Flow 14)

**Social Features (As Needed):**
- Add Friend from Participants (Flow 18)
- Generate and Share Invite Link (Flow 19)
- Accept Invite Link (Flow 20)

---

## Testing Considerations

### Critical Paths to Test
1. **Onboarding completion** → Must reach main app
2. **Intervention flow** → All paths (breathing → reflection)
3. **Quick task expiration** → Triggers next intervention
4. **Activity join → accept** → Status badge consistency
5. **AI generation** → Handles errors gracefully
6. **Session override** → Blocks normal navigation
7. **Timer unlock** → App accessible for duration
8. **Edit activity** → Pre-fills form correctly
9. **Inbox badge updates** → Reflects unread messages + unresolved updates
10. **Update resolution** → Type-specific logic works correctly
11. **Registration gating** → Triggers at correct points, resumes pending action
12. **Friend request flows** → Invite links, participant adds, acceptance
13. **Profile editing** → Save/cancel behavior, photo upload
14. **Private messaging** → Unread state, read receipts disabled

### Edge Cases to Verify
- Quick task window reset after 15 minutes
- Intervention cancellation at each stage
- Status badge consistency across views
- AI fallback when API unavailable
- Session tracking during app switching
- Modal cleanup on navigation
- Form validation prevents incomplete saves
- Inbox badge never shown on Community tab
- Updates remain unresolved until explicit action
- Multiple updates for same event resolve independently
- Registration modal closes other modals first
- Invite link idempotency (no duplicate requests)
- Profile draft discarded on cancel
- Friend removal confirmation dialog

### Platform-Specific Testing
- Android: Back button behavior at each state
- iOS: Swipe gestures for modal dismissal
- Both: State persistence across app restarts
- Both: Notification display and interaction
- Both: Timer accuracy and battery impact

---

## Maintenance Notes

**Adding New Flows:**
1. Reference existing states in `states.md`
2. Define clear entry/exit points
3. List all decision points
4. Note mobile-specific behavior
5. Document state variables used
6. Add edge cases and error handling

**Modifying Existing Flows:**
1. Verify state IDs match `states.md`
2. Update interconnections diagram
3. Check impact on other flows
4. Test critical paths after changes
5. Update testing considerations

**State Changes:**
1. Update `states.md` first (source of truth)
2. Update affected flows in this document
3. Update decision points summary
4. Update state lifecycle diagrams
5. Update testing checklist

---

**Document Version:** 1.0
**Last Updated:** December 15, 2025
**Source of Truth:** `design/ux/states.md`
**Maintained By:** Product/Engineering Team

