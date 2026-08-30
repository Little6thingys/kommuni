import { PATIENCE_DURATION_MS } from '@/fsm/constants';

/** Phase 1 — child (with caregiver nearby) calms through drawing. */
export const PHASE1_GUI = {
  eyebrow: 'Phase 1',
  title: 'Slow Down, Feel Calmer',
  description:
    'Draw on the screen—fast swipes are okay. Slow, gentle strokes bring softer, calmer music.',
  hint: `Keep slow, gentle strokes for ${PATIENCE_DURATION_MS / 1000} seconds to play together next.`,
} as const;

/** Phase 2 — child and companion play rhythms and share gaze. */
export const PHASE2_GUI = {
  eyebrow: 'Phase 2',
  title: 'Play Music Together',
  description:
    'Take turns tapping the drums and look at each other—the music grows when you stay in sync.',
  statusDetail:
    'One person taps each drum pad. Stay face-to-face; shared rhythm and eye contact shape the song.',
} as const;

export const SETUP_GUI = {
  demoHint: 'Calm down first — then play music together',
  continueToPhase1: 'Start: calm-down activity →',
} as const;
