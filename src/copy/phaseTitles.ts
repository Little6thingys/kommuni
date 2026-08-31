import { PATIENCE_DURATION_MS } from '@/fsm/constants';

/** Phase 1 — child (with caregiver nearby) calms through drawing. */
export const PHASE1_GUI = {
  eyebrow: 'Phase 1',
  title: 'Slow Down, Feel Calmer',
  description:
    'Draw on the screen—fast swipes are okay. Slow, gentle strokes bring softer, calmer music.',
  hint: `Keep slow, gentle strokes for ${PATIENCE_DURATION_MS / 1000} seconds to play together next.`,
} as const;

/** Play Together — turn-taking taps with visual guidance toward shared joint attention. */
export const PHASE2_GUI = {
  eyebrow: 'Play Together',
  skipLabel: 'Skip to Play Together',
  skipShortLabel: 'Skip',
  title: 'Play Music Together',
  backLabel: '← Back',
  description:
    'Turn-taking taps with visual guidance toward shared joint attention.wait five quiet seconds — then the child button blinks.',
  statusDetail:
    'Parent call → wait → child blink → child answer. Three successful rounds unlock a shared music-hover moment.',
  parentTapLabel: 'Parent',
  childTapLabel: 'Child',
  tapDrumIcon: '🥁',
  jointAttentionActive: 'Joint Attention',
  jointAttentionHint: 'Look at the screen together',
  jointAttentionUnavailable: 'Enable face tracking for joint attention',
  jointAttentionRewardEmoji: '✨',
  dataLogLabel: 'View data log',
  dataLogShortLabel: 'Data log',
  resetSessionShortLabel: 'Reset',
  turnStreakLabel: 'In sync',
} as const;

export const DATALOG_GUI = {
  backHomeLabel: 'Back to home',
  backHomeShortLabel: 'Home',
  clearDataLogLabel: 'Clear Data & Log',
  clearDataLogTitle: 'Clear Data & Log?',
  clearDataLogMessage: 'This removes all in-memory metrics for the current session.',
  clearDataLogConfirm: 'Clear',
} as const;

export const SETUP_GUI = {
  developerModeLabel: 'Developer mode',
  developerModeDescription: 'Shows debug statistics and overlays during the session.',
  developerModeOnStatus: 'On',
  developerModeOffStatus: 'Off',
} as const;
