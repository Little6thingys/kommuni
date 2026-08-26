import { HarmoniNetOutput } from '@/types';

const HIDDEN_DIM = 16;
const INPUT_DIM = 8;
const RHYTHM_DIM = 4;

const C_MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11];
const ROOT_MIDI = 60;

function buildCMajorMarkovMatrix(): Float32Array {
  const matrix = new Float32Array(12 * 12);
  const inScale = new Set(C_MAJOR_PCS);

  for (let from = 0; from < 12; from += 1) {
    let rowSum = 0;
    for (let to = 0; to < 12; to += 1) {
      let weight = 0.02;
      if (inScale.has(from) && inScale.has(to)) {
        weight = from === to ? 0.18 : 0.11;
        if (Math.abs(from - to) === 7 || Math.abs(from - to) === 5) {
          weight += 0.06;
        }
        if (Math.abs(from - to) === 4) {
          weight += 0.04;
        }
      } else if (inScale.has(to)) {
        weight = 0.05;
      }
      matrix[from * 12 + to] = weight;
      rowSum += weight;
    }
    for (let to = 0; to < 12; to += 1) {
      matrix[from * 12 + to] /= rowSum;
    }
  }

  return matrix;
}

function buildMatrix(rows: number, cols: number, scale: number): Float32Array {
  const matrix = new Float32Array(rows * cols);
  for (let i = 0; i < matrix.length; i += 1) {
    matrix[i] = Math.sin((i + 1) * 1.37) * scale;
  }
  return matrix;
}

/** C-major weighted pitch-class transition matrix (12×12). */
const MARKOV_TRANSITION = buildCMajorMarkovMatrix();

const RNN_W_XH = buildMatrix(HIDDEN_DIM, INPUT_DIM + RHYTHM_DIM, 0.08);
const RNN_W_HH = buildMatrix(HIDDEN_DIM, HIDDEN_DIM, 0.06);
const RNN_B_H = new Float32Array(HIDDEN_DIM);

export type HarmoniNetState = {
  hidden: Float32Array;
  pitchClass: number;
};

export function createHarmoniNetState(): HarmoniNetState {
  return {
    hidden: new Float32Array(HIDDEN_DIM),
    pitchClass: 0,
  };
}

function tanh(value: number): number {
  return Math.tanh(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deriveRhythmFeatures(rhythmTap: number[]): Float32Array {
  const features = new Float32Array(RHYTHM_DIM);
  if (rhythmTap.length === 0) {
    return features;
  }

  const sorted = [...rhythmTap].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    intervals.push(sorted[i] - sorted[i - 1]);
  }

  features[0] = clamp(sorted.length / 8, 0, 1);
  if (intervals.length > 0) {
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
    features[1] = clamp(1 - Math.sqrt(variance) / 600, 0, 1);
    features[2] = clamp(mean / 900, 0, 1);
  }
  features[3] = clamp((sorted.at(-1)! - sorted[0]) / 4000, 0, 1);

  return features;
}

function runRnnStep(
  z: Float32Array,
  rhythmFeatures: Float32Array,
  hidden: Float32Array,
): Float32Array {
  const input = new Float32Array(INPUT_DIM + RHYTHM_DIM);
  input.set(z.subarray(0, INPUT_DIM));
  input.set(rhythmFeatures, INPUT_DIM);

  const next = new Float32Array(HIDDEN_DIM);
  for (let row = 0; row < HIDDEN_DIM; row += 1) {
    let sum = RNN_B_H[row];
    for (let col = 0; col < input.length; col += 1) {
      sum += RNN_W_XH[row * (INPUT_DIM + RHYTHM_DIM) + col] * input[col];
    }
    for (let col = 0; col < HIDDEN_DIM; col += 1) {
      sum += RNN_W_HH[row * HIDDEN_DIM + col] * hidden[col];
    }
    next[row] = tanh(sum);
  }
  return next;
}

function sampleMarkovPitchClass(current: number, bias: Float32Array): number {
  const rowOffset = current * 12;
  let total = 0;
  const weights = new Float32Array(12);

  for (let pc = 0; pc < 12; pc += 1) {
    const weight =
      MARKOV_TRANSITION[rowOffset + pc] * (1 + clamp(bias[pc % HIDDEN_DIM], -0.5, 0.8));
    weights[pc] = weight;
    total += weight;
  }

  let threshold = Math.random() * total;
  for (let pc = 0; pc < 12; pc += 1) {
    threshold -= weights[pc];
    if (threshold <= 0) {
      return pc;
    }
  }
  return current;
}

export function chordNotesToVector(notes: number[]): Float32Array {
  const vector = new Float32Array(12);
  for (const note of notes) {
    const pc = ((note % 12) + 12) % 12;
    vector[pc] += 1;
  }
  const max = Math.max(...vector);
  if (max > 0) {
    for (let i = 0; i < 12; i += 1) {
      vector[i] /= max;
    }
  }
  return vector;
}

function buildTriad(rootPc: number, hidden: Float32Array): number[] {
  const thirdPc = C_MAJOR_PCS.includes((rootPc + 4) % 12) ? rootPc + 4 : rootPc + 3;
  const fifthPc = rootPc + 7;
  const octaveShift = hidden[0] > 0.35 ? 12 : 0;
  return [
    ROOT_MIDI - (ROOT_MIDI % 12) + rootPc + octaveShift,
    ROOT_MIDI - (ROOT_MIDI % 12) + thirdPc + octaveShift,
    ROOT_MIDI - (ROOT_MIDI % 12) + fifthPc + octaveShift,
  ];
}

function computeTension(
  notes: number[],
  rhythmFeatures: Float32Array,
  hidden: Float32Array,
): number {
  const vector = chordNotesToVector(notes);
  let dissonance = 0;
  for (let pc = 0; pc < 12; pc += 1) {
    if (!C_MAJOR_PCS.includes(pc)) {
      dissonance += vector[pc];
    }
  }
  const hiddenEnergy =
    hidden.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(hidden.length, 1);
  return clamp(dissonance * 0.55 + (1 - rhythmFeatures[1]) * 0.25 + hiddenEnergy * 0.2, 0, 1);
}

/** Module 3 — Adaptive HarmoniNet (Markov + lightweight RNN). */
export function runHarmoniNet(
  z: Float32Array,
  rhythmTap: number[],
  state: HarmoniNetState,
): { output: HarmoniNetOutput; state: HarmoniNetState } {
  const rhythmFeatures = deriveRhythmFeatures(rhythmTap);
  const hidden = runRnnStep(z, rhythmFeatures, state.hidden);
  const pitchClass = sampleMarkovPitchClass(state.pitchClass, hidden);
  const chordNotes = buildTriad(pitchClass, hidden);
  const chordVector = chordNotesToVector(chordNotes);
  const tension = computeTension(chordNotes, rhythmFeatures, hidden);

  return {
    output: {
      chordNotes,
      chordVector,
      tension,
    },
    state: {
      hidden,
      pitchClass,
    },
  };
}
