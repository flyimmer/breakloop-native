/**
 * App Categories
 *
 * Defines the category taxonomy used by BreakLoop and provides two-layer resolution:
 *   1. Static lookup table  ← HIGHEST PRIORITY (our curated intent wins)
 *   2. Native Android category (API 26+) — used only when app is not in static table
 *
 * The resolved category is stored on `DiscoveredApp.appCategory` and later surfaced to
 * the intervention flow via `interventionState.triggerAppCategory`, enabling the
 * (future) "purpose session" screen to tailor its prompt per category.
 *
 * UI display collapses the taxonomy to just two buckets:
 *   "Social"  → appCategory === 'social'
 *   "Others"  → everything else (video, game, audio, productivity, other, …)
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Full internal category taxonomy used by BreakLoop.
 *
 * - `social`  — Social networking, messaging, and short-video social apps
 * - `video`   — Long-form video streaming (YouTube, Netflix, Twitch, …)
 * - `other`   — Anything that doesn't map to a specific category
 */
export type AppCategory = 'social' | 'video' | 'other';

/**
 * Simplified display category shown to the user in the Monitored Apps screen.
 *
 * - `'Social'`  — apps whose internal category is 'social'
 * - `'Others'`  — everything else (video, game, audio, productivity, other, …)
 */
export type DisplayCategory = 'Social' | 'Others';

// ---------------------------------------------------------------------------
// Static lookup table  (HIGHEST PRIORITY — our curated intent wins)
// ---------------------------------------------------------------------------

/**
 * Mapping of well-known package names → BreakLoop category.
 *
 * This table is checked FIRST before the Android native category.
 * This ensures our deliberate classification is never overridden by whatever
 * the app developer chose to declare in their manifest.
 *
 * For example, TikTok is classified as 'social' here because its dominant
 * use-case in BreakLoop is social scrolling, even if Android tags it VIDEO.
 *
 * To add a new app, simply append its package name with the correct category.
 */
export const APP_CATEGORY_STATIC: Record<string, AppCategory> = {
    // ── Social ──────────────────────────────────────────────────────────────
    'com.instagram.android': 'social',   // Instagram
    'com.twitter.android': 'social',   // X / Twitter
    'com.facebook.katana': 'social',   // Facebook
    'com.facebook.orca': 'social',   // Messenger
    'com.snapchat.android': 'social',   // Snapchat
    'com.zhiliaoapp.musically': 'social',   // TikTok (global)
    'com.ss.android.ugc.tiktok': 'social',   // TikTok (some regions)
    'com.reddit.frontpage': 'social',   // Reddit
    'com.linkedin.android': 'social',   // LinkedIn
    'com.pinterest': 'social',   // Pinterest
    'com.tumblr': 'social',   // Tumblr
    'com.discord': 'social',   // Discord
    'com.whatsapp': 'social',   // WhatsApp
    'org.telegram.messenger': 'social',   // Telegram
    'im.tmate.messenger': 'social',   // Kik
    'com.xingin.xhs': 'social',   // Xiaohongshu / RedNote
    'com.weibo.android': 'social',   // Weibo
    'com.ss.android.welike': 'social',   // Welike (ByteDance social)
    'tv.bigo.live': 'social',   // Bigo Live

    // ── Video ────────────────────────────────────────────────────────────────
    'com.google.android.youtube': 'video',    // YouTube (standard pkg)
    'com.youtube.android': 'video',    // YouTube (alt pkg)
    'com.youtube': 'video',    // YouTube (alt pkg)
    'com.netflix.mediaclient': 'video',    // Netflix
    'com.amazon.avod.thirdpartyclient': 'video',    // Amazon Prime Video
    'com.hulu.plus': 'video',    // Hulu
    'com.disneyplus': 'video',    // Disney+
    'com.apple.atve.androidtv.appletv': 'video',    // Apple TV
    'com.twitch.android.app': 'video',    // Twitch
    'tv.twitch.android.app': 'video',    // Twitch (alt)
    'com.bilibili.app.phone': 'video',    // Bilibili
    'tv.danmaku.bili': 'video',    // Bilibili (alt)
    'com.duokan.phone.remotecontroller': 'video',    // iQIYI
    'com.iqiyi.i18n': 'video',    // iQIYI International
    'com.youku.phone': 'video',    // Youku
    'com.qiyi.video': 'video',    // iQIYI (another variant)
    'com.mxtech.videoplayer.ad': 'video',    // MX Player
    'com.dailymotion.dailymotion': 'video',    // Dailymotion
    'com.vimeo.android.videoapp': 'video',    // Vimeo
};

// ---------------------------------------------------------------------------
// Category resolution helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw Android native category key (returned by AppDiscoveryModule.kt)
 * to a BreakLoop `AppCategory`.
 *
 * Used ONLY as a fallback when the package is NOT in `APP_CATEGORY_STATIC`.
 */
function nativeCategoryToAppCategory(nativeCategory: string | null | undefined): AppCategory | null {
    switch (nativeCategory) {
        case 'social': return 'social';
        case 'video': return 'video';
        default: return null; // not actionable — caller falls through to 'other'
    }
}

/**
 * Resolve the BreakLoop category for a given package name.
 *
 * Resolution order (highest priority first):
 *   1. `APP_CATEGORY_STATIC` lookup table   ← our curated intent always wins
 *   2. `nativeCategory` from Android PackageManager (API 26+)
 *   3. `'other'` as the final default
 *
 * @param packageName    - Android package name (e.g. 'com.instagram.android')
 * @param nativeCategory - Raw category key from native module, or null/undefined
 * @returns Resolved `AppCategory`
 */
export function resolveAppCategory(
    packageName: string,
    nativeCategory?: string | null,
): AppCategory {
    // 1. Static table wins — our curated classification takes priority
    const fromStatic = APP_CATEGORY_STATIC[packageName];
    if (fromStatic) {
        return fromStatic;
    }

    // 2. Fall back to native Android category (API 26+)
    const fromNative = nativeCategoryToAppCategory(nativeCategory);
    if (fromNative !== null) {
        return fromNative;
    }

    // 3. Default
    return 'other';
}

/**
 * Get the simplified display category shown in the Monitored Apps UI.
 *
 * Maps the full internal taxonomy down to just two user-facing buckets:
 *   'Social'  → apps explicitly categorised as 'social'
 *   'Others'  → video, game, audio, productivity, other, …
 *
 * Uses the static table first (same priority as resolveAppCategory).
 * Pass `appCategory` from `DiscoveredApp` if already resolved; otherwise
 * the function performs an instant static-only lookup (no async needed).
 *
 * @param packageName   - Android package name
 * @param appCategory   - Already-resolved AppCategory (optional shortcut)
 * @returns DisplayCategory for UI rendering
 */
export function getDisplayCategory(
    packageName: string,
    appCategory?: AppCategory,
): DisplayCategory {
    const category = appCategory ?? resolveAppCategory(packageName, null);
    return category === 'social' ? 'Social' : 'Others';
}
