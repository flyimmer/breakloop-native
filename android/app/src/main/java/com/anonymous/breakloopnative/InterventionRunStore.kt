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

// ── Track B §5.1: Per-app intervention run context ──
// Fields: checkpointCount, rootCause, purpose, lastPurpose, recentPurposes
// Format in DataStore: StringSet of "pkg|field=value"
private val Context.interventionRunDataStore: DataStore<Preferences> by preferencesDataStore(name = "intervention_run_store")

data class InterventionRunState(
    val checkpointCount: Int = 0,
    val rootCause: String? = null,
    val purpose: String? = null,
    val lastPurpose: String? = null,
    val recentPurposes: List<String> = emptyList()
)

class InterventionRunStore(private val context: Context) {

    companion object {
        private const val TAG = "INT_RUN_STORE"
        private val KEY_RUN_SET = stringSetPreferencesKey("intervention_run_set")
        private const val MAX_RECENT_PURPOSES = 2
    }

    // In-memory cache for zero-blocking reads
    private val memoryCache = ConcurrentHashMap<String, InterventionRunState>()

    // ── Restore from disk on service start ──
    suspend fun restore() {
        val prefs = context.interventionRunDataStore.data.first()
        val set = prefs[KEY_RUN_SET] ?: emptySet()

        memoryCache.clear()

        // Parse "pkg|field=value" entries
        val byPkg = mutableMapOf<String, MutableMap<String, String>>()
        set.forEach { entry ->
            val pipeIdx = entry.indexOf('|')
            if (pipeIdx > 0 && pipeIdx < entry.length - 1) {
                val pkg = entry.substring(0, pipeIdx)
                val fieldValue = entry.substring(pipeIdx + 1)
                val eqIdx = fieldValue.indexOf('=')
                if (eqIdx > 0) {
                    val field = fieldValue.substring(0, eqIdx)
                    val value = fieldValue.substring(eqIdx + 1)
                    byPkg.getOrPut(pkg) { mutableMapOf() }[field] = value
                }
            }
        }

        byPkg.forEach { (pkg, fields) ->
            memoryCache[pkg] = InterventionRunState(
                checkpointCount = fields["checkpointCount"]?.toIntOrNull() ?: 0,
                rootCause = fields["rootCause"],
                purpose = fields["purpose"],
                lastPurpose = fields["lastPurpose"],
                recentPurposes = fields["recentPurposes"]
                    ?.split(",")
                    ?.filter { it.isNotBlank() }
                    ?: emptyList()
            )
        }

        Log.i(TAG, "[RESTORE] Loaded ${memoryCache.size} app run states")
    }

    // ── Read ──

    fun getState(pkg: String): InterventionRunState {
        return memoryCache[pkg] ?: InterventionRunState()
    }

    fun getCheckpointCount(pkg: String): Int {
        return memoryCache[pkg]?.checkpointCount ?: 0
    }

    // ── Write ──

    suspend fun incrementCheckpointCount(pkg: String): Int {
        val current = getState(pkg)
        val newCount = current.checkpointCount + 1
        val updated = current.copy(checkpointCount = newCount)
        memoryCache[pkg] = updated
        persist()
        Log.i(TAG, "[CP_INCREMENT] pkg=$pkg count=$newCount")
        return newCount
    }

    suspend fun resetCheckpointCount(pkg: String) {
        val current = getState(pkg)
        if (current.checkpointCount == 0) return
        memoryCache[pkg] = current.copy(checkpointCount = 0)
        persist()
        Log.i(TAG, "[CP_RESET] pkg=$pkg")
    }

    suspend fun setRootCause(pkg: String, rootCause: String?) {
        val current = getState(pkg)
        memoryCache[pkg] = current.copy(rootCause = rootCause)
        persist()
    }

    suspend fun setPurpose(pkg: String, purpose: String?) {
        val current = getState(pkg)
        // Also update lastPurpose + recentPurposes when setting a new purpose
        val newRecent = if (purpose != null) {
            (listOf(purpose) + (current.recentPurposes.filter { it != purpose }))
                .take(MAX_RECENT_PURPOSES)
        } else {
            current.recentPurposes
        }
        memoryCache[pkg] = current.copy(
            purpose = purpose,
            lastPurpose = purpose ?: current.lastPurpose,
            recentPurposes = newRecent
        )
        persist()
    }

    suspend fun clearRunState(pkg: String) {
        // Keep lastPurpose and recentPurposes across runs; clear transient fields
        val current = getState(pkg)
        memoryCache[pkg] = InterventionRunState(
            checkpointCount = 0,
            rootCause = null,
            purpose = null,
            lastPurpose = current.lastPurpose,
            recentPurposes = current.recentPurposes
        )
        persist()
        Log.i(TAG, "[CLEAR] pkg=$pkg (kept lastPurpose=${current.lastPurpose})")
    }

    // ── Persistence ──

    private suspend fun persist() {
        val set = mutableSetOf<String>()
        memoryCache.forEach { (pkg, state) ->
            set.add("$pkg|checkpointCount=${state.checkpointCount}")
            state.rootCause?.let { set.add("$pkg|rootCause=$it") }
            state.purpose?.let { set.add("$pkg|purpose=$it") }
            state.lastPurpose?.let { set.add("$pkg|lastPurpose=$it") }
            if (state.recentPurposes.isNotEmpty()) {
                set.add("$pkg|recentPurposes=${state.recentPurposes.joinToString(",")}")
            }
        }
        context.interventionRunDataStore.edit { preferences ->
            preferences[KEY_RUN_SET] = set
        }
    }
}
