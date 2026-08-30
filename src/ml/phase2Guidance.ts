import {
  PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS,
  Phase2TurnParticipant,
} from '@/ml/phase2TurnStreak';
import { AudioParams, DroneParams } from '@/types';

/** Parent call tone — concert A4. */
export const PHASE2_ANCHOR_MIDI = 69;

export const PHASE2_PARENT_CALL_RELEASE_MS = 760;

/** Parent must stay idle this long after calling before the child button blinks. */
export const PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS = 5_000;

/** How long the child-turn invite stays visible after it appears. */
export const PHASE2_CHILD_TURN_WINDOW_MS = 12000;

/** Rising wind-up notes for the music-hover suspense beat. */
export const PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS = 78;

/** Dead-air gap after the hard pause, before the wind-up plinks. */
export const PHASE2_MUSIC_HOVER_SILENCE_MS = 340;

/** Central orb expansion duration during music hover. */
export const PHASE2_MUSIC_HOVER_VISUAL_MS = 3000;

/** Minimum gap between joint-attention sparkle cues (avoids gaze flicker spam). */
export const PHASE2_JOINT_ATTENTION_CUE_COOLDOWN_MS = 2_500;

const C_MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11];
const DYADIC_CONSONANT_INTERVALS = new Set([0, 3, 4, 7, 9]);
/** Pitch-class roots in C major that complement concert A (pc 9). */
const ANCHOR_COMPLEMENT_ROOTS = [5, 2, 0, 4];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePitchClass(note: number): number {
  return ((note % 12) + 12) % 12;
}

function intervalToAnchor(notePc: number, anchorPc: number): number {
  return Math.min(Math.abs(notePc - anchorPc), 12 - Math.abs(notePc - anchorPc));
}

/** Whether a note sits in a consonant interval above the parent anchor. */
export function isConsonantWithAnchor(note: number, anchorMidi: number): boolean {
  return DYADIC_CONSONANT_INTERVALS.has(
    intervalToAnchor(normalizePitchClass(note), normalizePitchClass(anchorMidi)),
  );
}

function snapToCMajorPitchClass(pc: number): number {
  if (C_MAJOR_PCS.includes(pc)) {
    return pc;
  }

  let best = C_MAJOR_PCS[0];
  let bestDistance = 12;
  for (const candidate of C_MAJOR_PCS) {
    const distance = Math.min(Math.abs(pc - candidate), 12 - Math.abs(pc - candidate));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function buildTriadFromRoot(rootPc: number, baseMidi = 60): number[] {
  const thirdInterval = C_MAJOR_PCS.includes((rootPc + 4) % 12) ? 4 : 3;
  return [baseMidi + rootPc, baseMidi + rootPc + thirdInterval, baseMidi + rootPc + 7].map(
    (note) => {
      let midi = note;
      while (midi < 57) {
        midi += 12;
      }
      while (midi > 72) {
        midi -= 12;
      }
      return midi;
    },
  );
}

function scoreTriadWithAnchor(triad: number[], anchorMidi: number): number {
  return triad.filter((note) => isConsonantWithAnchor(note, anchorMidi)).length;
}

function bestComplementTriad(preferredRootPc: number, anchorMidi: number): number[] {
  const preferredRoot = snapToCMajorPitchClass(preferredRootPc);
  const preferredTriad = buildTriadFromRoot(preferredRoot);
  const preferredScore = scoreTriadWithAnchor(preferredTriad, anchorMidi);

  if (preferredScore >= 2) {
    return preferredTriad;
  }

  let bestTriad = buildTriadFromRoot(ANCHOR_COMPLEMENT_ROOTS[0]);
  let bestScore = -1;

  for (const rootPc of ANCHOR_COMPLEMENT_ROOTS) {
    const triad = buildTriadFromRoot(rootPc);
    const score = scoreTriadWithAnchor(triad, anchorMidi);

    if (score > bestScore) {
      bestScore = score;
      bestTriad = triad;
    }
  }

  return bestTriad;
}

/**
 * Maps HarmoniNet / fusion notes into a register-safe triad that complements the parent call.
 * Falls back to the strongest anchor-consonant triad when fusion output is empty.
 */
export function resolveComplementaryChord(fusionNotes: number[], anchorMidi: number): number[] {
  if (fusionNotes.length === 0) {
    return bestComplementTriad(ANCHOR_COMPLEMENT_ROOTS[0], anchorMidi);
  }

  const rootPc = snapToCMajorPitchClass(
    normalizePitchClass([...fusionNotes].sort((a, b) => a - b)[0] ?? 60),
  );
  return bestComplementTriad(rootPc, anchorMidi);
}

/** Fade in whisper hum one round before music hover (not during whole session). */
export const PHASE2_PRE_HOVER_DRONE_ROUND = PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS - 1;

/** No ambient bed — keeps Phase 2 quiet between taps (sensory-friendly). */
export function buildPhase2SilentDrone(): DroneParams {
  return {
    rootMidi: 55,
    level: 0,
    filterFreq: 280,
    timbre: 'gentle',
  };
}

/**
 * Barely-audible single sine, slow fade-in.
 * Only armed right before the music-hover beat so pause still has something to cut.
 */
export function buildPhase2PreHoverDrone(): DroneParams {
  return {
    rootMidi: 55,
    level: 0.2,
    filterFreq: 280,
    timbre: 'gentle',
  };
}

export function resolvePhase2AmbientDrone(consecutiveSuccessfulRounds: number): DroneParams {
  if (consecutiveSuccessfulRounds >= PHASE2_PRE_HOVER_DRONE_ROUND) {
    return buildPhase2PreHoverDrone();
  }
  return buildPhase2SilentDrone();
}

/** Caregiver tap: single A tone sweeping from the side toward center. */
export function buildParentCallAudio(): AudioParams {
  return {
    notes: [PHASE2_ANCHOR_MIDI],
    overtones: [1, 0.16, 0.05],
    filterFreq: 980,
    latentEnergy: 0.62,
    releaseMs: PHASE2_PARENT_CALL_RELEASE_MS,
    cutPrevious: false,
    calmness: 0.72,
    pan: -0.9,
    panEnd: 0,
  };
}

/** Child tap: HarmoniNet fusion shaped into an anchor-consonant complementary chord. */
export function buildChildComplementaryAudio(
  fusion: AudioParams,
  options?: { jointAttention?: boolean },
): AudioParams {
  const notes = resolveComplementaryChord(fusion.notes, PHASE2_ANCHOR_MIDI);
  const jointAttention = options?.jointAttention === true;
  let energy = clamp(fusion.latentEnergy ?? 0.5, 0.52, 0.82);
  if (jointAttention) {
    energy = clamp(energy + 0.08, 0.56, 0.88);
  }
  const overtones =
    fusion.overtones.length >= 3
      ? fusion.overtones.map((partial, index) =>
          clamp(partial, index === 0 ? 1 : 0.08, index === 0 ? 1 : jointAttention ? 0.52 : 0.45),
        )
      : jointAttention
        ? [1, 0.38, 0.2, 0.1]
        : [1, 0.32, 0.16, 0.08];

  return {
    notes,
    overtones,
    filterFreq: clamp(fusion.filterFreq ?? 1020, 880, jointAttention ? 1480 : 1360),
    latentEnergy: energy,
    releaseMs: jointAttention ? 1320 : 1240,
    cutPrevious: false,
    calmness: clamp(0.82 - energy * 0.12, 0.68, 0.86),
    pan: 0.9,
    panEnd: 0,
  };
}

/** Soft single-tone ping when joint attention is first detected — quiet, not a bright chord. */
export function buildJointAttentionCueAudio(): AudioParams {
  return {
    notes: [67],
    overtones: [1, 0.05],
    filterFreq: 620,
    latentEnergy: 0.18,
    releaseMs: 1050,
    cutPrevious: false,
    calmness: 0.98,
    pan: 0,
    panEnd: 0,
  };
}

/** Extra sparkle when child taps during joint attention with steady shared rhythm. */
export function buildJointAttentionSyncRewardAudio(): AudioParams {
  return {
    notes: [79, 84, 88, 91],
    overtones: [1, 0.55, 0.28, 0.14],
    filterFreq: 1680,
    latentEnergy: 0.58,
    releaseMs: 760,
    cutPrevious: false,
    calmness: 0.9,
    pan: 0,
    panEnd: 0,
  };
}

/** Soft panning ping when someone taps out of turn — hints who should play next. */
export function buildTurnNudgeAudio(expected: Phase2TurnParticipant): AudioParams {
  const towardChild = expected === 'self';
  const pan = towardChild ? 0.82 : -0.82;

  return {
    notes: [towardChild ? 72 : 64],
    overtones: [1, 0.14],
    filterFreq: 920,
    latentEnergy: 0.16,
    releaseMs: 300,
    cutPrevious: false,
    calmness: 0.94,
    pan,
    panEnd: pan * 0.45,
  };
}

/** Short sparkle chord when the child answers after a parent call. */
export function buildChildTurnRewardAudio(): AudioParams {
  return {
    notes: [72, 76, 79],
    overtones: [1, 0.45, 0.22, 0.12],
    filterFreq: 1380,
    latentEnergy: 0.52,
    releaseMs: 680,
    cutPrevious: false,
    calmness: 0.96,
    pan: 0,
    panEnd: 0,
  };
}

/** Music-box wind-up: brisk rising plinks leading into the smile moment. */
export function buildMusicHoverWindupSequence(): AudioParams[] {
  const risingMidi = [67, 69, 72, 74, 76, 79, 81, 84, 88];
  return risingMidi.map((note, index) => ({
    notes: [note],
    overtones: [1, 0.62, 0.28, 0.12],
    filterFreq: 1780 + index * 140,
    latentEnergy: 0.52 + index * 0.05,
    releaseMs: 118,
    cutPrevious: false,
    calmness: 0.58,
    pan: Math.max(-0.35, -0.35 + index * 0.1),
    panEnd: 0,
  }));
}

/** Triumphant chord when the smile peaks — bright and celebratory. */
export function buildMusicHoverPeakCelebration(): AudioParams {
  return {
    notes: [72, 76, 79, 84, 88],
    overtones: [1, 0.68, 0.36, 0.18],
    filterFreq: 1980,
    latentEnergy: 0.94,
    releaseMs: 1180,
    cutPrevious: false,
    calmness: 0.48,
    pan: 0,
    panEnd: 0,
  };
}

/** Quick shimmer arpeggio right after the peak chord lands. */
export function buildMusicHoverPeakArpeggio(): AudioParams[] {
  const notes = [84, 88, 91, 96];
  return notes.map((note, index) => ({
    notes: [note],
    overtones: [1, 0.55, 0.22],
    filterFreq: 2040 + index * 80,
    latentEnergy: 0.72 + index * 0.04,
    releaseMs: 200,
    cutPrevious: false,
    calmness: 0.42,
    pan: (index - 1.5) * 0.18,
    panEnd: 0,
  }));
}

/** Lingering sparkle while the smile holds on screen. */
export function buildMusicHoverEchoSparkle(): AudioParams {
  return {
    notes: [79, 84, 88, 91],
    overtones: [1, 0.58, 0.3, 0.14],
    filterFreq: 2100,
    latentEnergy: 0.78,
    releaseMs: 920,
    cutPrevious: false,
    calmness: 0.52,
    pan: 0,
    panEnd: 0,
  };
}
