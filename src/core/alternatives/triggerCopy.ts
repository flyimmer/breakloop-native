/**
 * Trigger WHY copy — sourced from design/ux/trigger_paragraphs_v3.md
 *
 * Used in:
 * - Alternatives tab: collapsed 1-liner on trigger section headers
 * - Tap to expand: shows micro-why (1 sentence + 2 bullets)
 */

import type { Trigger } from './types';

export interface TriggerCopy {
    trigger: Trigger;
    /** Short label shown in headers and chips */
    label: string;
    /** Collapsed 1-liner shown under the section header (spec §7) */
    collapsedOneLiner: string;
    /** Opening sentence of the micro-why (expanded) */
    microWhy: string;
    /** Two supporting bullets */
    microWhyBullets: [string, string];
}

export const TRIGGER_COPY: Record<Trigger, TriggerCopy> = {
    BOREDOM: {
        trigger: 'BOREDOM',
        label: 'Boredom',
        collapsedOneLiner: 'Boredom is your brain asking to explore — scrolling numbs it.',
        microWhy:
            'Boredom is the engine for exploration and growth — feeds only give quick novelty.',
        microWhyBullets: [
            'Novelty rewards train a habit loop: bored → check phone → stronger urge next time.',
            'When you stop, boredom points you toward something meaningful to do.',
        ],
    },
    STRESS_ANXIETY: {
        trigger: 'STRESS_ANXIETY',
        label: 'Stress / Anxiety',
        collapsedOneLiner: 'Stress wants a reset — scrolling keeps your nervous system "on".',
        microWhy:
            'Stress is a signal to downshift or set a boundary — scrolling adds noise and stimulation.',
        microWhyBullets: [
            'More input keeps your body activated, so anxiety doesn\'t actually resolve.',
            'A small real reset (breath, walk, message, task) reduces stress faster than a feed.',
        ],
    },
    LONELINESS: {
        trigger: 'LONELINESS',
        label: 'Loneliness',
        collapsedOneLiner: 'Feeds imitate connection — real contact heals loneliness.',
        microWhy:
            'Loneliness is your social system asking for real connection — scrolling is usually passive and empty.',
        microWhyBullets: [
            'Comparison + "pseudo-connection" can leave you feeling even more isolated.',
            'One small reach-out beats another scroll: a message, voice note, or quick call.',
        ],
    },
    FATIGUE: {
        trigger: 'FATIGUE',
        label: 'Fatigue',
        collapsedOneLiner: 'Fatigue needs recovery — scrolling steals rest and sleep.',
        microWhy:
            'Fatigue is your body asking to recover — scrolling borrows energy with light and novelty.',
        microWhyBullets: [
            'It delays rest and can worsen sleep quality, making tomorrow harder.',
            'A short recovery action (water, stretch, eyes closed, nap prep) restores more than a feed.',
        ],
    },
    SELF_DOUBT: {
        trigger: 'SELF_DOUBT',
        label: 'Self-doubt',
        collapsedOneLiner: 'Self-doubt grows on comparison — scrolling feeds it.',
        microWhy:
            'Self-doubt often means you\'re at the edge of growth — feeds turn it into comparison.',
        microWhyBullets: [
            'Validation fades fast; comparison loops make you feel worse, not better.',
            'One tiny real step builds confidence: practice, tidy, message someone, write a plan.',
        ],
    },
    NO_CLEAR_GOAL: {
        trigger: 'NO_CLEAR_GOAL',
        label: 'No clear goal',
        collapsedOneLiner: 'No clear goal is a cue to choose — scrolling postpones clarity.',
        microWhy:
            'Aimlessness is your mind asking for a small decision — scrolling avoids the choice.',
        microWhyBullets: [
            'The feed supplies endless "ready-made goals," so your own priorities stay unclear.',
            'Clarity comes from choosing one next step, not consuming more input.',
        ],
    },
    OTHER: {
        trigger: 'OTHER',
        label: 'Other',
        collapsedOneLiner: 'Not sure what it is? Name it once — then choose one small action.',
        microWhy:
            'If the feeling doesn\'t fit the categories, that\'s okay — naming it reduces its power.',
        microWhyBullets: [
            'Give it a short label (e.g., "waiting", "FOMO", "work tension") so you notice the pattern.',
            'Then pick one small action that matches what you actually need right now.',
        ],
    },
};
