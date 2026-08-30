import { MetricEntry } from '@/types';

export type DemoSessionHighlights = {
  phase1TouchInferences: number;
  avgPhase1Stress: number | null;
  phase2ChildResponses: number;
  musicHoverBeats: number;
  jointAttentionMoments: number;
  rewardMoments: number;
  avgPhase2InferenceMs: number | null;
};

function isPhase2Loop(entry: MetricEntry): boolean {
  return entry.kind === 'inference' && entry.payload.module === 'phase2_loop';
}

function isPhase2MusicHover(entry: MetricEntry): boolean {
  return entry.kind === 'inference' && entry.payload.module === 'phase2_music_hover';
}

function isPhase1Inference(entry: MetricEntry): boolean {
  return entry.kind === 'inference' && entry.payload.stressLevel != null;
}

/** Aggregates parent-facing demo metrics from the raw session log. */
export function buildDemoSessionHighlights(entries: readonly MetricEntry[]): DemoSessionHighlights {
  const phase1Entries = entries.filter(isPhase1Inference);
  const phase2Loops = entries.filter(isPhase2Loop);
  const musicHoverBeats = entries.filter(isPhase2MusicHover).length;

  let stressSum = 0;
  for (const entry of phase1Entries) {
    const stress = entry.payload.stressLevel;
    if (typeof stress === 'number') {
      stressSum += stress;
    }
  }

  let phase2InferenceSum = 0;
  let jointAttentionMoments = 0;
  let rewardMoments = 0;

  for (const entry of phase2Loops) {
    const inferenceMs = entry.payload.inferenceMs;
    if (typeof inferenceMs === 'number') {
      phase2InferenceSum += inferenceMs;
    }
    if (entry.payload.jointAttention === true) {
      jointAttentionMoments += 1;
    }
    if (entry.payload.rewardTriggered === true) {
      rewardMoments += 1;
    }
  }

  return {
    phase1TouchInferences: phase1Entries.length,
    avgPhase1Stress:
      phase1Entries.length > 0 ? stressSum / phase1Entries.length : null,
    phase2ChildResponses: phase2Loops.length,
    musicHoverBeats,
    jointAttentionMoments,
    rewardMoments,
    avgPhase2InferenceMs:
      phase2Loops.length > 0 ? phase2InferenceSum / phase2Loops.length : null,
  };
}
