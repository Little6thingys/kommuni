import { PATIENCE_DURATION_MS } from '@/fsm/constants';

/** Phase 1 — child (with caregiver nearby) calms through drawing. */
export const PHASE1_GUI = {
  eyebrow: 'Phase 1',
  title: 'Slow Down, Feel Calmer',
  description:
    'Draw on the screen—fast swipes are okay. Slow, gentle strokes bring softer, calmer music.',
  hint: `Keep slow, gentle strokes for ${PATIENCE_DURATION_MS / 1000} seconds to play together next.`,
} as const;

/** Phase 2 — turn-taking taps with visual guidance toward shared joint attention. */
export const PHASE2_GUI = {
  eyebrow: 'Phase 2',
  title: 'Play Music Together',
  backLabel: '← Back',
  description:
    'Turn-taking taps with visual guidance toward shared joint attention. After the parent calls, wait five quiet seconds — then the child button blinks.',
  statusDetail:
    'Parent call → wait → child blink → child answer. Three successful rounds unlock a shared music-hover moment.',
} as const;

export const SETUP_GUI = {
  demoHint: 'Calm down first — then play music together',
  continueToPhase1: 'Start: calm-down activity →',
  demoModeLabel: 'Demo Mode',
  demoModeHint:
    'Showcase flow for caregivers: Phase 1 calm-down, then dyadic turn-taking with visual cues.',
  researchModeHint:
    'Research session: same phases with standard metrics logging and no demo highlights.',
  startDemo: 'Start demo session',
  startResearch: 'Start session',
} as const;
