package com.anonymous.breakloopnative

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.lang.ref.WeakReference

/**
 * Track B §4.4: Compose-only surface host.
 *
 * Hosts reliability-critical screens: Checkpoints (CP1-4), Hard Break,
 * Emergency Unlock, Face-Down Challenge, Emergency Timer.
 *
 * Does NOT boot the RN bridge — faster launch, lower memory footprint.
 * Same manifest attributes as SystemSurfaceActivity:
 *   taskAffinity="", excludeFromRecents=true, singleInstance, Theme.Intervention
 */
class SystemSurfaceActivityCompose : ComponentActivity() {

    companion object {
        private const val TAG = "SS_COMPOSE"

        // Intent extras
        const val EXTRA_SURFACE_ID = "surfaceId"
        const val EXTRA_APP = "app"
        const val EXTRA_SESSION_ID = "sessionId"

        // Weak reference for external finish (§9.4 Rule 1: OnAppExit)
        private var activeInstance: WeakReference<SystemSurfaceActivityCompose>? = null

        fun finishIfActive(reason: String) {
            val activity = activeInstance?.get()
            if (activity != null && !activity.isFinishing) {
                Log.i(TAG, "[FINISH_EXTERNAL] reason=$reason")
                activity.finishReason = reason
                activity.finish()
            }
        }
    }

    private var currentSurfaceId: String? = null
    private var currentApp: String? = null
    private var currentSessionId: String? = null
    private var finishReason: String = "ACTIVITY_DESTROYED"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        currentSurfaceId = intent?.getStringExtra(EXTRA_SURFACE_ID)
        currentApp = intent?.getStringExtra(EXTRA_APP)
        currentSessionId = intent?.getStringExtra(EXTRA_SESSION_ID)

        val instanceId = System.identityHashCode(this)
        Log.i(TAG, "[onCreate] surface=$currentSurfaceId app=$currentApp session=$currentSessionId instanceId=$instanceId")

        // Register with Manager for lifecycle tracking
        activeInstance = WeakReference(this)
        // Note: SystemSurfaceManager.register expects SystemSurfaceActivity; 
        // Compose activity uses WeakReference + finishIfActive for lifecycle.
        ForegroundDetectionService.onSystemSurfaceOpened(currentApp, currentSessionId, instanceId)

        // Read props from intent extras
        val props = mutableMapOf<String, Any>()
        intent?.extras?.let { extras ->
            for (key in extras.keySet()) {
                if (key.startsWith("prop_")) {
                    val propName = key.removePrefix("prop_")
                    extras.get(key)?.let { props[propName] = it }
                }
            }
        }

        setContent {
            BreakLoopComposeTheme {
                ComposeScreen(
                    surfaceId = currentSurfaceId ?: "UNKNOWN",
                    app = currentApp ?: "",
                    sessionId = currentSessionId ?: "",
                    props = props
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        val instanceId = System.identityHashCode(this)
        Log.i(TAG, "[onDestroy] reason=$finishReason surface=$currentSurfaceId instanceId=$instanceId")

        ForegroundDetectionService.onSystemSurfaceDestroyed(
            app = currentApp,
            sessionId = currentSessionId,
            wakeReason = currentSurfaceId,  // Use surfaceId as wake reason for tracking
            instanceId = instanceId
        )

        if (activeInstance?.get() == this) {
            activeInstance = null
        }
    }

    override fun onStop() {
        super.onStop()
        if (!isFinishing && !isChangingConfigurations) {
            val sessionId = currentSessionId
            if (sessionId != null) {
                Log.i(TAG, "[onStop] Triggering requestClose session=$sessionId")
                SystemSurfaceManager.requestClose(sessionId, "COMPOSE_ACTIVITY_STOP")
            } else {
                finishReason = "COMPOSE_ACTIVITY_STOP_NO_SESSION"
                finish()
            }
        }
    }
}

// ── Design Tokens (§ tokens.md) ──
private val BgDark = Color(0xFF1A1A2E)
private val TextPrimary = Color(0xFFE8E8F0)
private val TextMuted = Color(0xFF8888A0)
private val DangerColor = Color(0xFFE87A7A)
private val WarningColor = Color(0xFFE8C77A)
private val PrimaryColor = Color(0xFF7AA0E8)

private val BreakLoopDarkScheme = darkColorScheme(
    background = BgDark,
    onBackground = TextPrimary,
    primary = PrimaryColor,
    error = DangerColor,
)

@Composable
fun BreakLoopComposeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BreakLoopDarkScheme,
        content = content
    )
}

/**
 * Top-level Compose screen router.
 * Dispatches to the correct screen based on surfaceId.
 */
@Composable
fun ComposeScreen(
    surfaceId: String,
    app: String,
    sessionId: String,
    props: Map<String, Any>
) {
    when (surfaceId) {
        SurfaceRouter.Surface.CHECKPOINT -> CheckpointScreen(app, sessionId, props)
        else -> PlaceholderScreen(surfaceId, app, sessionId, props)
    }
}

/** Placeholder for not-yet-implemented Compose surfaces (Hard Break, Emergency, etc.) */
@Composable
private fun PlaceholderScreen(
    surfaceId: String,
    app: String,
    sessionId: String,
    props: Map<String, Any>
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = surfaceId,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "App: $app",
                fontSize = 14.sp,
                color = TextMuted,
                textAlign = TextAlign.Center
            )
            if (props.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Props: $props",
                    fontSize = 12.sp,
                    color = TextMuted,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
