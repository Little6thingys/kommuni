export type Phase2TurnParticipant = 'self' | 'partner';

/** Successful parent→child exchanges required before the music-hover beat. */
export const PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS = 3;

export type TurnAlternationState = {
  consecutiveSuccessfulRounds: number;
  nextExpected: Phase2TurnParticipant;
};

export const INITIAL_TURN_ALTERNATION: TurnAlternationState = {
  consecutiveSuccessfulRounds: 0,
  nextExpected: 'partner',
};

export type TurnAlternationEvent =
  | { kind: 'partner_tap' }
  | { kind: 'child_tap'; parentHasCalled: boolean };

export type TurnAlternationResult = TurnAlternationState & {
  triggerMusicHover: boolean;
  rejected: boolean;
};

export function advanceTurnAlternation(
  state: TurnAlternationState,
  event: TurnAlternationEvent,
): TurnAlternationResult {
  if (event.kind === 'partner_tap') {
    if (state.nextExpected !== 'partner') {
      return {
        ...state,
        triggerMusicHover: false,
        rejected: true,
      };
    }

    const triggerMusicHover =
      state.consecutiveSuccessfulRounds >= PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS;

    return {
      consecutiveSuccessfulRounds: triggerMusicHover ? 0 : state.consecutiveSuccessfulRounds,
      nextExpected: 'self',
      triggerMusicHover,
      rejected: false,
    };
  }

  if (!event.parentHasCalled || state.nextExpected !== 'self') {
    return {
      ...state,
      triggerMusicHover: false,
      rejected: true,
    };
  }

  return {
    consecutiveSuccessfulRounds: state.consecutiveSuccessfulRounds + 1,
    nextExpected: 'partner',
    triggerMusicHover: false,
    rejected: false,
  };
}
