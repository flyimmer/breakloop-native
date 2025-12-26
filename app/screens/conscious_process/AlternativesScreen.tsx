import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIntervention } from '@/src/contexts/InterventionProvider';

/**
 * AlternativesScreen
 * 
 * Phase D: Static Intervention → Alternatives step (Step 6)
 * 
 * Gravity: Mixed-mode screen
 * - Header: Reflective Float (context framing)
 * - Tabs: Discover (default), AI For You, My List
 * - Tab content gravity varies by tab intent:
 *   - Discover: Grounded Transition (calm redirection)
 *   - AI For You: Reflective Float (assisted sourcing)
 *   - My List: Reflective Float (personal reflection)
 * - Override action: Heavy Override ("Ignore & Continue")
 * 
 * Design authority:
 * - design/principles/interaction-gravity.md
 * - design/ui/tokens.md
 * - design/ui/tone-ambient-hearth.md
 */

// Tab definitions (authoritative order)
const TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'ai-for-you', label: 'AI For You' },
  { id: 'my-list', label: 'My List' },
] as const;

type TabId = typeof TABS[number]['id'];

// Static placeholder data for Discover tab
const DISCOVER_ALTERNATIVES = [
  {
    id: 'power-nap',
    title: 'Power Nap',
    description: 'Set timer for 15-45 minutes.',
    duration: '30m',
    distance: '500km',
    points: '9000',
  },
  {
    id: 'pomodoro-break',
    title: 'Pomodoro Break',
    description: 'Take a regular break.',
    duration: '5m',
    distance: '500km',
    points: '2100',
  },
  {
    id: 'short-walk',
    title: 'Short Walk',
    description: 'Go around your house.',
    duration: '10m',
    distance: '500km',
    points: '1100',
  },
];

// Static placeholder data for AI For You tab
const AI_SUGGESTIONS = [
  {
    id: 'morning-mood-board',
    title: 'Morning Mood Board',
    description: 'Create a visual representation of your desired mood for the day to combat boredom and fatigue.',
    duration: '15m',
    source: 'ai' as const,
  },
  {
    id: 'mindful-stretches',
    title: 'Mindful Morning Stretches',
    description: 'Gently awaken your body and mind with a short stretching routine to alleviate fatigue.',
    duration: '10m',
    source: 'ai' as const,
  },
  {
    id: 'connect-hans',
    title: 'Connect with Hans',
    description: 'Send Hans a message and see if he\'s up for a quick chat or activity.',
    duration: '5m',
    source: 'ai' as const,
  },
];

// Type for saved activities
type SavedActivity = {
  id: string;
  title: string;
  description: string;
  duration: string;
  distance?: string;
  points?: string;
  source: 'discover' | 'ai';
};

export default function AlternativesScreen() {
  const { interventionState, dispatchIntervention } = useIntervention();
  const { selectedCauses, selectedAlternative } = interventionState;

  // Local state for tabs and saved activities (not in intervention context)
  const [activeTab, setActiveTab] = useState<TabId>('discover');
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);

  // Save an activity to My List (local state only)
  const saveActivity = (activity: SavedActivity) => {
    setSavedActivities((prev) => {
      // Prevent duplicates
      if (prev.some((item) => item.id === activity.id)) {
        return prev;
      }
      return [...prev, activity];
    });
  };

  // Check if an activity is already saved (local state only)
  const isSaved = (activityId: string) => {
    return savedActivities.some((item) => item.id === activityId);
  };

  // Format selected causes for header display
  const formatSelectedCauses = () => {
    if (selectedCauses.length === 0) return '';
    const causeLabels: { [key: string]: string } = {
      'boredom': 'Boredom',
      'anxiety': 'Anxiety',
      'fatigue': 'Fatigue',
      'loneliness': 'Loneliness',
      'self-doubt': 'Self-doubt',
      'no-goal': 'No clear goal',
    };
    return selectedCauses.map(id => causeLabels[id] || id).join(', ');
  };

  // Handle card tap - dispatches actions to transition to 'action' state (details screen)
  // First selects the alternative, then commits to action state
  // Note: useReducer processes actions synchronously, so we can dispatch both in sequence
  const handleCardTap = (alternative: any) => {
    // First select the alternative (sets selectedAlternative in context)
    dispatchIntervention({
      type: 'SELECT_ALTERNATIVE',
      alternative,
    });
    // Then proceed to action state (details screen)
    // useReducer processes actions synchronously, so this will see the updated selectedAlternative
    dispatchIntervention({ type: 'PROCEED_TO_ACTION' });
    // Navigation will react to state change to 'action'
  };

  // Handle cancel/reset - dispatches RESET_INTERVENTION action
  const handleIgnoreAndContinue = () => {
    dispatchIntervention({ type: 'RESET_INTERVENTION' });
    // Navigation will react to state change to 'idle'
  };

  // Handle "Add your own idea" - dispatches action to create custom alternative
  // TODO: This action needs to be properly implemented in the reducer
  const handleAddCustomAlternative = () => {
    dispatchIntervention({ type: 'CREATE_CUSTOM_ALTERNATIVE' });
  };

  // Handle "Get inspired by AI" - dispatches action to regenerate AI suggestions
  // TODO: This action needs to be properly implemented in the reducer
  const handleRegenerateAI = () => {
    dispatchIntervention({ type: 'REGENERATE_AI_SUGGESTIONS' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header: Reflective Float (context framing, non-urgent) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alternatives</Text>
        <Text style={styles.headerSubline}>
          {selectedCauses.length > 0 ? `Feeling: ${formatSelectedCauses()}` : 'Feeling: —'}
        </Text>
      </View>

      {/* Tabs: Calm, non-competing */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Text style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'discover' && (
          <DiscoverTab 
            saveActivity={saveActivity} 
            isSaved={isSaved}
            onCardTap={handleCardTap}
          />
        )}
        {activeTab === 'ai-for-you' && (
          <AIForYouTab 
            saveActivity={saveActivity} 
            isSaved={isSaved}
            onCardTap={handleCardTap}
            onRegenerateAI={handleRegenerateAI}
          />
        )}
        {activeTab === 'my-list' && (
          <MyListTab 
            savedActivities={savedActivities}
            onCardTap={handleCardTap}
            onAddCustomAlternative={handleAddCustomAlternative}
            onRegenerateAI={handleRegenerateAI}
          />
        )}
      </ScrollView>

      {/* Heavy Override: "Ignore & Continue" - visually muted, not bottom-primary */}
      <View style={styles.overrideContainer}>
        <Pressable
          onPress={handleIgnoreAndContinue}
          style={({ pressed }) => [
            styles.overrideButton,
            pressed && styles.overrideButtonPressed,
          ]}
        >
          <Text style={styles.overrideButtonText}>Ignore & Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * Discover Tab
 * Gravity: Grounded Transition (calm redirection)
 * - Cards feel like suggestions, not actions
 * - No ranking language, no social proof emphasis
 * - "Plan this activity" is secondary
 * - Save affordance is subtle and optional
 */
function DiscoverTab({ 
  saveActivity, 
  isSaved,
  onCardTap,
}: { 
  saveActivity: (activity: SavedActivity) => void;
  isSaved: (activityId: string) => boolean;
  onCardTap: (alternative: any) => void;
}) {
  return (
    <View style={styles.tabContent}>
      {DISCOVER_ALTERNATIVES.map((alt) => {
        const saved = isSaved(alt.id);
        return (
          <Pressable
            key={alt.id}
            onPress={() => onCardTap(alt)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            {/* Card metadata: distance and points (visually quiet) */}
            <View style={styles.cardMeta}>
              <View style={styles.cardMetaItem}>
                <Text style={styles.cardMetaIcon}>📍</Text>
                <Text style={styles.cardMetaText}>{alt.distance}</Text>
              </View>
              <View style={styles.cardMetaItem}>
                <Text style={styles.cardMetaIcon}>🔥</Text>
                <Text style={styles.cardMetaText}>{alt.points}</Text>
              </View>
              {/* Save to My List affordance: icon + text label, secondary */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card tap
                  if (!saved) {
                    saveActivity({
                      id: alt.id,
                      title: alt.title,
                      description: alt.description,
                      duration: alt.duration,
                      distance: alt.distance,
                      points: alt.points,
                      source: 'discover',
                    });
                  }
                }}
                disabled={saved}
                style={({ pressed }) => [
                  styles.cardSaveButton,
                  pressed && !saved && styles.cardSaveButtonPressed,
                ]}
              >
                <Text style={[
                  styles.cardSaveIcon,
                  saved && styles.cardSaveIconSaved,
                ]}>
                  {saved ? '⬇' : '⬇'}
                </Text>
                <Text style={[
                  styles.cardSaveLabel,
                  saved && styles.cardSaveLabelSaved,
                ]}>
                  {saved ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Card content */}
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{alt.title}</Text>
                <Text style={styles.cardDuration}>{alt.duration}</Text>
              </View>
              <Text style={styles.cardDescription}>{alt.description}</Text>
              <Text style={styles.cardFlexibleTiming}>Flexible timing</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Pagination hint (static, no logic) */}
      <View style={styles.pagination}>
        <Text style={styles.paginationText}>Previous</Text>
        <Text style={styles.paginationText}>Next Page</Text>
      </View>
    </View>
  );
}

/**
 * AI For You Tab
 * Gravity: Reflective Float (assisted sourcing)
 * - AI-generated label (neutral, non-authoritative)
 * - Regenerate affordance (visually quiet)
 * - Cards feel provisional, safe to browse
 * - Save affordance is subtle and optional
 */
function AIForYouTab({
  saveActivity,
  isSaved,
  onCardTap,
  onRegenerateAI,
}: {
  saveActivity: (activity: SavedActivity) => void;
  isSaved: (activityId: string) => boolean;
  onCardTap: (alternative: any) => void;
  onRegenerateAI: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Context label + regenerate */}
      <View style={styles.aiHeader}>
        <Text style={styles.aiContext}>CONTEXT: MUNICH, SUNNY</Text>
        <Pressable
          onPress={onRegenerateAI}
          style={({ pressed }) => [
            styles.regenerateButton,
            pressed && styles.regenerateButtonPressed,
          ]}
        >
          <Text style={styles.regenerateIcon}>🔄</Text>
          <Text style={styles.regenerateText}>Regenerate</Text>
        </Pressable>
      </View>

      {/* AI suggestion cards */}
      {AI_SUGGESTIONS.map((suggestion) => {
        const saved = isSaved(suggestion.id);
        return (
          <Pressable
            key={suggestion.id}
            onPress={() => onCardTap(suggestion)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            {/* AI suggestion badge + save affordance */}
            <View style={styles.cardBadgeRow}>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeIcon}>✨</Text>
                <Text style={styles.cardBadgeText}>AI Suggestion</Text>
              </View>
              {/* Save to My List affordance: icon + text label, secondary */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card tap
                  if (!saved) {
                    saveActivity({
                      id: suggestion.id,
                      title: suggestion.title,
                      description: suggestion.description,
                      duration: suggestion.duration,
                      source: 'ai',
                    });
                  }
                }}
                disabled={saved}
                style={({ pressed }) => [
                  styles.cardSaveButton,
                  pressed && !saved && styles.cardSaveButtonPressed,
                ]}
              >
                <Text style={[
                  styles.cardSaveIcon,
                  saved && styles.cardSaveIconSaved,
                ]}>
                  {saved ? '⬇' : '⬇'}
                </Text>
                <Text style={[
                  styles.cardSaveLabel,
                  saved && styles.cardSaveLabelSaved,
                ]}>
                  {saved ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Card content */}
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{suggestion.title}</Text>
                <Text style={styles.cardDuration}>{suggestion.duration}</Text>
              </View>
              <Text style={styles.cardDescription}>{suggestion.description}</Text>
              <Text style={styles.cardFlexibleTiming}>Flexible timing</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * My List Tab
 * Gravity: Reflective Float (personal reflection)
 * - Saved items feel familiar and owned
 * - Management icons (edit/delete) are visually quiet
 * - "Add your own idea" and "Get inspired by AI" are calm invitations
 */
function MyListTab({ 
  savedActivities,
  onCardTap,
  onAddCustomAlternative,
  onRegenerateAI,
}: { 
  savedActivities: SavedActivity[];
  onCardTap: (alternative: any) => void;
  onAddCustomAlternative: () => void;
  onRegenerateAI: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Add/inspire actions */}
      <View style={styles.myListActions}>
        <Pressable
          onPress={onAddCustomAlternative}
          style={({ pressed }) => [
            styles.myListActionButton,
            pressed && styles.myListActionButtonPressed,
          ]}
        >
          <Text style={styles.myListActionIcon}>➕</Text>
          <Text style={styles.myListActionText}>Add your own idea</Text>
        </Pressable>
        <Pressable
          onPress={onRegenerateAI}
          style={({ pressed }) => [
            styles.myListActionButton,
            pressed && styles.myListActionButtonPressed,
          ]}
        >
          <Text style={styles.myListActionIcon}>✨</Text>
          <Text style={styles.myListActionText}>Get inspired by AI</Text>
        </Pressable>
      </View>

      {/* Show message if no saved items */}
      {savedActivities.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No saved activities yet. Browse Discover or AI For You to save activities here.
          </Text>
        </View>
      )}

      {/* Saved alternatives */}
      {savedActivities.map((alt) => (
        <Pressable
          key={alt.id}
          onPress={() => onCardTap(alt)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
        >
          {/* Card metadata with management icons (only show distance/points for discover items) */}
          <View style={styles.cardMeta}>
            {alt.distance && (
              <View style={styles.cardMetaItem}>
                <Text style={styles.cardMetaIcon}>📍</Text>
                <Text style={styles.cardMetaText}>{alt.distance}</Text>
              </View>
            )}
            {alt.points && (
              <View style={styles.cardMetaItem}>
                <Text style={styles.cardMetaIcon}>🔥</Text>
                <Text style={styles.cardMetaText}>{alt.points}</Text>
              </View>
            )}
            {/* Source badge for AI suggestions */}
            {alt.source === 'ai' && (
              <View style={styles.cardSourceBadge}>
                <Text style={styles.cardSourceBadgeText}>AI</Text>
              </View>
            )}
            <View style={styles.cardManagement}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card tap
                  // No-op: UI only
                }}
                style={({ pressed }) => [
                  styles.cardManagementButton,
                  pressed && styles.cardManagementButtonPressed,
                ]}
              >
                <Text style={styles.cardManagementIcon}>👁️</Text>
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card tap
                  // No-op: UI only
                }}
                style={({ pressed }) => [
                  styles.cardManagementButton,
                  pressed && styles.cardManagementButtonPressed,
                ]}
              >
                <Text style={styles.cardManagementIcon}>🗑️</Text>
              </Pressable>
            </View>
          </View>

          {/* Card content */}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{alt.title}</Text>
              <Text style={styles.cardDuration}>{alt.duration}</Text>
            </View>
            <Text style={styles.cardDescription}>{alt.description}</Text>
            <Text style={styles.cardFlexibleTiming}>Flexible timing</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B', // tokens: background (dark mode)
  },

  // Header: Reflective Float (context framing)
  header: {
    paddingHorizontal: 24, // tokens: space_24
    paddingTop: 16, // tokens: space_16
    paddingBottom: 12, // tokens: space_12
  },
  headerTitle: {
    fontSize: 24, // tokens: h2.fontSize
    lineHeight: 32, // tokens: h2.lineHeight
    fontWeight: '600', // tokens: h2.fontWeight
    letterSpacing: -0.3, // tokens: h2.letterSpacing
    color: '#FAFAFA', // tokens: textPrimary
    marginBottom: 4, // tokens: space_4
  },
  headerSubline: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '400', // tokens: bodySecondary.fontWeight
    letterSpacing: 0, // tokens: bodySecondary.letterSpacing
    color: '#A1A1AA', // tokens: textSecondary
  },

  // Tabs: Calm, non-competing
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24, // tokens: space_24
    paddingTop: 16, // tokens: space_16
    paddingBottom: 12, // tokens: space_12
    borderBottomWidth: 1,
    borderBottomColor: '#3F3F46', // tokens: divider
  },
  tab: {
    paddingVertical: 8, // tokens: space_8
    paddingHorizontal: 16, // tokens: space_16
    marginRight: 8, // tokens: space_8
    borderRadius: 8, // tokens: radius_8
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#27272A', // tokens: surfaceSecondary (soft background fill)
  },
  tabPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  tabLabel: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '500',
    letterSpacing: 0,
    color: '#71717A', // tokens: textMuted (inactive)
  },
  tabLabelActive: {
    color: '#FAFAFA', // tokens: textPrimary (active)
  },

  // Scroll content
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 24, // tokens: space_24
    paddingTop: 24, // tokens: space_24
    paddingBottom: 24, // tokens: space_24
  },

  // Tab content container
  tabContent: {
    // No additional styles needed
  },

  // Alternative cards (shared across tabs)
  card: {
    backgroundColor: '#18181B', // tokens: surface
    borderRadius: 16, // tokens: radius_16 (soft containment)
    padding: 16, // tokens: space_16
    marginBottom: 16, // tokens: space_16
    // elevation_2 (dark mode) - cards have calm presence
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // tokens: surfaceGlass (selected state)
    borderWidth: 1,
    borderColor: '#8B7AE8', // tokens: primary (subtle selection indicator)
  },
  cardPressed: {
    opacity: 0.85, // Subtle opacity change on press (calm feedback)
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // tokens: space_12
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16, // tokens: space_16
  },
  cardMetaIcon: {
    fontSize: 12, // tokens: caption.fontSize
    marginRight: 4, // tokens: space_4
  },
  cardMetaText: {
    fontSize: 12, // tokens: caption.fontSize
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '500', // tokens: caption.fontWeight
    letterSpacing: 0.3, // tokens: caption.letterSpacing
    color: '#71717A', // tokens: textMuted
  },
  cardSaveButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4, // tokens: space_4 (touch target)
    gap: 4, // tokens: space_4 (space between icon and label)
  },
  cardSaveButtonPressed: {
    opacity: 0.6, // tokens: opacity_muted
  },
  cardSaveIcon: {
    fontSize: 14, // Slightly smaller to balance with text
    color: '#71717A', // tokens: textMuted (neutral, secondary)
  },
  cardSaveIconSaved: {
    color: '#52525B', // Even more muted when saved (non-rewarding)
    opacity: 0.6, // tokens: opacity_muted
  },
  cardSaveLabel: {
    fontSize: 12, // tokens: caption.fontSize (smaller than body)
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '400', // Regular weight (not emphasized)
    letterSpacing: 0,
    color: '#A1A1AA', // tokens: textSecondary (low contrast, not muted)
  },
  cardSaveLabelSaved: {
    color: '#71717A', // tokens: textMuted (even more receded when saved)
    opacity: 0.6, // tokens: opacity_muted
  },
  cardContent: {
    marginBottom: 12, // tokens: space_12
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8, // tokens: space_8
  },
  cardTitle: {
    fontSize: 20, // tokens: h3.fontSize
    lineHeight: 28, // tokens: h3.lineHeight
    fontWeight: '600', // tokens: h3.fontWeight
    letterSpacing: -0.2, // tokens: h3.letterSpacing
    color: '#FAFAFA', // tokens: textPrimary
    flex: 1,
  },
  cardDuration: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '400', // tokens: bodySecondary.fontWeight
    letterSpacing: 0,
    color: '#A1A1AA', // tokens: textSecondary
    marginLeft: 8, // tokens: space_8
  },
  cardDescription: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '400', // tokens: bodySecondary.fontWeight
    letterSpacing: 0,
    color: '#A1A1AA', // tokens: textSecondary
    marginBottom: 8, // tokens: space_8
  },
  cardFlexibleTiming: {
    fontSize: 12, // tokens: caption.fontSize
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '500', // tokens: caption.fontWeight
    letterSpacing: 0.3, // tokens: caption.letterSpacing
    color: '#71717A', // tokens: textMuted
  },
  cardAction: {
    alignSelf: 'flex-start',
    paddingVertical: 6, // Compact, secondary presence
    paddingHorizontal: 0,
  },
  cardActionPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  cardActionText: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '500',
    letterSpacing: 0,
    color: '#8B7AE8', // tokens: primary (calm but present)
  },

  // AI For You specific
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16, // tokens: space_16
  },
  aiContext: {
    fontSize: 12, // tokens: caption.fontSize
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '500', // tokens: caption.fontWeight
    letterSpacing: 0.3, // tokens: caption.letterSpacing
    color: '#71717A', // tokens: textMuted
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12, // tokens: space_12
    backgroundColor: '#27272A', // tokens: surfaceSecondary
    borderRadius: 8, // tokens: radius_8
  },
  regenerateButtonPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  regenerateIcon: {
    fontSize: 12,
    marginRight: 4, // tokens: space_4
  },
  regenerateText: {
    fontSize: 12, // tokens: caption.fontSize
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '500', // tokens: caption.fontWeight
    letterSpacing: 0.3, // tokens: caption.letterSpacing
    color: '#A1A1AA', // tokens: textSecondary
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, // tokens: space_12
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4, // tokens: space_4
    paddingHorizontal: 8, // tokens: space_8
    backgroundColor: '#27272A', // tokens: surfaceSecondary
    borderRadius: 8, // tokens: radius_8
  },
  cardBadgeIcon: {
    fontSize: 12,
    marginRight: 4, // tokens: space_4
  },
  cardBadgeText: {
    fontSize: 12, // tokens: caption.fontSize
    lineHeight: 16, // tokens: caption.lineHeight
    fontWeight: '500', // tokens: caption.fontWeight
    letterSpacing: 0.3, // tokens: caption.letterSpacing
    color: '#A1A1AA', // tokens: textSecondary
  },

  // My List specific
  myListActions: {
    flexDirection: 'row',
    gap: 12, // tokens: space_12
    marginBottom: 24, // tokens: space_24
  },
  myListActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // tokens: space_12
    paddingHorizontal: 16, // tokens: space_16
    backgroundColor: '#27272A', // tokens: surfaceSecondary
    borderRadius: 12, // tokens: radius_12
    borderWidth: 1,
    borderColor: '#3F3F46', // tokens: border (subtle)
    borderStyle: 'dashed',
  },
  myListActionButtonPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  myListActionIcon: {
    fontSize: 16,
    marginRight: 6, // tokens: space_6
  },
  myListActionText: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '500',
    letterSpacing: 0,
    color: '#A1A1AA', // tokens: textSecondary
  },
  cardManagement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 8, // tokens: space_8
  },
  cardManagementButton: {
    padding: 4, // tokens: space_4
  },
  cardManagementButtonPressed: {
    opacity: 0.8, // tokens: opacity_hover
  },
  cardManagementIcon: {
    fontSize: 16,
    color: '#71717A', // tokens: textMuted
  },
  cardSourceBadge: {
    paddingVertical: 2, // tokens: space_2
    paddingHorizontal: 6, // tokens: space_6
    backgroundColor: '#27272A', // tokens: surfaceSecondary
    borderRadius: 4, // tokens: radius_4
    marginRight: 8, // tokens: space_8
  },
  cardSourceBadgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: '#71717A', // tokens: textMuted
  },

  // Empty state (My List)
  emptyState: {
    paddingVertical: 32, // tokens: space_32
    paddingHorizontal: 16, // tokens: space_16
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '400', // tokens: bodySecondary.fontWeight
    letterSpacing: 0,
    color: '#71717A', // tokens: textMuted
    textAlign: 'center',
  },

  // Pagination (static, no logic)
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8, // tokens: space_8
    paddingHorizontal: 16, // tokens: space_16
  },
  paginationText: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '500',
    letterSpacing: 0,
    color: '#71717A', // tokens: textMuted
  },

  // Heavy Override: "Ignore & Continue"
  overrideContainer: {
    paddingHorizontal: 24, // tokens: space_24
    paddingVertical: 16, // tokens: space_16
    borderTopWidth: 1,
    borderTopColor: '#3F3F46', // tokens: divider
    alignItems: 'center',
  },
  overrideButton: {
    paddingVertical: 8, // tokens: space_8 (reduced presence)
    paddingHorizontal: 16, // tokens: space_16
  },
  overrideButtonPressed: {
    opacity: 0.6, // tokens: opacity_muted
  },
  overrideButtonText: {
    fontSize: 14, // tokens: bodySecondary.fontSize
    lineHeight: 20, // tokens: bodySecondary.lineHeight
    fontWeight: '400', // tokens: bodySecondary.fontWeight (not emphasized)
    letterSpacing: 0,
    color: '#71717A', // tokens: textMuted (low energy, honest)
  },
});

