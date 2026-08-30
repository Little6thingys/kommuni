import { applyMusicTheoryMask } from '@/ml/musicTheoryMask';
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

/** C-major triad complementing the anchor A. */
const COMPLEMENTARY_CHORD = applyMusicTheoryMask([60, 64, 67]);

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
    level: 0.02,
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
    latentEnergy: 0.42,
    releaseMs: PHASE2_PARENT_CALL_RELEASE_MS,
    cutPrevious: false,
    calmness: 0.78,
    pan: -0.9,
    panEnd: 0,
  };
}

/** Child tap: highly consonant complementary chord gliding to center. */
export function buildChildComplementaryAudio(_fusion: AudioParams): AudioParams {
  return {
    notes: COMPLEMENTARY_CHORD,
    overtones: [1, 0.32, 0.16, 0.08],
    filterFreq: 1020,
    latentEnergy: 0.5,
    releaseMs: 1240,
    cutPrevious: false,
    calmness: 0.92,
    pan: 0.9,
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
