/**
 * Alternatives Database
 * 
 * Complete predefined alternative activities organized by root cause.
 * Total: 36 activities across 6 root causes
 * 
 * Source: Web reactive phone simulation
 * Documentation: docs/alternatives-database.md
 */

export type AlternativeActivity = {
  id: string;
  title: string;
  description: string;
  duration: string; // e.g., "30m", "5m", "2h"
  type: 'calm' | 'creative' | 'leisure' | 'mental' | 'physical' | 'productive' | 'rest' | 'social';
  tags: string[]; // e.g., ['indoor'], ['outdoor'], ['social_call']
  popularity: number; // likes count (global, synced from server)
  actions: string[]; // action steps
  causes: string[]; // root causes this activity addresses
  isFriend?: boolean; // friend-specific activity flag
};

/**
 * Popularity tracking:
 * - Each activity starts at 0 likes
 * - When user saves to "My List", popularity +1 (global across all users)
 * - When user deletes from "My List", popularity -1 (global across all users)
 * - Requires backend server to sync popularity across users
 * - Local storage: tracks which activities current user has liked
 * - Server storage: tracks global popularity count per activity
 */

// Loneliness alternatives (7 activities)
const lonelinessAlternatives: AlternativeActivity[] = [
  {
    id: 'l1',
    title: 'Hobby Class',
    description: 'Find a regular hobby class.',
    duration: '60m',
    type: 'social',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Search local classes',
      'Check schedule',
      'Sign up for one',
    ],
    causes: ['loneliness'],
  },
  {
    id: 'l2',
    title: 'Cook & Invite',
    description: 'Make a special meal and invite a friend.',
    duration: '90m',
    type: 'social',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Choose a recipe',
      'Check ingredients',
      'Call a friend to invite',
      'Start cooking',
    ],
    causes: ['loneliness'],
  },
  {
    id: 'l3',
    title: 'Call Thomas',
    description: 'He is usually free around this time.',
    duration: '10m',
    type: 'social',
    tags: ['social_call'],
    popularity: 0,
    actions: [
      'Open contacts',
      'Find Thomas',
      'Call',
    ],
    causes: ['loneliness'],
    isFriend: true,
  },
  {
    id: 'l4',
    title: 'Third Place Visit',
    description: 'Go to a library or coffee shop.',
    duration: '45m',
    type: 'social',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Pack a book',
      'Walk to location',
      'Order a drink/Find seat',
    ],
    causes: ['loneliness'],
  },
  {
    id: 'l5',
    title: 'Volunteering',
    description: 'Find a volunteering project.',
    duration: '30m',
    type: 'social',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Search local charities',
      'Call to inquire',
      'Schedule first visit',
    ],
    causes: ['loneliness'],
  },
  {
    id: 'l6',
    title: 'Join MeetUp',
    description: 'Find a spontaneous group activity.',
    duration: '60m',
    type: 'social',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Open MeetUp.com',
      'Search interest',
      'RSVP to one event',
    ],
    causes: ['loneliness'],
  },
  {
    id: 'l7',
    title: 'Nature Walk',
    description: 'Walk in nature, maybe greet a stranger.',
    duration: '30m',
    type: 'social',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Put on shoes',
      'Go to nearest park',
      'Smile at someone',
    ],
    causes: ['loneliness'],
  },
];

// Boredom alternatives (8 activities)
const boredomAlternatives: AlternativeActivity[] = [
  {
    id: 'bo1',
    title: 'Make Tea Ritual',
    description: 'Ritualize making a hot drink.',
    duration: '10m',
    type: 'calm',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Boil water',
      'Select favorite tea leaf',
      'Steep and enjoy slowly',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo2',
    title: 'Tidy Up',
    description: 'Tidy up one small area.',
    duration: '15m',
    type: 'productive',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Pick one corner',
      'Set timer for 15m',
      'Start organizing',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo3',
    title: 'Quick Sketch',
    description: 'Grab a pen and paper.',
    duration: '20m',
    type: 'creative',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Find paper',
      'Find a pencil',
      'Draw what is in front of you',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo4',
    title: 'Play Instrument',
    description: 'Practice music.',
    duration: '15m',
    type: 'creative',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Sit at instrument',
      'Warm up fingers',
      'Play a song',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo5',
    title: 'Plant Care',
    description: 'Tend to your green friends.',
    duration: '10m',
    type: 'calm',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Check soil moisture',
      'Water if dry',
      'Wipe dust off leaves',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo6',
    title: 'Boredom Jar',
    description: 'Pick a random activity.',
    duration: '5m',
    type: 'creative',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Get a jar',
      'Write ideas on slips',
      'Pull one out',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo7',
    title: 'Savor Boredom',
    description: 'Listen to yourself for clarity.',
    duration: '5m',
    type: 'calm',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Sit still',
      'Close eyes',
      'Wait 5 minutes without doing anything',
    ],
    causes: ['boredom'],
  },
  {
    id: 'bo8',
    title: 'Console Gaming',
    description: 'Play on Switch/PS (Not Phone!).',
    duration: '30m',
    type: 'leisure',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Turn on TV',
      'Grab controller',
      'Play 1 level',
    ],
    causes: ['boredom'],
  },
];

// Fatigue alternatives (5 activities)
const fatigueAlternatives: AlternativeActivity[] = [
  {
    id: 'f1',
    title: 'Power Nap',
    description: 'Set timer for 15-45 minutes.',
    duration: '30m',
    type: 'rest',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Find a quiet spot',
      'Set alarm',
      'Close eyes',
    ],
    causes: ['fatigue'],
  },
  {
    id: 'f2',
    title: 'Do Nothing',
    description: 'Learn to do nothing.',
    duration: '30m',
    type: 'rest',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Sit comfortably',
      'Put phone away',
      'Let mind wander',
    ],
    causes: ['fatigue'],
  },
  {
    id: 'f3',
    title: 'Pomodoro Break',
    description: 'Take a regular break.',
    duration: '5m',
    type: 'rest',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Set timer 5m',
      'Stand up',
      'Stretch',
      'Drink water',
    ],
    causes: ['fatigue'],
  },
  {
    id: 'f4',
    title: 'Short Walk',
    description: 'Go around your house.',
    duration: '10m',
    type: 'physical',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Put on shoes',
      'Step outside',
      'Walk around block',
    ],
    causes: ['fatigue'],
  },
  {
    id: 'f5',
    title: 'Body Activate',
    description: 'Quick stretch to wake up.',
    duration: '5m',
    type: 'physical',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Stand up',
      'Stretch arms high',
      'Rotate neck',
    ],
    causes: ['fatigue'],
  },
];

// No Goal alternatives (5 activities)
const noGoalAlternatives: AlternativeActivity[] = [
  {
    id: 'g1',
    title: 'Values Check',
    description: 'Reconnect with your intentions.',
    duration: '5m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Write down 3 values',
      'Pick one',
      'Plan one small act today',
    ],
    causes: ['no-goal'],
  },
  {
    id: 'g2',
    title: 'Ideal Day',
    description: 'Journal your perfect Tuesday.',
    duration: '10m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Open notebook',
      'Visualize perfect day',
      'Write 5 lines about it',
    ],
    causes: ['no-goal'],
  },
  {
    id: 'g3',
    title: 'Space Prep',
    description: 'Tidy area related to a goal.',
    duration: '15m',
    type: 'productive',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Pick one desk area',
      'Remove clutter',
      'Wipe surface clean',
    ],
    causes: ['no-goal'],
  },
  {
    id: 'g4',
    title: 'Set Intention',
    description: 'One simple, achievable goal.',
    duration: '5m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Think of 1 goal',
      'Visualize doing it',
      'Start step 1',
    ],
    causes: ['no-goal'],
  },
  {
    id: 'g5',
    title: 'Offline Explore',
    description: 'Browse a library or bookstore.',
    duration: '45m',
    type: 'mental',
    tags: ['outdoor'],
    popularity: 0,
    actions: [
      'Go to library',
      'Find a random section',
      'Browse books',
    ],
    causes: ['no-goal'],
  },
];

// Self-Doubt alternatives (5 activities)
const selfDoubtAlternatives: AlternativeActivity[] = [
  {
    id: 'd1',
    title: 'Done List',
    description: 'List 3 things you accomplished.',
    duration: '5m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Review your day',
      'Write down 3 wins',
      'Feel proud',
    ],
    causes: ['self-doubt'],
  },
  {
    id: 'd2',
    title: 'Micro-Service',
    description: 'Offer a small kindness.',
    duration: '10m',
    type: 'social',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Think of a friend/colleague',
      'Send helpful text',
      'Offer support',
    ],
    causes: ['self-doubt'],
  },
  {
    id: 'd3',
    title: 'Tiny Skill',
    description: 'Master one small skill.',
    duration: '10m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Pick a skill (e.g. Excel)',
      'Watch 5m tutorial',
      'Try it out',
    ],
    causes: ['self-doubt'],
  },
  {
    id: 'd4',
    title: 'Tool Care',
    description: 'Prepare a tool for success.',
    duration: '10m',
    type: 'productive',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Pick a tool/lens',
      'Clean it thoroughly',
      'Put it back neatly',
    ],
    causes: ['self-doubt'],
  },
  {
    id: 'd5',
    title: 'Victory Lap',
    description: 'Review past wins.',
    duration: '5m',
    type: 'mental',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Look at old successful project',
      'Remember the feeling',
      'Affirm competence',
    ],
    causes: ['self-doubt'],
  },
];

// Anxiety alternatives (6 activities)
const anxietyAlternatives: AlternativeActivity[] = [
  {
    id: 'a1',
    title: '5-4-3-2-1 Grounding',
    description: 'Grounding technique.',
    duration: '3m',
    type: 'calm',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Name 5 things seen',
      '4 things felt',
      '3 things heard',
      '2 things smelled',
      '1 thing tasted',
    ],
    causes: ['anxiety'],
  },
  {
    id: 'a2',
    title: 'Box Breathing',
    description: 'Military calm technique.',
    duration: '2m',
    type: 'calm',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Inhale 4s',
      'Hold 4s',
      'Exhale 4s',
      'Hold 4s',
    ],
    causes: ['anxiety'],
  },
  {
    id: 'a3',
    title: 'Cold Splash',
    description: 'Physical anxiety reset.',
    duration: '2m',
    type: 'physical',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Go to bathroom',
      'Splash cold water on face',
      'Towel dry',
      'Breathe',
    ],
    causes: ['anxiety'],
  },
  {
    id: 'a4',
    title: 'Micro-Tidy',
    description: 'External order calms chaos.',
    duration: '5m',
    type: 'productive',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Pick one drawer/pile',
      'Sort it',
      'Discard trash',
    ],
    causes: ['anxiety'],
  },
  {
    id: 'a5',
    title: 'Energy Shake',
    description: 'Release anxious energy.',
    duration: '2m',
    type: 'physical',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Stand up',
      'Shake hands/feet',
      'Do 20 jumping jacks',
    ],
    causes: ['anxiety'],
  },
  {
    id: 'a6',
    title: 'Room Switch',
    description: 'Change environment.',
    duration: '2m',
    type: 'physical',
    tags: ['indoor'],
    popularity: 0,
    actions: [
      'Stand up',
      'Walk to another room/outside',
      'Stay for 60s',
    ],
    causes: ['anxiety'],
  },
];

// All alternatives combined
export const ALL_ALTERNATIVES: AlternativeActivity[] = [
  ...lonelinessAlternatives,
  ...boredomAlternatives,
  ...fatigueAlternatives,
  ...noGoalAlternatives,
  ...selfDoubtAlternatives,
  ...anxietyAlternatives,
];

// Alternatives organized by root cause
export const ALTERNATIVES_BY_CAUSE: Record<string, AlternativeActivity[]> = {
  'loneliness': lonelinessAlternatives,
  'boredom': boredomAlternatives,
  'fatigue': fatigueAlternatives,
  'no-goal': noGoalAlternatives,
  'self-doubt': selfDoubtAlternatives,
  'anxiety': anxietyAlternatives,
};

/**
 * Get alternatives for selected root causes
 * Combines all alternatives from selected causes and removes duplicates
 */
export function getAlternativesForCauses(selectedCauses: string[]): AlternativeActivity[] {
  if (selectedCauses.length === 0) {
    return ALL_ALTERNATIVES;
  }

  const alternatives: AlternativeActivity[] = [];
  const seenIds = new Set<string>();

  for (const cause of selectedCauses) {
    const causeAlternatives = ALTERNATIVES_BY_CAUSE[cause] || [];
    for (const alt of causeAlternatives) {
      if (!seenIds.has(alt.id)) {
        alternatives.push(alt);
        seenIds.add(alt.id);
      }
    }
  }

  // Sort by popularity (descending)
  return alternatives.sort((a, b) => b.popularity - a.popularity);
}

/**
 * Filter alternatives by context (time of day, weather, etc.)
 */
export function filterAlternativesByContext(
  alternatives: AlternativeActivity[],
  context: {
    isNightTime?: boolean;
    weather?: 'sunny' | 'rainy';
  }
): AlternativeActivity[] {
  return alternatives.filter((alt) => {
    // Filter out social calls at night
    if (context.isNightTime && alt.tags.includes('social_call')) {
      return false;
    }

    // Filter out daytime activities at night
    if (context.isNightTime && alt.tags.includes('daytime')) {
      return false;
    }

    // Filter out outdoor activities in rain
    if (context.weather === 'rainy' && alt.tags.includes('outdoor')) {
      return false;
    }

    return true;
  });
}
