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
 * Match type for sorting purposes
 */
export enum MatchType {
  NONE = 0,
  PARTIAL_MIDDLE = 1,      // Query appears in middle of word
  PARTIAL_START = 2,        // Query matches from start of word
  EXACT_ALIAS = 3,          // Query exactly matches an alias
  EXACT_APP_NAME = 4,       // Query exactly matches app name
}

/**
 * Get match type and relevance score for sorting
 * Higher score = better match (should appear first)
 * 
 * @param appName - The app's display name
 * @param packageName - The app's package name
 * @param searchQuery - The user's search query
 * @returns Object with matchType and score
 */
export function getMatchScore(
  appName: string,
  packageName: string,
  searchQuery: string
): { matchType: MatchType; score: number } {
  const query = searchQuery.toLowerCase().trim();
  if (!query) {
    return { matchType: MatchType.NONE, score: 0 };
  }

  const appNameLower = appName.toLowerCase();
  const packageNameLower = packageName.toLowerCase();

  // Check exact app name match (highest priority)
  if (appNameLower === query) {
    return { matchType: MatchType.EXACT_APP_NAME, score: 1000 };
  }

  // Check exact alias match (second highest priority)
  const aliases = getAppSearchAliases(packageName);
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    if (aliasLower === query) {
      return { matchType: MatchType.EXACT_ALIAS, score: 900 };
    }
  }

  // Check word-start matches (query matches from beginning of word)
  // Check app name word-start
  if (appNameLower.startsWith(query)) {
    return { matchType: MatchType.PARTIAL_START, score: 500 };
  }
  // Check if query matches start of any word in app name
  const appNameWords = appNameLower.split(/\s+/);
  for (const word of appNameWords) {
    if (word.startsWith(query)) {
      return { matchType: MatchType.PARTIAL_START, score: 450 };
    }
  }
  // Check alias word-start
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    if (aliasLower.startsWith(query)) {
      return { matchType: MatchType.PARTIAL_START, score: 400 };
    }
  }
  // Check package name word-start (lower priority)
  const packageWords = packageNameLower.split(/\./);
  for (const word of packageWords) {
    if (word.startsWith(query)) {
      return { matchType: MatchType.PARTIAL_START, score: 350 };
    }
  }

  // Check partial matches (query appears anywhere, including middle)
  // App name partial match
  if (appNameLower.includes(query)) {
    return { matchType: MatchType.PARTIAL_MIDDLE, score: 200 };
  }
  // Alias partial match
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    if (aliasLower.includes(query)) {
      return { matchType: MatchType.PARTIAL_MIDDLE, score: 150 };
    }
    // Reverse: query contains alias (for longer queries)
    if (query.length > aliasLower.length && query.includes(aliasLower)) {
      return { matchType: MatchType.PARTIAL_MIDDLE, score: 100 };
    }
  }
  // Package name partial match (lowest priority)
  if (packageNameLower.includes(query)) {
    return { matchType: MatchType.PARTIAL_MIDDLE, score: 50 };
  }

  return { matchType: MatchType.NONE, score: 0 };
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
  const { matchType } = getMatchScore(appName, packageName, searchQuery);
  return matchType !== MatchType.NONE;
}
