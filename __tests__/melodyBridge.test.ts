import {
  buildDroneParams,
  buildMelodyBridgeAudio,
  createMelodyBridgeState,
  recoverStressWhenIdle,
  updateSmoothedStress,
} from '@/ml/melodyBridge';
import { computeConsonanceRate } from '@/metrics/consonance';

describe('melodyBridge', () => {
  it('produces longer, softer notes as stress falls', () => {
    const state = createMelodyBridgeState();
    const z = new Float32Array([0.1, -0.05, 0.2, 0.1, -0.1, 0.05, 0.3, 0]);

    const venting = buildMelodyBridgeAudio(z, 0.95, state);

    const calmState = createMelodyBridgeState();
    let calm = venting;
    for (let i = 0; i < 24; i += 1) {
      calm = buildMelodyBridgeAudio(z, 0.05, calmState);
    }

    expect(venting.notes.length).toBe(1);
    expect(calm.notes.length).toBe(3);
    expect((calm.releaseMs ?? 0)).toBeGreaterThan(venting.releaseMs ?? 0);
    expect(calm.filterFreq).toBeLessThan(venting.filterFreq);
    expect(calm.cutPrevious).toBe(false);
    expect(venting.cutPrevious).toBe(true);
    expect(computeConsonanceRate(calm.notes)).toBeGreaterThan(0.85);
  });

  it('keeps drone silent when disabled or while stressed', () => {
    const state = createMelodyBridgeState();
    updateSmoothedStress(state, 0.9);

    expect(buildDroneParams(state, false).level).toBe(0);
    expect(buildDroneParams(state, true).level).toBe(0);

    for (let i = 0; i < 20; i += 1) {
      updateSmoothedStress(state, 0.08);
    }

    const calmDrone = buildDroneParams(state, true);
    expect(calmDrone.level).toBeGreaterThan(0);
    expect(calmDrone.level).toBeLessThan(0.08);
    expect(buildDroneParams(state, false).level).toBe(0);
  });

  it('recovers stress when the finger is idle', () => {
    const state = createMelodyBridgeState();
    updateSmoothedStress(state, 0.1);
    const calm = state.smoothedStress;

    recoverStressWhenIdle(state);
    recoverStressWhenIdle(state);

    expect(state.smoothedStress).toBeGreaterThan(calm);
  });
});
