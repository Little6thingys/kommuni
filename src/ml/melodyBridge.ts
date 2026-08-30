import { AudioParams, DroneParams } from '@/types';

import { applyMusicTheoryMask, consonanceEnvelope } from './musicTheoryMask';

/** C-major pentatonic pitch classes. */
const PENTATONIC_PCS = [0, 2, 4, 7, 9] as const;

const STRESS_SMOOTHING = 0.18;
const CALM_STRESS_THRESHOLD = 0.28;
const VENT_STRESS_THRESHOLD = 0.65;

export type MelodyBridgeState = {
  smoothedStress: number;
  anchorMidi: number;
  lastRootMidi: number;
  chordIndex: number;
};

export function createMelodyBridgeState(): MelodyBridgeState {
  return {
    smoothedStress: 1,
    anchorMidi: 64,
    lastRootMidi: 64,
    chordIndex: 0,
  };
}

export function updateSmoothedStress(
  state: MelodyBridgeState,
  rawStress: number,
): number {
  state.smoothedStress =
    state.smoothedStress * (1 - STRESS_SMOOTHING) + rawStress * STRESS_SMOOTHING;
  return state.smoothedStress;
}

/** Drift stress back up when the finger is off the canvas — keeps audio and FSM idle-safe. */
export function recoverStressWhenIdle(
  state: MelodyBridgeState,
  factor = 1.04,
): number {
  state.smoothedStress = Math.min(1, state.smoothedStress * factor + 0.012);
  return state.smoothedStress;
}

export const MELODY_BRIDGE_CALM_THRESHOLD = CALM_STRESS_THRESHOLD;

function nearestPentatonicMidi(midi: number): number {
  const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
  const octave = Math.floor(midi / 12);

  let bestPc = PENTATONIC_PCS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const allowed of PENTATONIC_PCS) {
    const distance = Math.min(
      Math.abs(pitchClass - allowed),
      12 - Math.abs(pitchClass - allowed),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPc = allowed;
    }
  }

  return octave * 12 + bestPc;
}

function pentatonicIndex(midi: number): number {
  const pitchClass = ((nearestPentatonicMidi(midi) % 12) + 12) % 12;
  const index = PENTATONIC_PCS.indexOf(pitchClass as (typeof PENTATONIC_PCS)[number]);
  return index >= 0 ? index : 0;
}

function stepPentatonic(fromMidi: number, steps: number): number {
  let midi = nearestPentatonicMidi(fromMidi);
  let octave = Math.floor(midi / 12);
  let index = pentatonicIndex(midi);
  let remaining = steps;

  while (remaining > 0) {
    index += 1;
    if (index >= PENTATONIC_PCS.length) {
      index = 0;
      octave += 1;
    }
    remaining -= 1;
  }

  while (remaining < 0) {
    index -= 1;
    if (index < 0) {
      index = PENTATONIC_PCS.length - 1;
      octave -= 1;
    }
    remaining += 1;
  }

  return octave * 12 + PENTATONIC_PCS[index];
}

function stepTowardRoot(
  currentMidi: number,
  targetMidi: number,
  maxSteps: number,
): number {
  let cursor = nearestPentatonicMidi(currentMidi);
  const target = nearestPentatonicMidi(targetMidi);

  for (let i = 0; i < maxSteps; i += 1) {
    if (cursor === target) {
      break;
    }
    cursor = cursor < target ? stepPentatonic(cursor, 1) : stepPentatonic(cursor, -1);
  }

  return cursor;
}

function deriveTargetRoot(z: Float32Array, calmness: number): number {
  const register = 71 - calmness * 13;
  const wander = Math.round((z[0] ?? 0) * 1.5 + (z[1] ?? 0) * 0.8);
  return nearestPentatonicMidi(register + wander);
}

function buildResolutionChord(rootMidi: number, chordIndex: number): number[] {
  const patterns = [
    [0, 2, 4],
    [0, 3, 4],
    [0, 2, 5],
    [2, 4, 5],
  ] as const;
  const pattern = patterns[chordIndex % patterns.length];
  return pattern.map((step) => stepPentatonic(rootMidi, step));
}

/** Maps touch latent + stress into soothing, resolving pentatonic audio. */
export function buildMelodyBridgeAudio(
  z: Float32Array,
  rawStress: number,
  state: MelodyBridgeState,
): AudioParams {
  updateSmoothedStress(state, rawStress);

  const stress = state.smoothedStress;
  const calmness = 1 - stress;
  const targetRoot = deriveTargetRoot(z, calmness);
  const maxSteps = stress > VENT_STRESS_THRESHOLD ? 3 : stress > CALM_STRESS_THRESHOLD ? 2 : 1;

  state.lastRootMidi = stepTowardRoot(state.lastRootMidi, targetRoot, maxSteps);
  state.anchorMidi = state.lastRootMidi;

  let notes: number[];

  if (stress > VENT_STRESS_THRESHOLD) {
    notes = applyMusicTheoryMask([
      stepPentatonic(state.lastRootMidi, 2),
    ]);
  } else if (stress > CALM_STRESS_THRESHOLD) {
    notes = applyMusicTheoryMask([
      state.lastRootMidi,
      stepPentatonic(state.lastRootMidi, 3),
    ]);
  } else {
    state.chordIndex = (state.chordIndex + 1) % 4;
    notes = applyMusicTheoryMask(
      buildResolutionChord(state.lastRootMidi, state.chordIndex),
    );
  }

  const envelope = consonanceEnvelope(notes);

  return {
    notes,
    overtones:
      calmness > 0.55
        ? [1, 0.14, 0.05]
        : calmness > 0.25
          ? [1, 0.22, 0.08]
          : [1, 0.3],
    filterFreq: 760 - calmness * 400,
    latentEnergy: 0.14 + calmness * 0.36 + envelope * 0.14,
    releaseMs: Math.round(450 + calmness * 1750),
    cutPrevious: stress > 0.55,
    calmness,
  };
}

export function noteThrottleMs(stress: number): number {
  const calmness = 1 - stress;
  return Math.round(160 + calmness * 280);
}

const SILENT_DRONE: DroneParams = {
  rootMidi: 48,
  level: 0,
  filterFreq: 280,
};

/** Ambient bed — only while actively touching with low stress; otherwise silent. */
export function buildDroneParams(
  state: MelodyBridgeState,
  enabled: boolean,
): DroneParams {
  if (!enabled) {
    return SILENT_DRONE;
  }

  const calmness = 1 - state.smoothedStress;
  if (state.smoothedStress > CALM_STRESS_THRESHOLD) {
    return SILENT_DRONE;
  }

  return {
    rootMidi: nearestPentatonicMidi(state.anchorMidi - 12),
    level: Math.max(0, calmness - 0.45) * 0.55,
    filterFreq: 220 + calmness * 80,
  };
}
