import { buildDemoSessionHighlights } from '@/metrics/demoSessionSummary';
import { MetricEntry } from '@/types';

function entry(
  partial: Omit<MetricEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): MetricEntry {
  return {
    id: partial.id ?? '1',
    timestamp: partial.timestamp ?? '2026-01-01T12:00:00.000Z',
    kind: partial.kind,
    payload: partial.payload,
  };
}

describe('buildDemoSessionHighlights', () => {
  it('aggregates phase 1 and phase 2 demo events', () => {
    const highlights = buildDemoSessionHighlights([
      entry({ kind: 'inference', payload: { inferenceMs: 4, stressLevel: 0.8 } }),
      entry({ kind: 'inference', payload: { inferenceMs: 6, stressLevel: 0.4 } }),
      entry({
        kind: 'inference',
        payload: {
          module: 'phase2_loop',
          inferenceMs: 10,
          jointAttention: true,
          rewardTriggered: true,
        },
      }),
      entry({
        kind: 'inference',
        payload: {
          module: 'phase2_loop',
          inferenceMs: 14,
          jointAttention: false,
          rewardTriggered: false,
        },
      }),
      entry({ kind: 'inference', payload: { module: 'phase2_music_hover', inferenceMs: 0 } }),
    ]);

    expect(highlights.phase1TouchInferences).toBe(2);
    expect(highlights.avgPhase1Stress).toBeCloseTo(0.6);
    expect(highlights.phase2ChildResponses).toBe(2);
    expect(highlights.musicHoverBeats).toBe(1);
    expect(highlights.jointAttentionMoments).toBe(1);
    expect(highlights.rewardMoments).toBe(1);
    expect(highlights.avgPhase2InferenceMs).toBe(12);
  });
});
