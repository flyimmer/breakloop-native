# Known Limitations - OS Trigger System

## Android Foreground App Detection

### Limitation: UsageStats Launcher Detection

**Issue:**
When a user exits a monitored app (e.g., Instagram, TikTok) and returns to the Android home launcher, the `UsageStatsManager` API may continue to report the previously used app as the "foreground app" instead of the launcher. This can cause spurious "app re-entry" events to be emitted.

**Root Cause:**
Android's `UsageStatsManager.queryUsageStats()` finds the app with the most recent `lastTimeUsed` timestamp. When returning to the launcher:
1. The launcher may not immediately register a usage stat update
2. The exited app retains the most recent `lastTimeUsed` timestamp
3. The monitoring service incorrectly reports the exited app as still in foreground

**Impact:**
- **Minor**: The OS Trigger Brain may log a "re-entry within app switch interval" message when the user is actually on the home screen
- **No functional impact**: When the user actually opens a different app, exit tracking works correctly
- **Interval logic remains correct**: The app switch interval timer still functions as designed once a genuine app switch occurs

**Example Scenario:**
1. User opens Instagram → "App entered foreground: com.instagram.android"
2. User exits to home screen → "App exited foreground: com.instagram.android" + "App entered foreground: com.instagram.android" (spurious)
3. User opens Chrome → "App exited foreground: com.instagram.android" + "App entered foreground: com.android.chrome" (correct)

**Workarounds Considered:**
1. **ActivityManager.getRunningTasks()** - Deprecated in Android 5.0+, unreliable
2. **AccessibilityService** - More accurate but requires additional permissions and user setup
3. **Ignore launcher packages** - Would miss legitimate app launches from launcher

**Decision:**
Accept this limitation as it does not affect core intervention logic. The app switch interval mechanism works correctly for genuine app-to-app transitions, which is the primary use case.

**Code References:**
- Android: `android/app/src/main/java/com/anonymous/breakloopnative/AppMonitorService.kt` (lines 165-169)
- JS: `src/os/osTriggerBrain.ts` (header documentation, line 26)

**Status:** Documented, no fix planned for v1.0

---

*Last updated: December 27, 2025*

