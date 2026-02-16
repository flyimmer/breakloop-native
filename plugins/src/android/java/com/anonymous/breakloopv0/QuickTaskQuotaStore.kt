package com.anonymous.breakloopv0

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.util.Calendar
import java.util.TimeZone

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "quick_task_quota_store")

data class QuotaState(
    val maxPerWindow: Long,
    val windowStartMs: Long,
    val windowEndMs: Long,      // End of current window (for UI display)
    val windowDurationMs: Long,
    val remaining: Long
)

class QuickTaskQuotaStore(private val context: Context) {
    
    companion object {
        private val KEY_MAX = longPreferencesKey("qt_max_v3")
        private val KEY_WINDOW = longPreferencesKey("qt_window_v3")
        private val KEY_REMAINING = longPreferencesKey("qt_rem_v3")
        private val KEY_WINDOW_DURATION = longPreferencesKey("qt_window_dur_v3")
        private const val DEFAULT_MAX = 1L
        private const val DEFAULT_WINDOW_DURATION_MS = 15 * 60 * 1000L
    }
    
    suspend fun getSnapshot(): QuotaState {
        val p = context.dataStore.data.first()
        val m = p[KEY_MAX] ?: DEFAULT_MAX
        val windowDurationMs = p[KEY_WINDOW_DURATION] ?: DEFAULT_WINDOW_DURATION_MS
        val windowStartMs = p[KEY_WINDOW] ?: 0L
        
        // Calculate window end for UI display
        val windowEndMs = if (windowStartMs > 0L) {
            computeWindowEnd(windowStartMs, windowDurationMs, TimeZone.getDefault())
        } else {
            0L
        }
        
        return QuotaState(
            maxPerWindow = m,
            windowStartMs = windowStartMs,
            windowEndMs = windowEndMs,
            windowDurationMs = windowDurationMs,
            remaining = p[KEY_REMAINING] ?: m
        )
    }
    
    suspend fun setMaxQuota(newMax: Long): QuotaState {
        context.dataStore.edit { p ->
            p[KEY_MAX] = newMax
            // Always reset remaining to new max for live updates
            p[KEY_REMAINING] = newMax
        }
        return getSnapshot()
    }
    
    
    /**
     * Compute the wall-clock aligned window start for a given timestamp.
     * Windows are aligned to fixed boundaries based on duration (e.g., 1h -> :00, 2h -> even hours).
     */
    private fun computeWindowStart(nowMs: Long, windowDurationMs: Long, timezone: TimeZone): Long {
        val calendar = Calendar.getInstance(timezone).apply {
            timeInMillis = nowMs
        }
        
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH)
        val dayOfMonth = calendar.get(Calendar.DAY_OF_MONTH)
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)
        
        val alignedCalendar = Calendar.getInstance(timezone).apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month)
            set(Calendar.DAY_OF_MONTH, dayOfMonth)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            
            when (windowDurationMs) {
                15 * 60 * 1000L -> {
                    // Quarter-hour: align to :00, :15, :30, :45
                    val alignedMinute = (minute / 15) * 15
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, alignedMinute)
                }
                60 * 60 * 1000L -> {
                    // 1 hour: align to :00
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, 0)
                }
                2 * 60 * 60 * 1000L -> {
                    // 2 hours: align to even hours
                    val alignedHour = (hour / 2) * 2
                    set(Calendar.HOUR_OF_DAY, alignedHour)
                    set(Calendar.MINUTE, 0)
                }
                4 * 60 * 60 * 1000L -> {
                    // 4 hours: align to 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
                    val alignedHour = (hour / 4) * 4
                    set(Calendar.HOUR_OF_DAY, alignedHour)
                    set(Calendar.MINUTE, 0)
                }
                8 * 60 * 60 * 1000L -> {
                    // 8 hours: align to 00:00, 08:00, 16:00
                    val alignedHour = (hour / 8) * 8
                    set(Calendar.HOUR_OF_DAY, alignedHour)
                    set(Calendar.MINUTE, 0)
                }
                24 * 60 * 60 * 1000L -> {
                    // 24 hours: align to midnight 00:00
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                }
                else -> {
                    // Fallback to 15 minutes for unknown durations
                    val alignedMinute = (minute / 15) * 15
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, alignedMinute)
                }
            }
        }
        
        return alignedCalendar.timeInMillis
    }
    
    /**
     * Compute the window end timestamp (DST-safe).
     */
    private fun computeWindowEnd(windowStartMs: Long, windowDurationMs: Long, timezone: TimeZone): Long {
        val calendar = Calendar.getInstance(timezone).apply {
            timeInMillis = windowStartMs
        }
        
        when (windowDurationMs) {
            15 * 60 * 1000L -> calendar.add(Calendar.MINUTE, 15)
            60 * 60 * 1000L -> calendar.add(Calendar.HOUR_OF_DAY, 1)
            2 * 60 * 60 * 1000L -> calendar.add(Calendar.HOUR_OF_DAY, 2)
            4 * 60 * 60 * 1000L -> calendar.add(Calendar.HOUR_OF_DAY, 4)
            8 * 60 * 60 * 1000L -> calendar.add(Calendar.HOUR_OF_DAY, 8)
            24 * 60 * 60 * 1000L -> calendar.add(Calendar.DAY_OF_MONTH, 1)
            else -> calendar.add(Calendar.MINUTE, 15) // Fallback
        }
        
        return calendar.timeInMillis
    }
    
    /**
     * Check if window boundary has been crossed and refill quota if needed.
     * Uses fixed wall-clock boundaries aligned to user's local timezone.
     */
    suspend fun checkAndRefillQuota(now: Long, timezone: TimeZone): QuotaState {
        val current = getSnapshot()
        val currentWindowStart = computeWindowStart(now, current.windowDurationMs, timezone)
        
        // Check if we've crossed into a new window
        if (currentWindowStart > current.windowStartMs) {
            // Boundary crossed - refill quota
            Log.i("QT_QUOTA_REFILL", "Window boundary crossed. Refilling from ${current.remaining} to ${current.maxPerWindow}")
            
            context.dataStore.edit { prefs ->
                prefs[KEY_WINDOW] = currentWindowStart
                prefs[KEY_REMAINING] = current.maxPerWindow
            }
            
            val newState = getSnapshot()
            Log.i("QT_QUOTA_REFILL", "New window: start=$currentWindowStart, remaining=${newState.remaining}")
            return newState
        } else {
            // Still in same window - no refill
            Log.d("QT_WINDOW", "Still in current window. Remaining: ${current.remaining}")
            return current
        }
    }
    
    /**
     * Update window duration and trigger immediate refill.
     * Called when user changes window duration in Settings.
     */
    suspend fun updateWindowDuration(newDurationMs: Long): QuotaState {
        val now = System.currentTimeMillis()
        val timezone = TimeZone.getDefault()
        val currentWindowStart = computeWindowStart(now, newDurationMs, timezone)
        
        Log.i("QT_WINDOW", "Updating window duration to ${newDurationMs}ms. New window start: $currentWindowStart")
        
        context.dataStore.edit { prefs ->
            prefs[KEY_WINDOW_DURATION] = newDurationMs
            prefs[KEY_WINDOW] = currentWindowStart
            // Immediate refill on window duration change (per spec)
            val maxQuota = prefs[KEY_MAX] ?: DEFAULT_MAX
            prefs[KEY_REMAINING] = maxQuota
        }
        
        val newState = getSnapshot()
        Log.i("QT_WINDOW", "Window duration updated. State: $newState")
        return newState
    }
    
    suspend fun decrementQuota(): QuotaState {
        context.dataStore.edit { p ->
            val currentRemaining = p[KEY_REMAINING] ?: 0L
            if (currentRemaining > 0L) {
                val nextValue = currentRemaining - 1L
                p[KEY_REMAINING] = nextValue
            }
        }
        return getSnapshot()
    }
}
