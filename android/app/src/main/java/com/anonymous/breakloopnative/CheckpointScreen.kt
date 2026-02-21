package com.anonymous.breakloopnative

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ── Design Tokens ──
private val BgDark = Color(0xFF1A1A2E)
private val TextPrimary = Color(0xFFE8E8F0)
private val TextMuted = Color(0xFF8888A0)
private val DangerColor = Color(0xFFE87A7A)
private val WarningColor = Color(0xFFE8C77A)
private val PrimaryColor = Color(0xFF7AA0E8)
private val SurfaceDark = Color(0xFF252540)
private val WarningBg = Color(0xFF3D3520)

// ── CP Copy Constants (replaceable) ──
private val CP_MESSAGES = mapOf(
    1 to "Time's up.",
    2 to "Time's up again.",
    3 to "You've gone past your plan twice.",
    4 to "Warning: next time is a 10-minute reset break.",
)
private fun getCpMessage(cpNumber: Int): String {
    return CP_MESSAGES[cpNumber.coerceIn(1, 4)] ?: CP_MESSAGES[4]!!
}

// ── All possible presets ──
private val ALL_PRESETS = listOf(1, 5, 15, 30, 45)

/**
 * CheckpointScreen — CP1-CP4 Compose UI.
 *
 * Props consumed:
 *   checkpointCount: Int  — which CP is being shown (1-4+)
 *   availableTimers: String — comma-separated available minutes "1,5,15,30,45"
 *   hardBreakEnabled: Boolean
 *
 * Emits UserActionEvent only, no flow logic.
 */
@Composable
fun CheckpointScreen(
    app: String,
    sessionId: String,
    props: Map<String, Any>
) {
    val cpNumber = (props["checkpointCount"] as? Int) ?: 1
    val availableTimersStr = (props["availableTimers"] as? String) ?: "1,5,15,30,45"
    val availableMinutes = availableTimersStr.split(",").mapNotNull { it.trim().toIntOrNull() }.toSet()
    val isCP4 = cpNumber >= 4

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = BgDark
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── Header ──
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "⏱",
                    fontSize = 40.sp,
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Checkpoint $cpNumber",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = getCpMessage(cpNumber),
                    fontSize = 16.sp,
                    color = if (isCP4) WarningColor else TextMuted,
                    textAlign = TextAlign.Center
                )
            }

            // ── CP4 Warning Banner ──
            if (isCP4) {
                Spacer(modifier = Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(WarningBg, RoundedCornerShape(12.dp))
                        .border(1.dp, WarningColor.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        text = "⚠️  If you extend again, a 10-minute break will start.",
                        fontSize = 14.sp,
                        color = WarningColor,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ── Timer Presets ──
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Set another timer",
                    fontSize = 14.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    ALL_PRESETS.forEach { minutes ->
                        val enabled = availableMinutes.contains(minutes)
                        TimerPresetChip(
                            minutes = minutes,
                            enabled = enabled,
                            onClick = {
                                if (enabled) {
                                    SystemBrainBridge.enqueue(
                                        RuntimeEvent.UserActionEvent(
                                            surfaceId = SurfaceRouter.Surface.CHECKPOINT,
                                            actionId = "SET_TIMER",
                                            sessionId = sessionId,
                                            payload = minutes.toString()
                                        )
                                    )
                                }
                            }
                        )
                    }
                }
            }

            // ── Action Buttons ──
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Primary: Close app
                Button(
                    onClick = {
                        SystemBrainBridge.enqueue(
                            RuntimeEvent.UserActionEvent(
                                surfaceId = SurfaceRouter.Surface.CHECKPOINT,
                                actionId = "QUIT",
                                sessionId = sessionId
                            )
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = DangerColor),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Close app", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Tertiary: Help me
                Text(
                    text = "I'm stuck — help me",
                    fontSize = 14.sp,
                    color = PrimaryColor,
                    modifier = Modifier
                        .clickable {
                            SystemBrainBridge.enqueue(
                                RuntimeEvent.UserActionEvent(
                                    surfaceId = SurfaceRouter.Surface.CHECKPOINT,
                                    actionId = "HELP_ME",
                                    sessionId = sessionId
                                )
                            )
                        }
                        .padding(8.dp)
                )
            }
        }
    }
}

@Composable
private fun TimerPresetChip(
    minutes: Int,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val label = if (minutes < 60) "${minutes}m" else "${minutes / 60}h"
    Box(
        modifier = Modifier
            .alpha(if (enabled) 1f else 0.4f)
            .background(
                if (enabled) SurfaceDark else Color.Transparent,
                RoundedCornerShape(8.dp)
            )
            .border(
                1.dp,
                if (enabled) PrimaryColor.copy(alpha = 0.4f) else TextMuted.copy(alpha = 0.2f),
                RoundedCornerShape(8.dp)
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (enabled) TextPrimary else TextMuted
        )
    }
}
