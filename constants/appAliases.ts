/**
 * App Search Aliases
 * 
 * Maps package names to search aliases for better search experience.
 * When a user searches for any alias, the app will be found even if
 * the app name doesn't match exactly.
 * 
 * Example: Searching "X" will find Twitter app (com.twitter.android)
 * even if the app is still named "Twitter" in the system.
 */

export const APP_SEARCH_ALIASES: Record<string, string[]> = {
  // Twitter/X - rebranded from Twitter to X
  'com.twitter.android': ['twitter', 'x'],
  
  // Instagram - commonly called "IG"
  'com.instagram.android': ['instagram', 'ig'],
  
  // TikTok - has multiple package names (older: musically, newer: ss.android)
  'com.zhiliaoapp.musically': ['tiktok', 'musically'],
  'com.ss.android.ugc.tiktok': ['tiktok', 'musically'],
  
  // Facebook - main app
  'com.facebook.katana': ['facebook', 'fb'],
  
  // Facebook Messenger - separate app
  'com.facebook.orca': ['messenger', 'fb messenger', 'facebook messenger'],
  
  // Snapchat - commonly called "Snap"
  'com.snapchat.android': ['snapchat', 'snap'],
  
  // Reddit
  'com.reddit.frontpage': ['reddit'],
  
  // YouTube - has multiple package name variations
  'com.youtube.android': ['youtube', 'yt'],
  'com.google.android.youtube': ['youtube', 'yt'],
  'com.youtube': ['youtube', 'yt'],
  
  // WhatsApp - commonly called "WA"
  'com.whatsapp': ['whatsapp', 'wa'],
};

/**
 * Get all search aliases for a given package name
 */
export function getAppSearchAliases(packageName: string): string[] {
  return APP_SEARCH_ALIASES[packageName] || [];
}

/**
 * Check if a search query matches an app (including aliases)
 * 
 * @param appName - The app's display name
 * @param packageName - The app's package name
 * @param searchQuery - The user's search query
 * @returns true if the search query matches the app or any of its aliases
 */
export function matchesAppSearch(
  appName: string,
  packageName: string,
  searchQuery: string
): boolean {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return true;

  // Check app name
  if (appName.toLowerCase().includes(query)) {
    return true;
  }

  // Check package name
  if (packageName.toLowerCase().includes(query)) {
    return true;
  }

  // Check aliases (bidirectional matching for flexibility)
  const aliases = getAppSearchAliases(packageName);
  for (const alias of aliases) {
    // Check if query matches alias (partial match) or vice versa
    if (alias.includes(query) || query.includes(alias)) {
      return true;
    }
  }

  return false;
}
