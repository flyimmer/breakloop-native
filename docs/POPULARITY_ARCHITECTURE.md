# Popularity System Architecture

**Status:** Phase 1 (Local Simulation) ✅  
**Future:** Phase 2 (Server-Based Global State) 🚧

## Overview

The popularity system tracks how many users have saved each alternative activity to their "My List". This creates a global metric that helps users discover popular activities.

## Current Implementation: Phase 1 (Local Simulation)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Device                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AlternativesScreen                                     │ │
│  │  - Displays activities with popularity count           │ │
│  │  - Calls popularityService on save/delete              │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  popularityService.ts                                   │ │
│  │  - incrementPopularity(activityId)                     │ │
│  │  - decrementPopularity(activityId)                     │ │
│  │  - getAllPopularity()                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AsyncStorage (Local Storage)                          │ │
│  │                                                         │ │
│  │  alternatives_popularity_v1:                           │ │
│  │  { "l1": 5, "bo3": 12, "f1": 89, ... }                │ │
│  │                                                         │ │
│  │  alternatives_user_likes_v1:                           │ │
│  │  { "l1": true, "f1": true, ... }                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Limitations

**❌ Not truly global** - Each user has their own local popularity counts  
**❌ No cross-device sync** - Data doesn't sync across user's devices  
**❌ No real-time updates** - Users don't see others' likes in real-time  
**✅ Works offline** - No server dependency  
**✅ Fast** - No network latency  
**✅ Privacy** - No data sent to server

### Storage Keys

```typescript
// Global popularity counts (simulated)
alternatives_popularity_v1: {
  [activityId: string]: number  // e.g., { "l1": 5, "bo3": 12 }
}

// User's liked activities (prevents double-liking)
alternatives_user_likes_v1: {
  [activityId: string]: boolean  // e.g., { "l1": true, "f1": true }
}
```

### Behavior

1. **User saves activity to My List:**
   - Check if user already liked this activity
   - If not, increment popularity count by 1
   - Mark activity as liked by user
   - Save to AsyncStorage

2. **User deletes activity from My List:**
   - Check if user has liked this activity
   - If yes, decrement popularity count by 1 (minimum 0)
   - Remove activity from user's likes
   - Save to AsyncStorage

3. **Display popularity:**
   - Load popularity data from AsyncStorage
   - Merge with base activity data
   - Show in UI as "X likes"

## Future Implementation: Phase 2 (Server-Based)

### Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│      User A Device       │         │      User B Device       │
│                          │         │                          │
│  AlternativesScreen      │         │  AlternativesScreen      │
│         │                │         │         │                │
│         ▼                │         │         ▼                │
│  popularityService       │         │  popularityService       │
│         │                │         │         │                │
└─────────┼────────────────┘         └─────────┼────────────────┘
          │                                    │
          │  POST /api/alternatives/:id/like   │
          │  DELETE /api/alternatives/:id/like │
          │                                    │
          └──────────────┬─────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │      Backend Server (Node.js)    │
          │                                  │
          │  ┌────────────────────────────┐ │
          │  │  API Endpoints             │ │
          │  │  - POST /like              │ │
          │  │  - DELETE /like            │ │
          │  │  - GET /popularity         │ │
          │  └────────────────────────────┘ │
          │              │                  │
          │              ▼                  │
          │  ┌────────────────────────────┐ │
          │  │  Database (PostgreSQL)     │ │
          │  │                            │ │
          │  │  alternatives_popularity:  │ │
          │  │  ┌──────────┬───────────┐ │ │
          │  │  │ activity │ likes     │ │ │
          │  │  ├──────────┼───────────┤ │ │
          │  │  │ l1       │ 1,240     │ │ │
          │  │  │ bo3      │ 340       │ │ │
          │  │  │ f1       │ 9,000     │ │ │
          │  │  └──────────┴───────────┘ │ │
          │  │                            │ │
          │  │  user_likes:               │ │
          │  │  ┌────────┬──────────┐    │ │
          │  │  │ userId │ activity │    │ │
          │  │  ├────────┼──────────┤    │ │
          │  │  │ user1  │ l1       │    │ │
          │  │  │ user1  │ f1       │    │ │
          │  │  │ user2  │ l1       │    │ │
          │  │  └────────┴──────────┘    │ │
          │  └────────────────────────────┘ │
          │              │                  │
          │              ▼                  │
          │  ┌────────────────────────────┐ │
          │  │  WebSocket Server          │ │
          │  │  (Real-time updates)       │ │
          │  └────────────────────────────┘ │
          └──────────────────────────────────┘
                         │
                         │ WebSocket broadcast
                         │
          ┌──────────────┴─────────────────┐
          │                                │
          ▼                                ▼
   User A Device                    User B Device
   (Real-time update)               (Real-time update)
```

### Benefits

**✅ Truly global** - All users see same popularity counts  
**✅ Cross-device sync** - Data syncs across user's devices  
**✅ Real-time updates** - Users see others' likes in real-time  
**✅ Analytics** - Track trends and popular activities  
**✅ Scalable** - Handles millions of users  

### API Endpoints

#### POST /api/alternatives/:id/like
Increment popularity when user saves activity.

**Request:**
```http
POST /api/alternatives/l1/like
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "activityId": "l1",
  "popularity": 1241,
  "userLiked": true
}
```

**Server Logic:**
1. Verify user authentication
2. Check if user already liked this activity (query `user_likes` table)
3. If not, insert into `user_likes` table
4. Increment `alternatives_popularity.likes` by 1
5. Broadcast update via WebSocket
6. Return new popularity count

#### DELETE /api/alternatives/:id/like
Decrement popularity when user deletes activity.

**Request:**
```http
DELETE /api/alternatives/l1/like
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "activityId": "l1",
  "popularity": 1240,
  "userLiked": false
}
```

**Server Logic:**
1. Verify user authentication
2. Check if user has liked this activity
3. If yes, delete from `user_likes` table
4. Decrement `alternatives_popularity.likes` by 1 (minimum 0)
5. Broadcast update via WebSocket
6. Return new popularity count

#### GET /api/alternatives/popularity
Fetch all popularity counts (for initial load and sync).

**Request:**
```http
GET /api/alternatives/popularity
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "popularity": {
    "l1": 1240,
    "l2": 85,
    "bo3": 340,
    "f1": 9000,
    ...
  },
  "userLikes": {
    "l1": true,
    "f1": true,
    ...
  }
}
```

### Database Schema

```sql
-- Alternatives popularity table
CREATE TABLE alternatives_popularity (
  activity_id VARCHAR(10) PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User likes table (prevents double-liking)
CREATE TABLE user_likes (
  user_id UUID NOT NULL,
  activity_id VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_id),
  FOREIGN KEY (activity_id) REFERENCES alternatives_popularity(activity_id)
);

-- Index for fast lookups
CREATE INDEX idx_user_likes_user_id ON user_likes(user_id);
CREATE INDEX idx_user_likes_activity_id ON user_likes(activity_id);
```

### WebSocket Real-Time Updates

When any user likes/unlikes an activity, broadcast to all connected clients:

```typescript
// Server broadcasts
socket.broadcast.emit('popularity:update', {
  activityId: 'l1',
  popularity: 1241,
  delta: +1  // or -1
});

// Client receives
socket.on('popularity:update', (data) => {
  // Update local cache
  updatePopularityCache(data.activityId, data.popularity);
  // Re-render UI if needed
  refreshAlternativesList();
});
```

## Migration Path: Phase 1 → Phase 2

### Step 1: Backend Development
1. Set up Node.js/Express server
2. Create PostgreSQL database with schema
3. Implement API endpoints
4. Add WebSocket server for real-time updates
5. Deploy to production (AWS/Heroku/Vercel)

### Step 2: Client Updates
1. Add API base URL configuration
2. Update `popularityService.ts` to call server APIs
3. Add WebSocket client for real-time updates
4. Implement offline queue (save likes when offline, sync when online)
5. Add loading states and error handling

### Step 3: Data Migration
1. No migration needed (starts fresh at 0)
2. Old local popularity data can be discarded
3. Users' saved activities remain in `saved_alternatives_v1`

### Step 4: Testing
1. Test API endpoints with Postman
2. Test real-time updates with multiple devices
3. Test offline mode and sync
4. Load testing with many concurrent users

## Code Changes for Phase 2

### popularityService.ts

```typescript
// Replace localStorage calls with API calls
export async function incrementPopularity(activityId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/alternatives/${activityId}/like`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const { popularity } = await response.json();
    
    // Update local cache
    await updateLocalCache(activityId, popularity);
    
    return popularity;
  } catch (error) {
    console.error('[PopularityService] Failed to increment popularity:', error);
    // Fallback: Queue for later sync
    await queueOfflineAction('increment', activityId);
    throw error;
  }
}
```

### AlternativesScreen.tsx

```typescript
// Add WebSocket listener
useEffect(() => {
  const socket = io(API_BASE_URL);
  
  socket.on('popularity:update', (data) => {
    // Update popularity in real-time
    setDiscoverAlternatives(prev => 
      prev.map(alt => 
        alt.id === data.activityId 
          ? { ...alt, popularity: data.popularity }
          : alt
      )
    );
  });
  
  return () => socket.disconnect();
}, []);
```

## Current Status Summary

**Phase 1: Local Simulation** ✅
- All activities start at 0 likes
- Popularity increments/decrements locally
- No server required
- Works offline
- Ready for Phase 2 migration

**Phase 2: Server-Based** 🚧
- Requires backend development
- Truly global popularity
- Real-time updates
- Cross-device sync
- Estimated effort: 2-3 weeks

## Decision: Which Phase to Use?

### Use Phase 1 (Local) if:
- ✅ Building MVP/prototype
- ✅ No backend infrastructure yet
- ✅ Small user base (< 100 users)
- ✅ Offline-first priority
- ✅ Want to ship quickly

### Use Phase 2 (Server) if:
- ✅ Production app with many users
- ✅ Backend infrastructure available
- ✅ Real-time social features important
- ✅ Analytics and trends needed
- ✅ Cross-device sync required

## Recommendation

**Start with Phase 1** for the following reasons:
1. **Faster development** - No backend needed
2. **Works offline** - Better UX for mobile app
3. **Easy migration** - Code is ready for Phase 2
4. **Validates concept** - Test if users care about popularity
5. **No infrastructure costs** - Free to run

**Migrate to Phase 2 when:**
- User base grows beyond 1,000 active users
- Users request cross-device sync
- Analytics show popularity is important feature
- Backend infrastructure is ready
- Budget allows for server costs

## References

- **Implementation:** `src/services/popularityService.ts`
- **Database:** `src/constants/alternativesDatabase.ts`
- **Usage:** `app/screens/conscious_process/AlternativesScreen.tsx`
