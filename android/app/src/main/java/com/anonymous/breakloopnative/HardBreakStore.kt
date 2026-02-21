package com.anonymous.breakloopnative

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentHashMap

// ── Track B §5.3: Hard Break per-app + global state ──
private val Context.hardBreakDataStore: DataStore<Preferences> by preferencesDataStore(name = "hard_break_store")

// Per-app runtime state
data class HardBreakAppState(
    val hardBreakEnabled: Boolean = false,
    val hardBreakUntil: Long = 0L,          // epoch ms, 0 = not active
    val emergencyAllowUntil: Long = 0L,     // epoch ms, 0 = not active
    val weeklyOverrideLastUsedAt: Long = 0L // epoch ms
)

// Global emergency quotas
data class EmergencyQuotas(
    val dailyChallengeUsedToday: Boolean = false,
    val emergencyPassBalance: Int = 2,       // Fixed at 2
    val emergencyPassUsedToday: Int = 0      // Max 2/day
)

class HardBreakStore(private val context: Context) {

    companion object {
        private const val TAG = "HARD_BREAK_STORE"

        // Per-app keys (stored as StringSet: "pkg|field=value")
        private val KEY_APP_SET = stringSetPreferencesKey("hard_break_app_set")

        // Global keys
        private val KEY_DAILY_CHALLENGE_USED = booleanPreferencesKey("daily_challenge_used_today")
        private val KEY_DAILY_CHALLENGE_DATE = stringPreferencesKey("daily_challenge_reset_date")
        private val KEY_EMERGENCY_PASS_BALANCE = intPreferencesKey("emergency_pass_balance")
        private val KEY_EMERGENCY_PASS_USED_TODAY = intPreferencesKey("emergency_pass_used_today")
        private val KEY_EMERGENCY_PASS_DATE = stringPreferencesKey("emergency_pass_reset_date")

        private const val INITIAL_PASS_BALANCE = 2
        private const val MAX_PASSES_PER_DAY = 2
        private const val WEEKLY_OVERRIDE_COOLDOWN_MS = 7L * 24 * 60 * 60 * 1000  // 7 days
    }

    // In-memory caches
    private val appCache = ConcurrentHashMap<String, HardBreakAppState>()
    @Volatile private var globalQuotas = EmergencyQuotas()

    // ── Restore from disk ──
    suspend fun restore() {
        val prefs = context.hardBreakDataStore.data.first()

        // Parse per-app state
        appCache.clear()
        val set = prefs[KEY_APP_SET] ?: emptySet()
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

        val now = System.currentTimeMillis()
        byPkg.forEach { (pkg, fields) ->
            appCache[pkg] = HardBreakAppState(
                hardBreakEnabled = fields["enabled"]?.toBoolean() ?: false,
                hardBreakUntil = (fields["hardBreakUntil"]?.toLongOrNull() ?: 0L).let {
                    if (it > now) it else 0L  // Prune expired
                },
                emergencyAllowUntil = (fields["emergencyAllowUntil"]?.toLongOrNull() ?: 0L).let {
                    if (it > now) it else 0L
                },
                weeklyOverrideLastUsedAt = fields["weeklyOverrideLastUsedAt"]?.toLongOrNull() ?: 0L
            )
        }

        // Parse global quotas (with midnight reset)
        val todayStr = todayDateString()
        val challengeDate = prefs[KEY_DAILY_CHALLENGE_DATE] ?: ""
        val passDate = prefs[KEY_EMERGENCY_PASS_DATE] ?: ""

        globalQuotas = EmergencyQuotas(
            dailyChallengeUsedToday = if (challengeDate == todayStr) {
                prefs[KEY_DAILY_CHALLENGE_USED] ?: false
            } else false,
            emergencyPassBalance = prefs[KEY_EMERGENCY_PASS_BALANCE] ?: INITIAL_PASS_BALANCE,
            emergencyPassUsedToday = if (passDate == todayStr) {
                prefs[KEY_EMERGENCY_PASS_USED_TODAY] ?: 0
            } else 0
        )

        Log.i(TAG, "[RESTORE] ${appCache.size} apps, quotas=$globalQuotas")
    }

    // ── Per-App Reads ──

    fun getAppState(pkg: String): HardBreakAppState {
        return appCache[pkg] ?: HardBreakAppState()
    }

    fun isHardBreakEnabled(pkg: String): Boolean {
        return appCache[pkg]?.hardBreakEnabled ?: false
    }

    fun isHardBreakActive(pkg: String): Boolean {
        val state = appCache[pkg] ?: return false
        return state.hardBreakEnabled && state.hardBreakUntil > System.currentTimeMillis()
    }

    fun isEmergencyAllowActive(pkg: String): Boolean {
        val state = appCache[pkg] ?: return false
        return state.emergencyAllowUntil > System.currentTimeMillis()
    }

    // ── Per-App Writes ──

    suspend fun setHardBreakEnabled(pkg: String, enabled: Boolean) {
        val current = getAppState(pkg)
        appCache[pkg] = current.copy(hardBreakEnabled = enabled)
        persistAppState()
        Log.i(TAG, "[SET_ENABLED] pkg=$pkg enabled=$enabled")
    }

    suspend fun setHardBreakUntil(pkg: String, untilMs: Long) {
        val current = getAppState(pkg)
        appCache[pkg] = current.copy(hardBreakUntil = untilMs)
        persistAppState()
        Log.i(TAG, "[SET_HB_UNTIL] pkg=$pkg until=$untilMs deltaMs=${untilMs - System.currentTimeMillis()}")
    }

    suspend fun setEmergencyAllowUntil(pkg: String, untilMs: Long) {
        val current = getAppState(pkg)
        appCache[pkg] = current.copy(emergencyAllowUntil = untilMs)
        persistAppState()
        Log.i(TAG, "[SET_EMER_ALLOW] pkg=$pkg until=$untilMs")
    }

    suspend fun recordWeeklyOverrideUsed(pkg: String) {
        val now = System.currentTimeMillis()
        val current = getAppState(pkg)
        appCache[pkg] = current.copy(weeklyOverrideLastUsedAt = now)
        persistAppState()
        Log.i(TAG, "[WEEKLY_OVERRIDE] pkg=$pkg at=$now")
    }

    // ── Global Quota Reads ──

    fun getEmergencyQuotas(): EmergencyQuotas = globalQuotas

    fun isWeeklyOverrideAvailable(pkg: String): Boolean {
        val lastUsed = appCache[pkg]?.weeklyOverrideLastUsedAt ?: 0L
        return (System.currentTimeMillis() - lastUsed) >= WEEKLY_OVERRIDE_COOLDOWN_MS
    }

    fun isDailyChallengeAvailable(): Boolean = !globalQuotas.dailyChallengeUsedToday

    fun isEmergencyPassAvailable(): Boolean {
        return globalQuotas.emergencyPassBalance > 0 &&
               globalQuotas.emergencyPassUsedToday < MAX_PASSES_PER_DAY
    }

    // ── Global Quota Writes ──

    suspend fun consumeDailyChallenge() {
        globalQuotas = globalQuotas.copy(dailyChallengeUsedToday = true)
        persistGlobalQuotas()
        Log.i(TAG, "[DAILY_CHALLENGE_USED]")
    }

    suspend fun consumeEmergencyPass(): Boolean {
        if (!isEmergencyPassAvailable()) return false
        globalQuotas = globalQuotas.copy(
            emergencyPassBalance = globalQuotas.emergencyPassBalance - 1,
            emergencyPassUsedToday = globalQuotas.emergencyPassUsedToday + 1
        )
        persistGlobalQuotas()
        Log.i(TAG, "[PASS_USED] remaining=${globalQuotas.emergencyPassBalance} usedToday=${globalQuotas.emergencyPassUsedToday}")
        return true
    }

    // ── Persistence Helpers ──

    private suspend fun persistAppState() {
        val set = mutableSetOf<String>()
        appCache.forEach { (pkg, state) ->
            set.add("$pkg|enabled=${state.hardBreakEnabled}")
            if (state.hardBreakUntil > 0L) set.add("$pkg|hardBreakUntil=${state.hardBreakUntil}")
            if (state.emergencyAllowUntil > 0L) set.add("$pkg|emergencyAllowUntil=${state.emergencyAllowUntil}")
            if (state.weeklyOverrideLastUsedAt > 0L) set.add("$pkg|weeklyOverrideLastUsedAt=${state.weeklyOverrideLastUsedAt}")
        }
        context.hardBreakDataStore.edit { preferences ->
            preferences[KEY_APP_SET] = set
        }
    }

    private suspend fun persistGlobalQuotas() {
        val today = todayDateString()
        context.hardBreakDataStore.edit { preferences ->
            preferences[KEY_DAILY_CHALLENGE_USED] = globalQuotas.dailyChallengeUsedToday
            preferences[KEY_DAILY_CHALLENGE_DATE] = today
            preferences[KEY_EMERGENCY_PASS_BALANCE] = globalQuotas.emergencyPassBalance
            preferences[KEY_EMERGENCY_PASS_USED_TODAY] = globalQuotas.emergencyPassUsedToday
            preferences[KEY_EMERGENCY_PASS_DATE] = today
        }
    }

    private fun todayDateString(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return sdf.format(Date())
    }
}
