import { FusionOutput, GazeSnapshot } from '@/types';

const ATTENTION_DIM = 12;
const MAX_JOINT_OVERTONES = 4;

function softmax(values: Float32Array): Float32Array {
  const max = Math.max(...values);
  const exp = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    exp[i] = Math.exp(values[i] - max);
    sum += exp[i];
  }
  for (let i = 0; i < exp.length; i += 1) {
    exp[i] /= sum || 1;
  }
  return exp;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maps gaze snapshot into a 4-dim feature vector. */
export function buildGazeFeatureVector(snapshot: GazeSnapshot): Float32Array {
  return new Float32Array([
    clamp(snapshot.gazeAngle / 30, -1, 1),
    snapshot.isJointAttention ? 1 : 0,
    clamp(snapshot.headPose.yaw / 45, -1, 1),
    clamp(snapshot.headPose.pitch / 35, -1, 1),
  ]);
}

/** Pads gaze features to 12 dims for attention key/value tensors. */
export function padGazeVector(gazeFeatures: Float32Array): Float32Array {
  const padded = new Float32Array(ATTENTION_DIM);
  for (let i = 0; i < ATTENTION_DIM; i += 1) {
    padded[i] = gazeFeatures[i % gazeFeatures.length];
  }
  return padded;
}

function deriveNotes(chordVector: Float32Array, context: Float32Array): number[] {
  const ranked = Array.from({ length: 12 }, (_, pc) => ({
    pc,
    score: chordVector[pc] * 0.65 + context[pc] * 0.35,
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.pc - b.pc);

  const root = ranked[0]?.pc ?? 0;
  return ranked.map(({ pc }) => 60 + pc + (pc < root ? 12 : 0));
}

function buildOvertonePartial(index: number, weight: number): number {
  return clamp(weight * (1 - index * 0.14), 0.05, 1);
}

function buildOvertones(
  isJointAttention: boolean,
  contextEnergy: number,
): number[] {
  const base = [1, 0.42, 0.22];
  if (!isJointAttention) {
    return base;
  }

  // Always add at least one extra partial on joint attention; scale up with energy.
  const extraCount = Math.max(1, Math.min(MAX_JOINT_OVERTONES, Math.round(contextEnergy * MAX_JOINT_OVERTONES + 1)));
  const overtones = [...base];
  for (let i = 0; i < extraCount; i += 1) {
    overtones.push(buildOvertonePartial(i + base.length, 0.34 - i * 0.05));
  }
  return overtones;
}

function computeRhythmSyncReward(
  rhythmTap: number[],
  isJointAttention: boolean,
): boolean {
  if (!isJointAttention || rhythmTap.length < 2) {
    return false;
  }

  const sorted = [...rhythmTap].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    intervals.push(sorted[i] - sorted[i - 1]);
  }
  if (intervals.length === 0) {
    return false;
  }

  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;

  return Math.sqrt(variance) < 220 && sorted.length >= 3;
}

/** Module 4 — cross-attention fusion (pure TypeScript, sub-millisecond target). */
export function runCrossAttentionFusion(
  chordVector: Float32Array,
  gazeVector: Float32Array,
  isJointAttention: boolean,
  options?: {
    tension?: number;
    rhythmTap?: number[];
  },
): FusionOutput {
  const key = padGazeVector(gazeVector);
  const value = key;

  const scores = new Float32Array(ATTENTION_DIM);
  for (let i = 0; i < ATTENTION_DIM; i += 1) {
    scores[i] = (chordVector[i] * key[i]) / Math.sqrt(ATTENTION_DIM);
  }
  const weights = softmax(scores);

  const context = new Float32Array(ATTENTION_DIM);
  for (let i = 0; i < ATTENTION_DIM; i += 1) {
    context[i] = weights[i] * value[i];
  }

  const contextEnergy = context.reduce((sum, coeff) => sum + Math.abs(coeff), 0) / ATTENTION_DIM;
  const notes = deriveNotes(chordVector, context);
  const overtones = buildOvertones(isJointAttention, contextEnergy);
  const filterFreq = clamp(640 + contextEnergy * 520 + Math.abs(gazeVector[0]) * 180, 520, 2200);
  const latentEnergy = clamp((options?.tension ?? 0.3) * 0.55 + contextEnergy * 0.45, 0.08, 1);
  const rewardTriggered = computeRhythmSyncReward(
    options?.rhythmTap ?? [],
    isJointAttention,
  );

  return {
    audioParams: {
      notes,
      overtones,
      filterFreq,
      latentEnergy,
    },
    rewardTriggered,
  };
}
