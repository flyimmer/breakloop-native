package com.anonymous.breakloopnative

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "quick_task_quota_store")

data class QuotaState(
    val maxPer15m: Long,
    val windowStartMs: Long,
    val remaining: Long
)

class QuickTaskQuotaStore(private val context: Context) {
    
    companion object {
        private val KEY_MAX = longPreferencesKey("qt_max_v3")
        private val KEY_WINDOW = longPreferencesKey("qt_window_v3")
        private val KEY_REMAINING = longPreferencesKey("qt_rem_v3")
        private const val DEFAULT_MAX = 1L
        private const val WINDOW_MS = 15 * 60 * 1000L
    }
    
    suspend fun getSnapshot(): QuotaState {
        val p = context.dataStore.data.first()
        val m = p[KEY_MAX] ?: DEFAULT_MAX
        return QuotaState(
            maxPer15m = m,
            windowStartMs = p[KEY_WINDOW] ?: 0L,
            remaining = p[KEY_REMAINING] ?: m
        )
    }
    
    suspend fun setMaxQuota(newMax: Long): QuotaState {
        context.dataStore.edit { p ->
            p[KEY_MAX] = newMax
            val currentRemaining = p[KEY_REMAINING] ?: 0L
            if (currentRemaining > newMax) {
                p[KEY_REMAINING] = newMax
            }
        }
        return getSnapshot()
    }
    
    suspend fun checkRefillAndGetRemaining(now: Long, current: QuotaState): QuotaState {
        if (now - current.windowStartMs >= WINDOW_MS) {
            context.dataStore.edit { p ->
                p[KEY_WINDOW] = now
                val m = p[KEY_MAX] ?: DEFAULT_MAX
                p[KEY_REMAINING] = m
            }
            return getSnapshot()
        }
        return current
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
