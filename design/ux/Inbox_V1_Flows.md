📬 BreakLoop — Inbox v1 Flows (Textual)
Scope: Inbox tab only
Includes: Messages, Updates
Excludes: UI layout, visuals, styling
Depends on: communication-model.md
________________________________________
0. Inbox v1 Definition (Reminder)
Inbox is a coordination surface, not a feed.
It answers one question:
“What reached me that may need awareness or action?”
Inbox contains exactly two tabs:
•	Messages
•	Updates
________________________________________
1. Inbox Entry & Default State
Entry
•	User taps Inbox tab from main navigation.
Default behavior
•	Inbox opens to the last-used sub-tab.
•	If user has never opened Inbox before:
o	Default to Updates.
Rationale:
Updates are finite and actionable; they reduce uncertainty first.
________________________________________
2. Messages Flow (Private Conversations)
2.1 Messages Tab — List State
Content
•	List of private conversations (friend ↔ friend).
•	Ordered by most recent activity.
Each list item shows:
•	Friend name
•	Last message preview (1 line, truncated)
•	Timestamp (relative, e.g. “2h ago”)
•	Unread indicator (dot or count)
Empty state
“No messages yet.”
________________________________________
2.2 Receiving a New Private Message
Trigger
•	A friend sends a private message.
System behavior
1.	Message arrives.
2.	Conversation marked unread.
3.	Inbox badge increments by +1.
4.	Messages tab shows unread indicator.
Optional notification
•	Push notification:
“Message from Anna”
________________________________________
2.3 Opening a Message Thread
User action
•	Tap a conversation in Messages.
System behavior
1.	Open private message thread.
2.	All messages in that thread marked as read.
3.	Inbox badge decrements accordingly.
Important
•	No read receipts shown to sender.
•	No typing indicators.
________________________________________
2.4 Leaving Messages
User action
•	Navigate back to Inbox or other tabs.
System behavior
•	No auto-reminders.
•	No escalation.
•	Unread remains unread until opened.
________________________________________
3. Updates Flow (System & Event Signals)
3.1 Updates Tab — List State
Content
•	Finite list of unresolved updates.
•	Ordered by time received (most recent first).
Each update item shows:
•	Type icon (message, request, change, cancel)
•	Short title
•	Context (event name / person)
•	Timestamp
•	Action affordance (if applicable)
Examples
•	“Join request for Morning Walk”
•	“New message in Evening Run”
•	“Time changed for Coffee Meetup”
•	“Yoga Session was cancelled”
________________________________________
3.2 Receiving an Update
Triggers
•	Join request received
•	Join approved / rejected
•	Event time or location changed
•	Event cancelled
•	New event group chat message
System behavior
1.	Create a new update item.
2.	Mark update as unread / unresolved.
3.	Inbox badge increments by +1.
4.	Updates tab shows indicator.
Optional notification
•	Push notification (typed):
“New message in ‘Morning Walk’”
“Join request for ‘Coffee Meetup’”
________________________________________
3.3 Opening an Update
User action
•	Tap an update item.
System behavior
•	Depends on update type:
A. Join request
•	Open decision screen (approve / reject).
•	Once acted on → update resolves.
B. Event change / cancellation
•	Open Event Details.
•	Update resolves after viewing.
C. Event group chat message
•	Open Event Details → Chat tab.
•	Update resolves once chat is opened.
________________________________________
3.4 Resolving Updates
An update is considered resolved when:
•	User completes the required action, OR
•	User opens the linked context and acknowledges it.
Resolved updates:
•	Are removed from the Updates list.
•	Do NOT resurface.
•	Do NOT count toward Inbox badge.
No snoozing, no resurfacing.
________________________________________
4. Event Group Chat → Inbox Flow
4.1 New Event Chat Message Arrives
Trigger
•	Someone posts in an event’s group chat.
System behavior
1.	Create an Update:
“New message in ‘Morning Walk’”
2.	Inbox badge increments.
3.	No new conversation appears in Messages.
________________________________________
4.2 User Taps Event Chat Update
System behavior
1.	Open Event Details.
2.	Switch to Chat tab.
3.	Mark update as resolved.
4.	Event chat unread state clears.
________________________________________
5. Badge & Highlight Rules (Strict)
Inbox tab
•	Shows badge with total unresolved items (Messages + Updates).
Messages tab
•	Shows unread conversation count.
Updates tab
•	Shows unresolved update count.
Community / Insights / Settings
•	Never badged
•	Never highlighted
________________________________________
6. Aging & Cleanup Rules (v1)
Messages
•	Conversations persist indefinitely.
•	No auto-archiving in v1.
Updates
•	Resolved updates disappear immediately.
•	Unresolved updates remain until action or acknowledgment.
•	No historical log in v1 (can be added later if needed).
________________________________________
7. Absence Behavior (Critical)
If the user:
•	Does not open Inbox for days or weeks
Then:
•	Items remain unread.
•	No escalation occurs.
•	No “you missed” messaging.
•	No decay or penalty.
Inbox waits quietly.
________________________________________
8. Failure States (Handled Gracefully)
•	If event is deleted before update is opened:
o	Update opens a simple info state:
“This event is no longer available.”
o	Update resolves afterward.
•	If sender account is unavailable:
o	Message remains readable.
o	No error loops.
________________________________________
9. Inbox v1 Completion Criteria
Inbox v1 is considered complete when:
•	Messages and Updates are separated
•	All coordination signals arrive reliably
•	No ambiguity exists about why Inbox is highlighted
•	Community remains unbadged and calm
________________________________________
Summary (One Sentence)
Inbox v1 ensures that communication and coordination reach the user clearly, quietly, and without collapsing into a social feed.

