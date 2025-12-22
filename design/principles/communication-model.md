# BreakLoop — Communication Model  
**Phase E-2 (Authoritative)**

**Status:** Authoritative  
**Scope:** Messaging, Event Chat, Notifications, Inbox  
**Applies to:** All present and future communication features  
**Depends on:**  
- `main-app-posture.md`  
- `social-feature-guardrails.md`

---

## 0. Purpose

This document defines the **communication architecture** of BreakLoop.

It exists to:
- Enable reliable real-world coordination
- Prevent missed messages and updates
- Maintain clarity between different kinds of communication
- Avoid turning BreakLoop into a checking-driven social app

If a communication feature violates this model, **it must be redesigned or removed**.

---

## 1. Core Principle (Communication)

> **In BreakLoop, communication is always contextual.  
Messages belong to people. Chat belongs to events.  
Notifications belong to coordination.**

No communication surface may exist without a clear semantic role.

---

## 2. Three Communication Types (Non-Negotiable)

BreakLoop defines **exactly three** communication types.

They must never be merged into a single undifferentiated stream.

---

### 1️⃣ Private Messages (Person ↔ Person)

**Meaning:**  
> “A person wants to talk to me.”

#### Purpose
- Spontaneous coordination
- Social connection
- Pre- or post-activity communication

#### Characteristics
- Human-originated
- Conversational
- Open-ended
- Threaded
- Asynchronous

#### Where they live
- **Inbox → Messages**

#### Notifications
- Allowed
- Example:  
  > “Message from Anna”

#### What they must NOT include
- Join requests
- Activity cancellations
- System state changes

Private messages are **human conversation only**.

---

### 2️⃣ Event Group Chat (Event ↔ Participants)

**Meaning:**  
> “People involved in this event are discussing logistics or details.”

#### Purpose
- Activity coordination
- Logistics and clarifications
- Group discussion tied to a specific event

#### Characteristics
- Contextual
- Group-scoped
- Exists only within the event
- Finite (ends with the event)

#### Where chat history lives
- **Inside Event Details**
  - e.g. “Chat” or “Discussion” tab

The event is the **owner** of the chat.

#### Notifications
- Event chat messages generate **Inbox → Updates** items
- Example:
  > “New message in ‘Morning Walk’”

#### Navigation behavior
- Tapping the notification deep-links to:
  > Event Details → Chat

#### What event chat must NOT become
- A general group chat
- A discoverable chat outside the event
- A replacement for private messages

Event chat has **no independent existence** outside its event.

---

### 3️⃣ System Updates (System ↔ User)

**Meaning:**  
> “Something about a plan you are involved in has changed or requires action.”

#### Purpose
- Reliable coordination
- State awareness
- Decision support

#### Examples
- Join requests
- Join approvals / rejections
- Activity time or location changes
- Activity cancellations
- Host announcements
- Event chat activity (as notifications)

#### Where they live
- **Inbox → Updates**

#### Characteristics
- Item-based (not threaded)
- Typed (icon + label)
- Finite
- Actionable or informational
- Resolves once acknowledged or acted upon

System updates are **not conversations**.

---

## 3. Inbox Model (Authoritative)

The **Inbox** is a container for **things that reached the user**.

It is not a social feed.

Inbox
├── Messages (Private conversations)
└── Updates (System and event signals)



### Inbox rules
- Inbox badge = unread coordination items
- Messages and Updates are visually and conceptually separated
- No mixed list of chats and updates
- No infinite scroll
- No engagement-driven ordering

Inbox is **reactive**, not consumptive.

---

## 4. Notification Semantics

### 4.1 Typed Notifications (Required)

All notifications must have a clear type.

| Type | Example |
|----|----|
| Message | “Message from Anna” |
| Event chat | “New message in ‘Evening Run’” |
| Join request | “Join request for ‘Coffee Meetup’” |
| Change | “Time changed for ‘Morning Walk’” |

### 4.2 Tone Rules

Notifications must be:
- Informational
- Neutral
- Non-urgent in language

Forbidden:
- Guilt framing
- Escalation (“You haven’t replied”)
- Emotional manipulation
- Generic “You have notifications”

---

## 5. Community Tab Relationship

- **Community tab is never badged**
- Community is a browsing and planning space
- Communication signals must not collapse into Community

All attention-requiring signals flow through **Inbox only**.

This preserves semantic clarity.

---

## 6. Read / Unread Behavior

### Private Messages
- Standard unread state per conversation
- Visible in Inbox → Messages

### Event Chat
- Unread state scoped to the event
- Resolved when user opens the event chat
- No global unread counters for event chats

### Updates
- Each update resolves individually
- No lingering unresolved states once acknowledged

Unread indicates **state**, not **obligation**.

---

## 7. Lifecycle Rules

### Event Lifecycle
- When an event ends:
  - Event chat becomes read-only
  - No new notifications from it
  - History remains visible for reference
  - Event eventually archives

This prevents zombie conversations.

---

## 8. What Must Never Happen

The communication system must never:

- Merge private messages, event chat, and updates into one list
- Badge Community for communication
- Create infinite scrolling chat or update feeds
- Introduce social comparison or pressure
- Penalize absence or delayed responses

---

## 9. Relationship to Other Principles

- Ethical posture: `main-app-posture.md`
- Social constraints: `social-feature-guardrails.md`
- This document defines **how communication is structured**, not UI visuals

If there is a conflict:
1. Main App Posture wins
2. Communication Model wins over UI convenience

---

## 10. Completion Statement

With this communication model defined:

- Messaging, event chat, and notifications are clearly separated
- Coordination is reliable
- Attention is respected
- UI decisions have a stable semantic foundation

**Communication features may now be implemented safely and incrementally.**
