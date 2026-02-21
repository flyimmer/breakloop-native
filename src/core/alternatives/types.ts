/**
 * Alternatives — Canonical Data Model (v1)
 *
 * Source of truth: design/ux/alternatives_tab_spec_v1.md §2-3
 */

// --------------------------------------------------------------------------
// Trigger taxonomy
// --------------------------------------------------------------------------

export type Trigger =
  | 'BOREDOM'
  | 'STRESS_ANXIETY'
  | 'LONELINESS'
  | 'FATIGUE'
  | 'SELF_DOUBT'
  | 'NO_CLEAR_GOAL'
  | 'OTHER';

/** Display labels for each trigger */
export const TRIGGER_LABELS: Record<Trigger, string> = {
  BOREDOM: 'Boredom',
  STRESS_ANXIETY: 'Stress / Anxiety',
  LONELINESS: 'Loneliness',
  FATIGUE: 'Fatigue',
  SELF_DOUBT: 'Self-doubt',
  NO_CLEAR_GOAL: 'No clear goal',
  OTHER: 'Other',
};

/** Canonical ordering of triggers in group-by lists */
export const TRIGGER_ORDER: Trigger[] = [
  'BOREDOM',
  'STRESS_ANXIETY',
  'LONELINESS',
  'FATIGUE',
  'SELF_DOUBT',
  'NO_CLEAR_GOAL',
  'OTHER',
];

// --------------------------------------------------------------------------
// Activity fields
// --------------------------------------------------------------------------

export type ActivitySource = 'STARTER_PACK' | 'USER_CREATED';
export type PhonePolicy = 'NO_PHONE' | 'INTENTIONAL_OK' | 'EITHER';
export type Effort = 'LOW' | 'MEDIUM' | 'HIGH';

/** Context tags (§3.2 optional lightweight fields) */
export type ContextTag =
  | 'no_phone'
  | 'outside'
  | 'at_home'
  | 'social'
  | 'movement'
  | 'calm'
  | 'planning'
  | 'creative'
  | 'learning'
  | 'practical'
  | 'no_feed'
  | 'growth';

/** An alternative activity (v1 data model) */
export interface Activity {
  id: string;
  title: string;
  triggers: Trigger[];        // min 1 (spec §3.1)
  instructions?: string;      // optional; 1–3 lines
  isFavorite: boolean;
  source: ActivitySource;
  createdAt: number;          // epoch ms
  updatedAt: number;          // epoch ms

  // --- optional lightweight fields (spec §3.2) ---
  tags?: ContextTag[];
  phonePolicy?: PhonePolicy;
  effort?: Effort;
  otherLabel?: string;        // required when triggers includes OTHER
  notes?: string;
  lastUsedAt?: number;        // epoch ms; for "Recent" sorting later
}

// --------------------------------------------------------------------------
// Group-by types
// --------------------------------------------------------------------------

export type GroupBy = 'TRIGGERS' | 'CONTEXT' | 'TYPE';

/** Context group labels (spec §4.2) */
export type ContextGroup =
  | 'No phone'
  | 'Outside'
  | 'At home'
  | 'Social / connection'
  | 'Movement'
  | 'Calm'
  | 'Planning'
  | 'Creative'
  | 'Learning'
  | 'Practical'
  | 'No feed'
  | 'Other';

/** Type group labels (spec §4.3) */
export type TypeGroup =
  | 'Breathe / Calm'
  | 'Move'
  | 'Connect'
  | 'Plan'
  | 'Create'
  | 'Learn'
  | 'Rest / Recover'
  | 'Tidy / Practical'
  | 'Other';

// --------------------------------------------------------------------------
// Deep link params (spec §6)
// --------------------------------------------------------------------------

/**
 * Params passed from Intervention to the Alternatives tab.
 * In Phase 2 these come via NativeEventEmitter; in Phase 1
 * they are set directly by the AlternativesLinkContext.
 */
export interface AlternativesDeepLinkParams {
  trigger: Trigger;
  source: 'intervention';
  returnTo?: string; // checkpoint surface id — used in Phase 2
}
