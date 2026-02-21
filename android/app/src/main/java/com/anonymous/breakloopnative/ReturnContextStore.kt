package com.anonymous.breakloopnative

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

// ── Track B §5.4 + §9.3: Persisted ReturnContext with TTL ──
// Survives process churn. Used for Alternatives deep-link return to checkpoint.
private val Context.returnContextDataStore: DataStore<Preferences> by preferencesDataStore(name = "return_context_store")

data class ReturnContext(
    val contextId: String,
    val sourceCheckpoint: Int,
    val trigger: String,
    val sessionId: String,
    val app: String,
    val createdAt: Long
)

class ReturnContextStore(private val context: Context) {

    companion object {
        private const val TAG = "RETURN_CTX_STORE"
        private const val TTL_MS = 30L * 60 * 1000  // 30 minutes

        // ReturnContext fields
        private val KEY_CONTEXT_ID = stringPreferencesKey("rc_context_id")
        private val KEY_SOURCE_CP = intPreferencesKey("rc_source_checkpoint")
        private val KEY_TRIGGER = stringPreferencesKey("rc_trigger")
        private val KEY_SESSION_ID = stringPreferencesKey("rc_session_id")
        private val KEY_APP = stringPreferencesKey("rc_app")
        private val KEY_CREATED_AT = longPreferencesKey("rc_created_at")

        // PendingReturnContextId (§9.3 Step 1)
        private val KEY_PENDING_CONTEXT_ID = stringPreferencesKey("rc_pending_context_id")
    }

    // In-memory cache (restored from disk on startup)
    @Volatile private var cached: ReturnContext? = null
    @Volatile private var pendingContextId: String? = null

    // ── Restore from disk ──
    suspend fun restore() {
        val prefs = context.returnContextDataStore.data.first()
        val ctxId = prefs[KEY_CONTEXT_ID]
        if (ctxId != null) {
            val createdAt = prefs[KEY_CREATED_AT] ?: 0L
            val now = System.currentTimeMillis()
            if (now - createdAt < TTL_MS) {
                cached = ReturnContext(
                    contextId = ctxId,
                    sourceCheckpoint = prefs[KEY_SOURCE_CP] ?: 0,
                    trigger = prefs[KEY_TRIGGER] ?: "",
                    sessionId = prefs[KEY_SESSION_ID] ?: "",
                    app = prefs[KEY_APP] ?: "",
                    createdAt = createdAt
                )
                Log.i(TAG, "[RESTORE] Valid context: id=$ctxId app=${cached?.app} age=${(now - createdAt) / 1000}s")
            } else {
                // Expired — clean up
                cached = null
                clearFromDisk()
                Log.i(TAG, "[RESTORE] Expired context discarded: id=$ctxId age=${(now - createdAt) / 1000}s")
            }
        }

        // Restore pending
        pendingContextId = prefs[KEY_PENDING_CONTEXT_ID]
        if (pendingContextId != null) {
            Log.i(TAG, "[RESTORE] Pending return: $pendingContextId")
        }
    }

    // ── ReturnContext CRUD ──

    fun getContext(): ReturnContext? {
        val ctx = cached ?: return null
        // TTL check on read
        if (System.currentTimeMillis() - ctx.createdAt >= TTL_MS) {
            Log.i(TAG, "[GET] TTL expired for id=${ctx.contextId}")
            cached = null
            return null
        }
        return ctx
    }

    fun getContextById(contextId: String): ReturnContext? {
        val ctx = getContext() ?: return null
        return if (ctx.contextId == contextId) ctx else null
    }

    suspend fun persist(returnContext: ReturnContext) {
        cached = returnContext
        context.returnContextDataStore.edit { prefs ->
            prefs[KEY_CONTEXT_ID] = returnContext.contextId
            prefs[KEY_SOURCE_CP] = returnContext.sourceCheckpoint
            prefs[KEY_TRIGGER] = returnContext.trigger
            prefs[KEY_SESSION_ID] = returnContext.sessionId
            prefs[KEY_APP] = returnContext.app
            prefs[KEY_CREATED_AT] = returnContext.createdAt
        }
        Log.i(TAG, "[PERSIST] id=${returnContext.contextId} app=${returnContext.app} cp=${returnContext.sourceCheckpoint}")
    }

    suspend fun clear() {
        cached = null
        clearFromDisk()
        Log.i(TAG, "[CLEAR] Context cleared")
    }

    // ── PendingReturnContextId (§9.3) ──

    fun getPendingReturnContextId(): String? = pendingContextId

    suspend fun setPendingReturnContextId(contextId: String) {
        pendingContextId = contextId
        context.returnContextDataStore.edit { prefs ->
            prefs[KEY_PENDING_CONTEXT_ID] = contextId
        }
        Log.i(TAG, "[SET_PENDING] contextId=$contextId")
    }

    suspend fun clearPending() {
        pendingContextId = null
        context.returnContextDataStore.edit { prefs ->
            prefs.remove(KEY_PENDING_CONTEXT_ID)
        }
        Log.i(TAG, "[CLEAR_PENDING]")
    }

    /**
     * Consume pending return for a given app.
     * Returns the ReturnContext if:
     *   - pendingContextId exists
     *   - matching context found in store
     *   - context.app matches foregroundApp
     *   - TTL valid
     * Otherwise returns null.
     *
     * On success: clears pending + context (one-shot consumption).
     * On TTL expired: clears both + returns null (caller shows toast).
     */
    suspend fun consumePendingForApp(foregroundApp: String): ConsumeResult {
        val pendingId = pendingContextId ?: return ConsumeResult.NoPending

        val ctx = cached
        if (ctx == null || ctx.contextId != pendingId) {
            // Context missing (shouldn't happen, but defensive)
            clearPending()
            return ConsumeResult.NoPending
        }

        if (ctx.app != foregroundApp) {
            // Not the right app, don't consume yet
            return ConsumeResult.WrongApp
        }

        val now = System.currentTimeMillis()
        if (now - ctx.createdAt >= TTL_MS) {
            // Expired
            clearPending()
            clear()
            Log.i(TAG, "[CONSUME_EXPIRED] id=$pendingId age=${(now - ctx.createdAt) / 1000}s")
            return ConsumeResult.Expired
        }

        // Valid — consume
        val result = ctx.copy()
        clearPending()
        clear()
        Log.i(TAG, "[CONSUME_OK] id=$pendingId app=$foregroundApp cp=${result.sourceCheckpoint}")
        return ConsumeResult.Success(result)
    }

    sealed class ConsumeResult {
        object NoPending : ConsumeResult()
        object WrongApp : ConsumeResult()
        object Expired : ConsumeResult()
        data class Success(val context: ReturnContext) : ConsumeResult()
    }

    // ── Private ──

    private suspend fun clearFromDisk() {
        context.returnContextDataStore.edit { prefs ->
            prefs.remove(KEY_CONTEXT_ID)
            prefs.remove(KEY_SOURCE_CP)
            prefs.remove(KEY_TRIGGER)
            prefs.remove(KEY_SESSION_ID)
            prefs.remove(KEY_APP)
            prefs.remove(KEY_CREATED_AT)
        }
    }
}
