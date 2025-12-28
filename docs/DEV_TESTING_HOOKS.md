# DEV Testing Hooks - OS Trigger Brain

## Purpose

Provides manual control over intervention completion for testing Step 5F end-to-end without implementing the full intervention UI.

## DEV-Only Functions

### 1. completeInterventionDEV(packageName)

**Purpose:** Manually complete an intervention to allow retesting trigger logic.

**Usage:**
```javascript
import { completeInterventionDEV } from '@/src/os/osTriggerBrain';

// Manually complete Instagram intervention
completeInterventionDEV('com.instagram.android');

// Manually complete TikTok intervention  
completeInterventionDEV('com.zhiliaoapp.musically');
```

**Behavior:**
- **DEV mode**: Clears in-progress flag, logs completion
- **Production**: Does nothing (guarded by `__DEV__`)

**Log Output:**
```
[OS Trigger Brain][DEV] Intervention completed for { 
  packageName: 'com.instagram.android',
  note: 'Manual completion via DEV hook' 
}
```

### 2. getInterventionsInProgressDEV()

**Purpose:** Inspect which apps currently have active interventions.

**Usage:**
```javascript
import { getInterventionsInProgressDEV } from '@/src/os/osTriggerBrain';

const activeInterventions = getInterventionsInProgressDEV();
console.log('Apps with active interventions:', activeInterventions);
// Output: ['com.instagram.android', 'com.zhiliaoapp.musically']
```

**Behavior:**
- **DEV mode**: Returns array of package names
- **Production**: Returns empty array

## Testing Scenarios

### Scenario 1: Test Repeated Trigger Prevention

**Steps:**
1. Open Instagram → Timer expires
2. See: `[OS Trigger Brain] BEGIN_INTERVENTION dispatched`
3. Wait 2+ seconds (heartbeat events occur)
4. Verify: NO repeated "BEGIN_INTERVENTION" logs
5. Check in-progress state:
   ```javascript
   getInterventionsInProgressDEV() 
   // → ['com.instagram.android']
   ```

### Scenario 2: Test Manual Completion & Retrigger

**Steps:**
1. After intervention dispatched, manually complete:
   ```javascript
   completeInterventionDEV('com.instagram.android')
   ```
2. See: `[OS Trigger Brain][DEV] Intervention completed for`
3. Check state cleared:
   ```javascript
   getInterventionsInProgressDEV() 
   // → []
   ```
4. Wait for timer to expire again OR re-enter after interval
5. Verify: NEW `BEGIN_INTERVENTION dispatched` (not blocked)

### Scenario 3: Test Multi-App Independence

**Steps:**
1. Open Instagram → Intervention dispatched
2. Open TikTok → Intervention dispatched
3. Check both tracked:
   ```javascript
   getInterventionsInProgressDEV()
   // → ['com.instagram.android', 'com.zhiliaoapp.musically']
   ```
4. Complete one:
   ```javascript
   completeInterventionDEV('com.instagram.android')
   ```
5. Verify only Instagram cleared:
   ```javascript
   getInterventionsInProgressDEV()
   // → ['com.zhiliaoapp.musically']
   ```

## Console Usage

Open React Native debugger console or Metro terminal and run:

```javascript
// Import functions (adjust path based on your debug environment)
const { completeInterventionDEV, getInterventionsInProgressDEV } = require('./src/os/osTriggerBrain');

// Check current state
getInterventionsInProgressDEV();

// Complete intervention
completeInterventionDEV('com.instagram.android');
```

## Production Safety

**Both functions are guarded by `__DEV__`:**

```typescript
export function completeInterventionDEV(packageName: string): void {
  if (__DEV__) {
    // Only runs in development
  }
  // Production: function does nothing
}

export function getInterventionsInProgressDEV(): string[] {
  if (__DEV__) {
    return Array.from(interventionsInProgress);
  }
  return []; // Production: empty array
}
```

**Production Build Behavior:**
- Functions exist but do nothing
- No performance impact
- No security risk
- Will be tree-shaken by bundler in optimized builds

## Removal Plan

These hooks should be removed or replaced when:
1. Full intervention UI is implemented
2. Real `onInterventionCompleted()` is wired to intervention flow
3. End-to-end testing is possible without manual completion

Until then, they provide essential testing capability for Step 5F.

---

*Added: December 27, 2025*
*Status: Active for Step 5F/5G testing*



