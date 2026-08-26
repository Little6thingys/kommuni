import { AudioParams } from '@/types';

const PENTATONIC = new Set([0, 2, 4, 7, 9]);
const CONSONANT_INTERVALS = new Set([0, 3, 4, 7, 9, 12]);

function normalizePitchClass(note: number): number {
  return ((note % 12) + 12) % 12;
}

function nearestPentatonicPitchClass(pc: number): number {
  if (PENTATONIC.has(pc)) {
    return pc;
  }

  let best = pc;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const allowed of PENTATONIC) {
    const distance = Math.min(
      Math.abs(pc - allowed),
      12 - Math.abs(pc - allowed),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = allowed;
    }
  }

  return best;
}

/** Filters chromatic pitch classes to the nearest pentatonic set member. */
export function applyMusicTheoryMask(notes: number[]): number[] {
  return notes.map((note) => {
    const pc = normalizePitchClass(note);
    if (PENTATONIC.has(pc)) {
      return note;
    }

    const resolved = nearestPentatonicPitchClass(pc);
    return note - pc + resolved;
  });
}

/** Maps latent dimensions to a small chord within the C4–C5 range. */
export function latentToPitchClasses(z: Float32Array): number[] {
  const base = 60;
  const offsets = [
    Math.round(z[0] * 3 + z[1] * 2),
    Math.round(z[2] * 2 + z[3]),
    Math.round(z[4] * 4 + z[5] * 1.5),
  ];

  return applyMusicTheoryMask(
    offsets.map((offset) => base + normalizePitchClass(offset)),
  );
}

/** Soft consonance envelope — higher when intervals stay within consonant set. */
export function consonanceEnvelope(notes: number[]): number {
  if (notes.length === 0) {
    return 1;
  }

  const root = normalizePitchClass(notes[0]);
  let consonantPairs = 0;
  let totalPairs = 0;

  for (let i = 1; i < notes.length; i += 1) {
    const interval = Math.abs(normalizePitchClass(notes[i]) - root);
    totalPairs += 1;
    if (CONSONANT_INTERVALS.has(interval)) {
      consonantPairs += 1;
    }
  }

  const intervalScore = totalPairs === 0 ? 1 : consonantPairs / totalPairs;
  const pentatonicScore =
    notes.filter((note) => PENTATONIC.has(normalizePitchClass(note))).length /
    notes.length;

  return intervalScore * 0.55 + pentatonicScore * 0.45;
}

export function latentToAudioParams(
  z: Float32Array,
  stressLevel: number,
): AudioParams {
  const notes = latentToPitchClasses(z);
  const envelope = consonanceEnvelope(notes);
  const energy = Math.min(1, stressLevel * 0.75 + envelope * 0.25);

  return {
    notes,
    overtones: [
      1,
      0.25 + energy * 0.35,
      0.12 + stressLevel * 0.18,
      envelope > 0.85 ? 0.08 : 0,
    ].filter((partial) => partial > 0),
    filterFreq: 420 + stressLevel * 980 + envelope * 120,
    latentEnergy: energy,
  };
}
