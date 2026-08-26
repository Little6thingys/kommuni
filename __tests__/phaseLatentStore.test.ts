import {
  getDefaultPhase1Latent,
  getPhase1Latent,
  resetPhase1Latent,
  setPhase1Latent,
} from '@/session/phaseLatentStore';

describe('phaseLatentStore', () => {
  afterEach(() => {
    resetPhase1Latent();
  });

  it('hands an 8-dim Phase 1 vector through to Phase 2', () => {
    const z = new Float32Array([0.4, -0.1, 0.2, 0.05, 0.01, 0.3, 0.7, -0.2]);
    setPhase1Latent(z);

    const stored = getPhase1Latent();
    expect(stored.length).toBe(8);
    expect(Array.from(stored)).toEqual(Array.from(z));
    expect(stored).not.toBe(z);
    expect(getDefaultPhase1Latent().length).toBe(8);
  });
});
