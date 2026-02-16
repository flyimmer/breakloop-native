package com.anonymous.breakloopv0

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.util.concurrent.ConcurrentHashMap

// Separate DataStore for Intentions
private val Context.intentionDataStore: DataStore<Preferences> by preferencesDataStore(name = "intention_store")

class IntentionStore(private val context: Context) {

    companion object {
        private val KEY_INTENTION_SET = stringSetPreferencesKey("intention_set") // Format: "pkg|untilMs"
    }

    // In-memory cache for zero-blocking reads
    private val memoryCache = ConcurrentHashMap<String, Long>()

    // Initialize cache from disk (Suspend function, call on Service start)
    suspend fun restore() {
        val prefs = context.intentionDataStore.data.first()
        val set = prefs[KEY_INTENTION_SET] ?: emptySet()
        
        val now = System.currentTimeMillis()
        val validEntries = mutableMapOf<String, Long>()

        set.forEach { entry ->
            val parts = entry.split("|")
            if (parts.size == 2) {
                val pkg = parts[0]
                val until = parts[1].toLongOrNull() ?: 0L
                if (until > now) {
                    validEntries[pkg] = until
                }
            }
        }
        
        // Update cache
        memoryCache.clear()
        memoryCache.putAll(validEntries)
        
        // If we pruned expired entries, persist usage immediately to clean up disk
        if (validEntries.size != set.size) {
            persist(validEntries)
        }
    }

    fun getSnapshot(): Map<String, Long> {
        return HashMap(memoryCache)
    }
    
    fun getIntention(pkg: String): Long {
        return memoryCache[pkg] ?: 0L
    }

    suspend fun setIntention(pkg: String, untilMs: Long) {
        // 1. Update RAM immediately
        memoryCache[pkg] = untilMs
        
        // 2. Persist Async
        persist(memoryCache.toMap())
    }

    suspend fun clearIntention(pkg: String) {
        // 1. Update RAM immediately
        memoryCache.remove(pkg)
        
        // 2. Persist Async
        persist(memoryCache.toMap())
    }
    
    // Helper to persist current state as StringSet
    private suspend fun persist(map: Map<String, Long>) {
        val set = map.map { "${it.key}|${it.value}" }.toSet()
        context.intentionDataStore.edit { preferences ->
            preferences[KEY_INTENTION_SET] = set
        }
    }
}
