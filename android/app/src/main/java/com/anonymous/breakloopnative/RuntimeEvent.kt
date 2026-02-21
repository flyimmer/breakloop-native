package com.anonymous.breakloopnative

/**
 * Track B §6.1: Internal runtime events.
 * Emitted by event sources (FDS, timers, UI), consumed by SystemBrainService.
 * NOT JS-facing — these stay entirely in Kotlin.
 */
sealed class RuntimeEvent {

    /** Monitored app A entered foreground. Source: ForegroundDetectionService. */
    data class ForegroundEntry(val app: String) : RuntimeEvent()

    /** Monitored app A left foreground (§9.4 Rule 1). Source: ForegroundDetectionService.
     *  Emitted on transition to SystemUI, launcher, BreakLoop itself, OR other non-monitored apps. */
    data class AppExit(val app: String) : RuntimeEvent()

    /** A scheduled timer expired. Source: Handler / AlarmManager callbacks.
     *  expectedUntilMs is the stale-expiry guard: must match persisted untilMs to act. */
    data class TimerExpired(
        val kind: TimerKind,
        val app: String,
        val expectedUntilMs: Long
    ) : RuntimeEvent()

    /** User performed an action on a surface. Source: AppMonitorModule (RN) or Compose callback. */
    data class UserActionEvent(
        val surfaceId: String,
        val actionId: String,
        val sessionId: String,
        val payload: String? = null
    ) : RuntimeEvent()
}

enum class TimerKind {
    INTENTION,
    QUICK_TASK,
    HARD_BREAK,
    EMERGENCY_ALLOW
}

/** Renderer type for surface routing (§4.4 Option A). */
enum class Renderer {
    RN,
    COMPOSE
}

/**
 * Model passed to surfaces for rendering. UI is a dumb renderer of this model.
 * All flow logic stays in controllers.
 */
data class SurfaceModel(
    val surfaceId: String,
    val renderer: Renderer,
    val app: String,
    val sessionId: String,
    val props: Map<String, Any> = emptyMap()
)
