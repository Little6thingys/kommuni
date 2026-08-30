import {
  PHASE2_ANCHOR_MIDI,
  PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS,
  PHASE2_PARENT_CALL_RELEASE_MS,
  buildChildComplementaryAudio,
  buildChildTurnRewardAudio,
  buildJointAttentionCueAudio,
  buildJointAttentionSyncRewardAudio,
  isConsonantWithAnchor,
  resolveComplementaryChord,
  buildMusicHoverEchoSparkle,
  buildMusicHoverPeakArpeggio,
  buildMusicHoverPeakCelebration,
  buildMusicHoverWindupSequence,
  PHASE2_MUSIC_HOVER_SILENCE_MS,
  PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS,
  buildParentCallAudio,
  buildPhase2PreHoverDrone,
  buildPhase2SilentDrone,
  buildTurnNudgeAudio,
  PHASE2_PRE_HOVER_DRONE_ROUND,
  resolvePhase2AmbientDrone,
} from '@/ml/phase2Guidance';
import { PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS } from '@/ml/phase2TurnStreak';

function scoreTriad(notes: number[]): number {
  return notes.filter((note) => isConsonantWithAnchor(note, PHASE2_ANCHOR_MIDI)).length;
}

describe('phase2Guidance', () => {
  it('plays anchor A for caregiver call with pan toward center', () => {
    const audio = buildParentCallAudio();
    expect(audio.notes).toEqual([PHASE2_ANCHOR_MIDI]);
    expect(audio.pan).toBeLessThan(0);
    expect(audio.panEnd).toBe(0);
  });

  it('maps HarmoniNet fusion into anchor-consonant complementary chords', () => {
    const cFusion = buildChildComplementaryAudio({
      notes: [60, 64, 67],
      overtones: [1, 0.3, 0.15],
      filterFreq: 1000,
      latentEnergy: 0.45,
    });
    const dmFusion = buildChildComplementaryAudio({
      notes: [62, 65, 69],
      overtones: [1, 0.5, 0.4, 0.2],
      filterFreq: 1200,
      latentEnergy: 0.62,
    });

    expect(cFusion.notes).toHaveLength(3);
    expect(dmFusion.notes).toHaveLength(3);
    expect(scoreTriad(cFusion.notes)).toBeGreaterThanOrEqual(2);
    expect(scoreTriad(dmFusion.notes)).toBeGreaterThanOrEqual(2);
    expect(dmFusion.notes).not.toEqual(cFusion.notes);
    expect(dmFusion.latentEnergy).toBeGreaterThan(cFusion.latentEnergy);
    expect(dmFusion.filterFreq).toBe(1200);
    expect(cFusion.pan).toBeGreaterThan(0);
    expect(cFusion.panEnd).toBe(0);
    expect((cFusion.releaseMs ?? 0)).toBeGreaterThan(1000);
    expect(cFusion.cutPrevious).toBe(false);
  });

  it('falls back to a strong anchor complement when fusion notes are empty', () => {
    const fallback = resolveComplementaryChord([], PHASE2_ANCHOR_MIDI);
    expect(fallback).toHaveLength(3);
    expect(fallback.filter((note) => isConsonantWithAnchor(note, PHASE2_ANCHOR_MIDI)).length).toBe(
      3,
    );
  });

  it('blinks the child button only after five seconds of parent idle', () => {
    expect(PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS).toBe(5_000);
    expect(PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS).toBeGreaterThan(
      PHASE2_PARENT_CALL_RELEASE_MS,
    );
  });

  it('plays joint-attention cue and sync reward audio presets', () => {
    const cue = buildJointAttentionCueAudio();
    const sync = buildJointAttentionSyncRewardAudio();
    expect(cue.notes).toEqual([67]);
    expect(cue.overtones).toEqual([1, 0.05]);
    expect(cue.latentEnergy).toBeLessThan(0.25);
    expect(cue.calmness).toBeGreaterThan(0.95);
    expect(sync.notes.length).toBeGreaterThanOrEqual(4);
    expect(cue.cutPrevious).toBe(false);
    expect(sync.filterFreq).toBeGreaterThan(cue.filterFreq);
  });

  it('plays a short reward chord after a child response', () => {
    const audio = buildChildTurnRewardAudio();
    expect(audio.notes).toEqual([72, 76, 79]);
    expect(audio.cutPrevious).toBe(false);
  });

  it('builds a brisk rising wind-up and celebration chords for music hover', () => {
    const sequence = buildMusicHoverWindupSequence();
    expect(sequence.length).toBeGreaterThanOrEqual(6);
    expect(sequence[0]?.notes[0]).toBeLessThan(sequence.at(-1)?.notes[0] ?? 0);
    expect(sequence.every((entry) => entry.cutPrevious === false)).toBe(true);
    expect(sequence.at(-1)?.latentEnergy ?? 0).toBeGreaterThan(0.8);

    const peak = buildMusicHoverPeakCelebration();
    expect(peak.notes.length).toBeGreaterThanOrEqual(4);
    expect(peak.latentEnergy).toBeGreaterThan(0.85);
    expect(peak.calmness).toBeLessThan(0.55);

    const arpeggio = buildMusicHoverPeakArpeggio();
    expect(arpeggio.length).toBeGreaterThanOrEqual(4);
    expect(arpeggio.at(-1)?.notes[0] ?? 0).toBeGreaterThan(arpeggio[0]?.notes[0] ?? 0);

    const echo = buildMusicHoverEchoSparkle();
    expect(echo.notes.length).toBeGreaterThanOrEqual(3);
    expect(PHASE2_MUSIC_HOVER_SILENCE_MS).toBeLessThan(400);
    expect(PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS).toBeLessThan(90);
  });

  it('keeps phase 2 silent until the pre-hover round', () => {
    expect(resolvePhase2AmbientDrone(0).level).toBe(0);
    expect(resolvePhase2AmbientDrone(PHASE2_PRE_HOVER_DRONE_ROUND).level).toBeGreaterThan(0);
    expect(PHASE2_PRE_HOVER_DRONE_ROUND).toBe(PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS - 1);
  });

  it('nudges toward the expected participant when a tap is out of turn', () => {
    const childNudge = buildTurnNudgeAudio('self');
    const parentNudge = buildTurnNudgeAudio('partner');
    expect(childNudge.pan).toBeGreaterThan(0);
    expect(parentNudge.pan).toBeLessThan(0);
    expect(childNudge.cutPrevious).toBe(false);
  });

  it('uses a single gentle sine for the pre-hover whisper', () => {
    const drone = buildPhase2PreHoverDrone();
    expect(drone.timbre).toBe('gentle');
    expect(drone.level).toBeGreaterThan(0);
    expect(drone.level).toBeLessThanOrEqual(0.25);
    expect(buildPhase2SilentDrone().level).toBe(0);
  });
});
