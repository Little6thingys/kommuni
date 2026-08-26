import { transitionPhase } from '@/fsm/phaseFSM';

describe('phaseFSM', () => {
  it('enters patience when stress drops below threshold', () => {
    expect(
      transitionPhase('PHASE1', { type: 'STRESS_BELOW_THRESHOLD' }),
    ).toBe('PATIENCE');
  });

  it('resets patience on stress spike', () => {
    expect(transitionPhase('PATIENCE', { type: 'STRESS_SPIKE' })).toBe('PHASE1');
  });

  it('transitions to phase 2 after patience elapses', () => {
    expect(transitionPhase('PATIENCE', { type: 'PATIENCE_ELAPSED' })).toBe(
      'PHASE2',
    );
  });
});
