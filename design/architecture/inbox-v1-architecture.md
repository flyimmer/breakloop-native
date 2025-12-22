# Inbox v1 Architecture

**Phase:** E-2d  
**Status:** Complete  
**Date:** December 22, 2025

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                   BreakLoop App                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Bottom Navigation:                                 │
│  [Insights] [Community] [Inbox 🔴3] [Settings]     │
│                            ↑                        │
│                            │                        │
│                    Badge shows unresolved count     │
└─────────────────────────────────────────────────────┘
```

---

## Inbox Screen Structure

```
┌─────────────────────────────────────────────────────┐
│  Inbox                                              │
├─────────────────────────────────────────────────────┤
│  [Messages]  [Updates 🔴3]                          │
│  └── Placeholder    └── Functional                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 💬 New message in 'Morning Walk'              │ │
│  │    "Hey, I'm running 5 mins late"             │ │
│  │    2m ago                                   > │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ➕ Join request for 'Coffee Meetup'           │ │
│  │    15m ago                                  > │ │
│  ├───────────────────────────────────────────────┤ │
│  │ ✅ Your request was approved for 'Yoga'       │ │
│  │    1h ago                                   > │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

### Phase E-2c: Event Update Signal Emission

```
User Action (Community)
    ↓
Event Occurs (chat, join, cancel, etc.)
    ↓
Emit Function Called
    ↓
EventUpdate Object Created
    ↓
Saved to localStorage: event_updates_v1
    ↓
Console.log Debug Output
```

### Phase E-2d: Inbox v1 Consumption

```
User Opens Inbox Tab
    ↓
getUnresolvedUpdates() called
    ↓
Reads from localStorage: event_updates_v1
    ↓
Filters: resolved = false
    ↓
Sorts by createdAt (desc)
    ↓
Updates state: unresolvedUpdates
    ↓
Renders list with type-specific UI
```

---

## Update Resolution Flow

```
User Taps Update in Inbox
    ↓
handleUpdateClick(update)
    ↓
switch (update.type)
    ↓
    ├─ event_chat
    │  ├─ Open Activity Details → Chat tab
    │  └─ onChatOpened() → resolveUpdatesByEventAndType()
    │
    ├─ join_request
    │  ├─ Open Activity Details → Participants tab
    │  └─ Wait for host accept/decline action
    │     └─ handleAcceptRequest() or handleDeclineRequest()
    │        └─ resolveUpdatesByEventAndType()
    │
    └─ Other types (approved, declined, updated, cancelled, left)
       ├─ Open Activity Details
       └─ resolveUpdate() immediately
    ↓
Update localStorage: mark resolved = true
    ↓
getUnresolvedUpdates() called
    ↓
Badge count recalculated
    ↓
UI refreshes
```

---

## Component Hierarchy

```
App.js
├── BreakLoopConfig
│   ├── Navigation Bar
│   │   └── NavIcon (Inbox with badge)
│   │
│   └── Inbox Screen (activeTab === "inbox")
│       ├── Header: "Inbox"
│       ├── Sub-tabs: [Messages] [Updates]
│       └── Content Area
│           ├── Messages Tab (placeholder)
│           │   └── Empty State Component
│           │
│           └── Updates Tab (functional)
│               ├── Empty State (when unresolvedUpdates.length === 0)
│               └── Update List (map over unresolvedUpdates)
│                   └── Update Item (button)
│                       ├── Icon (type-specific)
│                       ├── Text (generated from type + event title)
│                       ├── Message Preview (optional)
│                       ├── Timestamp (formatRelativeTime)
│                       └── Chevron Right
│
└── ActivityDetailsModal (modified)
    └── useEffect (activeSection === "chat")
        └── onChatOpened(eventId) callback
            └── Resolves event_chat updates
```

---

## Storage Schema

### event_updates_v1 (localStorage)

```json
[
  {
    "id": "upd_1703262000000_abc123xyz",
    "type": "event_chat",
    "eventId": "ua-1703260000000",
    "actorId": "u-001",
    "actorName": "Anna",
    "message": "Hey, I'm running 5 mins late...",
    "createdAt": 1703262000000,
    "resolved": false
  },
  {
    "id": "upd_1703261000000_def456uvw",
    "type": "join_request",
    "eventId": "ua-1703255000000",
    "actorId": "u-002",
    "actorName": "Tom",
    "message": null,
    "createdAt": 1703261000000,
    "resolved": false
  },
  {
    "id": "upd_1703259000000_ghi789rst",
    "type": "join_approved",
    "eventId": "ua-1703250000000",
    "actorId": "u-003",
    "actorName": "Sarah",
    "message": null,
    "createdAt": 1703259000000,
    "resolved": true
  }
]
```

**Key Fields:**
- `id` - Unique update identifier (generated by `generateUpdateId()`)
- `type` - One of 7 UPDATE_TYPES constants
- `eventId` - Reference to activity/event ID
- `actorId` - User who triggered the update
- `actorName` - Display name of actor
- `message` - Optional preview text (used for event_chat)
- `createdAt` - Unix timestamp in milliseconds
- `resolved` - Boolean flag (false = unresolved, true = resolved)

---

## Update Types Matrix

| Type | Triggered By | Icon | Color | Resolution Trigger | Deep-link Target |
|------|-------------|------|-------|-------------------|-----------------|
| `event_chat` | Message sent in event chat | MessageCircle | Blue | Chat tab opened | Activity Details → Chat |
| `join_request` | User requests to join | UserPlus | Purple | Host accepts/declines | Activity Details → Participants |
| `join_approved` | Host approves request | Check | Green | Activity opened | Activity Details |
| `join_declined` | Host declines request | X | Red | Activity opened | Activity Details |
| `event_updated` | Host edits event | Edit2 | Orange | Activity opened | Activity Details |
| `event_cancelled` | Host cancels event | AlertTriangle | Red | Activity opened | Activity Details |
| `participant_left` | Participant quits | UserMinus | Gray | Activity opened | Activity Details |

---

## Badge Calculation Logic

```javascript
// Real-time calculation on every render
function getUnresolvedCount() {
  const allUpdates = loadEventUpdates(); // Read from localStorage
  return allUpdates.filter(u => !u.resolved).length;
}

// Used in navigation render
<NavIcon
  icon={<Inbox size={20} />}
  label="Inbox"
  active={activeTab === "inbox"}
  onClick={() => setActiveTab("inbox")}
  badge={getUnresolvedCount()} // <-- Real-time badge
/>
```

**Badge Display Rules:**
- `count === 0` → No badge shown
- `count 1-99` → Show exact number
- `count > 99` → Show "99+"
- Badge color: Red (`bg-red-500`)
- Badge position: Top-right of icon

---

## Communication Model Compliance

### ✅ Inbox is the ONLY badged tab
```
[Insights]    [Community]    [Inbox 🔴3]    [Settings]
   No badge      No badge       Badge!        No badge
```

### ✅ Messages and Updates are separated
```
Inbox
├── Messages (Private conversations)
└── Updates (System & event signals)
```

### ✅ Event chat notifications go to Updates
```
Event Chat Message Sent
    ↓
emitEventChatUpdate()
    ↓
Appears in: Inbox → Updates (NOT Messages)
```

### ✅ Updates are finite and typed
- No infinite scroll
- Clear update types
- Time-based ordering only
- Finite list (not a feed)

---

## Error Handling

### Deleted Event
```javascript
const activity = findActivityById(update.eventId);
if (!activity) {
  resolveUpdate(update.id);
  setToast("This event is no longer available.");
  return;
}
```

### Missing Actor Name
```javascript
const actorName = update.actorName || 'Someone';
updateText = `${actorName} left '${eventTitle}'`;
```

### Empty Updates List
```javascript
{unresolvedUpdates.length === 0 ? (
  <EmptyState 
    icon={<Bell size={48} />}
    title="All caught up!"
    message="You have no pending updates..."
  />
) : (
  <UpdateList updates={unresolvedUpdates} />
)}
```

---

## Performance Optimizations

### 1. Lazy Loading
```javascript
// Only load updates when Inbox tab is opened
useEffect(() => {
  if (activeTab === "inbox") {
    setUnresolvedUpdates(getUnresolvedUpdates());
  }
}, [activeTab]);
```

### 2. Memoization Opportunities (Future)
```javascript
// Could be optimized with useMemo
const unresolvedUpdates = useMemo(
  () => getUnresolvedUpdates(),
  [/* dependency array */]
);
```

### 3. Debounced Badge Count (Future)
```javascript
// Could debounce badge recalculation
const badgeCount = useDebouncedValue(getUnresolvedCount(), 200);
```

---

## Testing Strategy

### Unit Tests (Future)
```javascript
// inbox.test.js
describe('getUnresolvedUpdates', () => {
  it('filters out resolved updates', () => {
    // Test logic
  });
  
  it('sorts by createdAt descending', () => {
    // Test logic
  });
});
```

### Integration Tests (Future)
```javascript
// inbox-flow.test.js
describe('Update Resolution Flow', () => {
  it('resolves event_chat when chat tab opens', () => {
    // Test logic
  });
  
  it('resolves join_request when host accepts', () => {
    // Test logic
  });
});
```

### Manual Testing
See `INBOX_V1_IMPLEMENTATION.md` for complete manual testing instructions.

---

## Future Enhancements

### Phase E-2e: Private Messages
```
Messages Tab → Fully Functional
├── Conversation List
├── Message Threads
├── Unread Counts per Conversation
└── Send/Receive Messages
```

### Phase E-3: Notifications
```
Push Notifications
├── Browser Push API
├── Service Worker
├── Notification Permissions
└── Background Sync
```

### Phase E-4: Advanced Inbox
```
Advanced Features
├── Batch Operations (Mark all as read)
├── Filtering (By type, event, date)
├── Search
├── Update History View
├── Snooze/Defer
└── Smart Grouping
```

---

## Dependencies

### Internal
- `src/utils/eventUpdates.js` - Update emission (Phase E-2c)
- `src/utils/inbox.js` - Inbox utilities (Phase E-2d)
- `src/utils/time.js` - Time formatting
- `src/components/ActivityDetailsModal.js` - Deep-link target

### External
- `lucide-react` - Icons
- `react` - UI framework
- Browser localStorage API

---

## Known Limitations

1. **No Persistence of Read State**
   - Once resolved, updates are permanently removed
   - No "mark as unread" functionality

2. **No Batch Operations**
   - Must tap each update individually
   - No "mark all as read"

3. **No Filtering/Search**
   - All updates shown chronologically
   - Cannot filter by type or event

4. **No Update History**
   - Resolved updates are gone forever
   - Cannot review past notifications

5. **Orphaned Updates**
   - If event is deleted, update remains until tapped
   - No automatic cleanup

---

## Conclusion

Inbox v1 provides a solid foundation for event-related coordination. The architecture is:

- ✅ **Scalable** - Can add more update types easily
- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Extensible** - Ready for Messages tab implementation
- ✅ **Performant** - Minimal bundle size impact
- ✅ **Compliant** - Follows communication model strictly

**Status:** Production-ready for Phase E-2d scope.

