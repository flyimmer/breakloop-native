package com.anonymous.breakloopv0

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

// Separate DataStore for Monitored Apps (or share file, but separating is cleaner for migration)
private val Context.monitoredAppsDataStore: DataStore<Preferences> by preferencesDataStore(name = "monitored_apps_store")

class MonitoredAppsStore(private val context: Context) {

    companion object {
        private val KEY_MONITORED_APPS = stringSetPreferencesKey("monitored_apps")
    }

    suspend fun getMonitoredApps(): Set<String> {
        val prefs = context.monitoredAppsDataStore.data.first()
        return prefs[KEY_MONITORED_APPS] ?: emptySet()
    }

    suspend fun setMonitoredApps(apps: Set<String>): Set<String> {
        val prefs = context.monitoredAppsDataStore.edit { preferences ->
            preferences[KEY_MONITORED_APPS] = apps
        }
        return prefs[KEY_MONITORED_APPS] ?: emptySet()
    }
}
