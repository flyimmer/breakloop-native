package com.anonymous.breakloopnative

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.util.concurrent.ConcurrentHashMap

// ── Track B §5.2: Per-app settings (not run state) ──
// Currently holds: purposeRequired(A)
private val Context.appSettingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "app_settings_store")

class AppSettingsStore(private val context: Context) {

    companion object {
        private const val TAG = "APP_SETTINGS_STORE"
        private val KEY_SETTINGS_SET = stringSetPreferencesKey("app_settings_set")
    }

    // In-memory cache for zero-blocking reads
    // Key: "pkg|field", Value: "value"
    private val memoryCache = ConcurrentHashMap<String, Boolean>()

    // ── Restore from disk ──
    suspend fun restore() {
        val prefs = context.appSettingsDataStore.data.first()
        val set = prefs[KEY_SETTINGS_SET] ?: emptySet()

        memoryCache.clear()

        // Format: "pkg|purposeRequired=true"
        set.forEach { entry ->
            val pipeIdx = entry.indexOf('|')
            if (pipeIdx > 0 && pipeIdx < entry.length - 1) {
                val pkg = entry.substring(0, pipeIdx)
                val fieldValue = entry.substring(pipeIdx + 1)
                if (fieldValue.startsWith("purposeRequired=")) {
                    val value = fieldValue.substringAfter("=").toBoolean()
                    memoryCache[pkg] = value
                }
            }
        }

        Log.i(TAG, "[RESTORE] Loaded settings for ${memoryCache.size} apps")
    }

    // ── Reads ──

    fun isPurposeRequired(pkg: String): Boolean {
        return memoryCache[pkg] ?: false
    }

    // ── Writes ──

    suspend fun setPurposeRequired(pkg: String, required: Boolean) {
        memoryCache[pkg] = required
        persist()
        Log.i(TAG, "[SET_PURPOSE_REQUIRED] pkg=$pkg required=$required")
    }

    // ── Persistence ──

    private suspend fun persist() {
        val set = memoryCache.map { (pkg, required) ->
            "$pkg|purposeRequired=$required"
        }.toSet()
        context.appSettingsDataStore.edit { preferences ->
            preferences[KEY_SETTINGS_SET] = set
        }
    }
}
