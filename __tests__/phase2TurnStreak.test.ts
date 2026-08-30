import {
  advanceTurnAlternation,
  INITIAL_TURN_ALTERNATION,
  PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS,
} from '@/ml/phase2TurnStreak';

describe('phase2TurnStreak', () => {
  it('triggers music hover on the fourth parent beat after three successful rounds', () => {
    let state = INITIAL_TURN_ALTERNATION;

    for (let round = 0; round < PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS; round += 1) {
      state = advanceTurnAlternation(state, { kind: 'partner_tap' });
      expect(state.triggerMusicHover).toBe(false);
      expect(state.rejected).toBe(false);
      state = advanceTurnAlternation(state, { kind: 'child_tap', parentHasCalled: true });
      expect(state.triggerMusicHover).toBe(false);
      expect(state.rejected).toBe(false);
    }

    expect(state.consecutiveSuccessfulRounds).toBe(PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS);

    const hoverBeat = advanceTurnAlternation(state, { kind: 'partner_tap' });
    expect(hoverBeat.triggerMusicHover).toBe(true);
    expect(hoverBeat.consecutiveSuccessfulRounds).toBe(0);
    expect(hoverBeat.nextExpected).toBe('self');
    expect(hoverBeat.rejected).toBe(false);
  });

  it('ignores an early parent tap without clearing the streak', () => {
    let state = advanceTurnAlternation(INITIAL_TURN_ALTERNATION, { kind: 'partner_tap' });
    state = advanceTurnAlternation(state, { kind: 'child_tap', parentHasCalled: true });
    state = advanceTurnAlternation(state, { kind: 'partner_tap' });

    const doubleParent = advanceTurnAlternation(state, { kind: 'partner_tap' });
    expect(doubleParent.rejected).toBe(true);
    expect(doubleParent.consecutiveSuccessfulRounds).toBe(1);
  });

  it('ignores a child tap that is not an immediate response to the parent', () => {
    let state = advanceTurnAlternation(INITIAL_TURN_ALTERNATION, { kind: 'partner_tap' });
    state = advanceTurnAlternation(state, { kind: 'child_tap', parentHasCalled: true });
    const extraChild = advanceTurnAlternation(state, {
      kind: 'child_tap',
      parentHasCalled: false,
    });
    expect(extraChild.rejected).toBe(true);
    expect(extraChild.consecutiveSuccessfulRounds).toBe(1);
  });
});
