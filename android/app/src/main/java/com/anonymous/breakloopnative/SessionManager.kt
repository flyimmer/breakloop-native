package com.anonymous.breakloopnative

import android.util.Log
import java.util.UUID

/**
 * SessionManager - Single Source of Truth for Overlay Lifecycle
 *
 * RESPONSIBILITIES:
 * 1. Maintain the "Single Overlay" invariant (never 2 overlays at once)
 * 2. Manage lifecycle: INACTIVE -> STARTING -> ACTIVE -> INACTIVE
 * 3. Prevent "Ghost Sessions" via automatic staleness checks
 * 4. Generate unique Session IDs for end-to-end tracking
 */
object SessionManager {
    private const val TAG = "SessionManager"
    private const val STALE_START_TIMEOUT_MS = 3000L // 3 Seconds to launch or bust

    enum class Kind {
        QUICK_TASK,
        INTERVENTION,
        POST_CHOICE_RECOVERY,
        // Track B
        HARD_BREAK,
        CHECKPOINT
    }

    enum class OverlayState {
        INACTIVE,
        STARTING,
        ACTIVE
    }

    data class Session(
        val sessionId: String,
        val pkg: String,
        val kind: Kind,
        val startedAtMs: Long
    )

    sealed class StartDecision {
        data class Start(val sessionId: String) : StartDecision()
        data class Suppress(val reason: String) : StartDecision()
    }

    private var currentSession: Session? = null
    private var overlayState: OverlayState = OverlayState.INACTIVE
    private var startingSinceMs: Long = 0L

    @Synchronized
    fun tryStart(pkg: String, kind: Kind, nowMs: Long): StartDecision {
        // 1. Ghost Session Check (Watchdog)
        if (overlayState == OverlayState.STARTING) {
            val elapsed = nowMs - startingSinceMs
            if (elapsed > STALE_START_TIMEOUT_MS) {
                Log.w(TAG, "[SESSION_WATCHDOG] Resetting STALE session in STARTING state (age=${elapsed}ms)")
                resetState("WATCHDOG_RESET")
            }
        }

        // 2. Active Session Suppression
        if (overlayState != OverlayState.INACTIVE) {
            val session = currentSession
            val reason = if (session?.pkg == pkg) "ALREADY_ACTIVE_SAME_APP" else "ALREADY_ACTIVE_OTHER_APP"
            Log.d(TAG, "[SESSION] SUPPRESSED pkg=$pkg reason=$reason state=$overlayState current=${session?.pkg}")
            return StartDecision.Suppress(reason)
        }

        // 3. Start New Session
        val newSessionId = UUID.randomUUID().toString()
        currentSession = Session(newSessionId, pkg, kind, nowMs)
        overlayState = OverlayState.STARTING
        startingSinceMs = nowMs
        
        Log.i(TAG, "[SESSION] START new_session=$newSessionId pkg=$pkg kind=$kind")
        return StartDecision.Start(newSessionId)
    }

    @Synchronized
    fun onOverlayShown(sessionId: String) {
        val session = currentSession
        
        if (session == null) {
            Log.w(TAG, "[SESSION] onOverlayShown ignored - No current session (sessionId=$sessionId)")
            return
        }

        if (session.sessionId != sessionId) {
            Log.w(TAG, "[SESSION] onOverlayShown mismatch! current=${session.sessionId} received=$sessionId")
            return
        }

        if (overlayState == OverlayState.STARTING) {
            overlayState = OverlayState.ACTIVE
            startingSinceMs = 0L
            Log.i(TAG, "[SESSION] ACTIVE sessionId=$sessionId pkg=${session.pkg}")
        }
    }

    @Synchronized
    fun endSession(sessionId: String, reason: String): Session? {
        val session = currentSession
        
        if (session == null) {
            // Already inactive, harmless
            return null
        }

        if (session.sessionId != sessionId) {
            // Don't kill specific valid session if a stale end request comes in
            Log.w(TAG, "[SESSION] endSession mismatch ignored. current=${session.sessionId} received=$sessionId reason=$reason")
            return null
        }

        Log.i(TAG, "[SESSION] END sessionId=$sessionId pkg=${session.pkg} reason=$reason")
        resetState(reason)
        return session
    }

    private fun resetState(reason: String) {
        currentSession = null
        overlayState = OverlayState.INACTIVE
        startingSinceMs = 0L
    }
    
    @Synchronized
    fun getCurrentSessionId(): String? = currentSession?.sessionId

    @Synchronized
    fun getCurrentSession(): Session? = currentSession
    
    @Synchronized
    fun getOverlayState(): OverlayState = overlayState
    
    // For Debugging / Logging
    fun getStateDescription(): String = "$overlayState point=${currentSession?.pkg}"
}
