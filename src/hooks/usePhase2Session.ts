import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useCrossAttentionFusion } from '@/hooks/useCrossAttentionFusion';
import { useGazeTracking } from '@/hooks/useGazeTracking';
import { useHarmoniNet } from '@/hooks/useHarmoniNet';
import { buildGazeFeatureVector } from '@/ml/crossAttention';
import {
  buildChildComplementaryAudio,
  buildChildTurnRewardAudio,
  buildJointAttentionCueAudio,
  buildJointAttentionSyncRewardAudio,
  buildMusicHoverEchoSparkle,
  buildMusicHoverPeakArpeggio,
  buildMusicHoverPeakCelebration,
  buildMusicHoverWindupSequence,
  buildParentCallAudio,
  buildPhase2SilentDrone,
  buildTurnNudgeAudio,
  PHASE2_CHILD_TURN_WINDOW_MS,
  PHASE2_JOINT_ATTENTION_CUE_COOLDOWN_MS,
  PHASE2_MUSIC_HOVER_SILENCE_MS,
  PHASE2_MUSIC_HOVER_VISUAL_MS,
  PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS,
  PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS,
  resolvePhase2AmbientDrone,
} from '@/ml/phase2Guidance';
import {
  advanceTurnAlternation,
  INITIAL_TURN_ALTERNATION,
  TurnAlternationState,
} from '@/ml/phase2TurnStreak';
import { metricsStore } from '@/metrics/MetricsStore';
import { getPhase1Latent } from '@/session/phaseLatentStore';
import { FusionOutput } from '@/types';

export type Phase2Participant = 'self' | 'partner';

export type Phase2TapPulse = {
  participant: Phase2Participant;
  tick: number;
};

export type UsePhase2SessionOptions = {
  jointAttentionMonitoring?: boolean;
};

export function usePhase2Session(options: UsePhase2SessionOptions = {}) {
  const jointAttentionMonitoring = options.jointAttentionMonitoring ?? true;
  const gaze = useGazeTracking({ jointAttentionMonitoring });
  const { infer: inferHarmoniNet, reset: resetHarmoniNet } = useHarmoniNet();
  const { fuse } = useCrossAttentionFusion();
  const audio = useAudioEngine();

  const [selfTaps, setSelfTaps] = useState<number[]>([]);
  const [partnerTaps, setPartnerTaps] = useState<number[]>([]);
  const [lastFusion, setLastFusion] = useState<FusionOutput | null>(null);
  const [lastTapBy, setLastTapBy] = useState<Phase2Participant | null>(null);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [rippleBoost, setRippleBoost] = useState(0);
  const [lastTapPulse, setLastTapPulse] = useState<Phase2TapPulse | null>(null);
  const [awaitingChildTurn, setAwaitingChildTurn] = useState(false);
  const [turnRewardTick, setTurnRewardTick] = useState(0);
  const [jointAttentionPulseTick, setJointAttentionPulseTick] = useState(0);
  const [musicHoverActive, setMusicHoverActive] = useState(false);
  const [successfulTurnRounds, setSuccessfulTurnRounds] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const phase1LatentRef = useRef(getPhase1Latent());
  const turnAlternationRef = useRef<TurnAlternationState>(INITIAL_TURN_ALTERNATION);
  const lastTapByRef = useRef<Phase2Participant | null>(null);
  const turnRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardAudioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicHoverTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastParentTouchAtRef = useRef<number | null>(null);
  const musicHoverActiveRef = useRef(false);
  const wasJointAttentionRef = useRef(false);
  const lastJointCueAtRef = useRef(0);

  const clearTurnTimers = useCallback(() => {
    if (turnRevealTimeoutRef.current) {
      clearTimeout(turnRevealTimeoutRef.current);
      turnRevealTimeoutRef.current = null;
    }
    if (turnExpireTimeoutRef.current) {
      clearTimeout(turnExpireTimeoutRef.current);
      turnExpireTimeoutRef.current = null;
    }
    if (rewardAudioTimeoutRef.current) {
      clearTimeout(rewardAudioTimeoutRef.current);
      rewardAudioTimeoutRef.current = null;
    }
  }, []);

  const clearMusicHoverTimers = useCallback(
    (options?: { resumeAudio?: boolean }) => {
      musicHoverTimeoutsRef.current.forEach(clearTimeout);
      musicHoverTimeoutsRef.current = [];
      if (options?.resumeAudio && audio.isReady) {
        audio.resume();
      }
    },
    [audio.isReady, audio.resume],
  );

  const scheduleChildTurnCue = useCallback(() => {
    clearTurnTimers();
    setAwaitingChildTurn(false);

    const parentTouchAt = lastParentTouchAtRef.current ?? Date.now();
    const delay = Math.max(
      0,
      PHASE2_PARENT_IDLE_BEFORE_CHILD_CUE_MS - (Date.now() - parentTouchAt),
    );

    turnRevealTimeoutRef.current = setTimeout(() => {
      setAwaitingChildTurn(true);
      turnExpireTimeoutRef.current = setTimeout(() => {
        setAwaitingChildTurn(false);
      }, PHASE2_CHILD_TURN_WINDOW_MS);
    }, delay);
  }, [clearTurnTimers]);

  const pulseRipple = useCallback((participant: Phase2Participant, amount: number) => {
    setRippleBoost((current) => Math.min(1, current * 0.72 + amount));
    setLastTapPulse({ participant, tick: Date.now() });
  }, []);

  const triggerMusicHover = useCallback(() => {
    clearTurnTimers();
    clearMusicHoverTimers({ resumeAudio: true });
    setAwaitingChildTurn(false);
    musicHoverActiveRef.current = true;
    setMusicHoverActive(true);

    if (audio.isReady) {
      audio.pause();
    }
    pulseRipple('partner', 0.72);

    if (audio.isReady) {
      const windup = buildMusicHoverWindupSequence();
      const silenceMs = PHASE2_MUSIC_HOVER_SILENCE_MS;
      const windupEndMs =
        silenceMs + Math.max(0, windup.length - 1) * PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS;

      musicHoverTimeoutsRef.current.push(
        setTimeout(() => {
          audio.resume();
        }, silenceMs),
      );

      windup.forEach((params, index) => {
        musicHoverTimeoutsRef.current.push(
          setTimeout(() => {
            audio.playNote(params);
          }, silenceMs + index * PHASE2_MUSIC_HOVER_WINDUP_INTERVAL_MS),
        );
      });

      musicHoverTimeoutsRef.current.push(
        setTimeout(() => {
          audio.playNote(buildMusicHoverPeakCelebration());
        }, windupEndMs + 40),
      );

      const arpeggio = buildMusicHoverPeakArpeggio();
      arpeggio.forEach((params, index) => {
        musicHoverTimeoutsRef.current.push(
          setTimeout(() => {
            audio.playNote(params);
          }, windupEndMs + 180 + index * 72),
        );
      });

      musicHoverTimeoutsRef.current.push(
        setTimeout(() => {
          audio.playNote(buildMusicHoverEchoSparkle());
        }, windupEndMs + 480),
      );

      musicHoverTimeoutsRef.current.push(
        setTimeout(() => {
          audio.setDrone(buildPhase2SilentDrone());
        }, PHASE2_MUSIC_HOVER_VISUAL_MS),
      );
    }

    const hoverEndId = setTimeout(() => {
      musicHoverActiveRef.current = false;
      setMusicHoverActive(false);
      if (audio.isReady) {
        audio.resume();
      }
      scheduleChildTurnCue();
    }, PHASE2_MUSIC_HOVER_VISUAL_MS);
    musicHoverTimeoutsRef.current.push(hoverEndId);

    metricsStore.record({
      kind: 'inference',
      payload: {
        module: 'phase2_music_hover',
        inferenceMs: 0,
        tension: 0,
        rewardTriggered: false,
        jointAttention: false,
      },
    });
  }, [
    audio.isReady,
    audio.pause,
    audio.playNote,
    audio.resume,
    audio.setDrone,
    clearMusicHoverTimers,
    clearTurnTimers,
    pulseRipple,
    scheduleChildTurnCue,
  ]);

  const rhythmTap = useMemo(
    () => [...selfTaps, ...partnerTaps].sort((a, b) => a - b),
    [partnerTaps, selfTaps],
  );

  const gazeVector = useMemo(
    () => buildGazeFeatureVector(gaze.snapshot),
    [gaze.snapshot],
  );

  const runPipeline = useCallback(
    (rhythmOverride?: number[]) => {
      const taps = rhythmOverride ?? rhythmTap;
      const startedAt = performance.now();
      const harmoni = inferHarmoniNet(phase1LatentRef.current, taps);
      const fusion = fuse(harmoni.chordVector, gazeVector, gaze.snapshot.isJointAttention, {
        tension: harmoni.tension,
        rhythmTap: taps,
      });
      const inferenceMs = performance.now() - startedAt;

      metricsStore.record({
        kind: 'inference',
        payload: {
          module: 'phase2_loop',
          inferenceMs,
          tension: harmoni.tension,
          rewardTriggered: fusion.rewardTriggered,
          jointAttention: gaze.snapshot.isJointAttention,
        },
      });

      setLastInferenceMs(inferenceMs);
      setLastFusion(fusion);
      return fusion;
    },
    [fuse, gaze.snapshot.isJointAttention, gazeVector, inferHarmoniNet, rhythmTap],
  );

  const playAudibleNote = useCallback(
    (params: Parameters<typeof audio.playNote>[0]) => {
      if (!audio.isReady) {
        return;
      }
      audio.resume();
      audio.playNote(params);
    },
    [audio.isReady, audio.playNote, audio.resume],
  );

  const handleTap = useCallback(
    (participant: Phase2Participant) => {
      if (musicHoverActiveRef.current) {
        return;
      }

      const parentJustCalled = lastTapByRef.current === 'partner';
      const alternationPreview = advanceTurnAlternation(turnAlternationRef.current, {
        kind: participant === 'partner' ? 'partner_tap' : 'child_tap',
        parentHasCalled: participant === 'self' ? parentJustCalled : true,
      });

      if (alternationPreview.rejected) {
        if (
          participant === 'partner' &&
          turnAlternationRef.current.nextExpected === 'self'
        ) {
          lastParentTouchAtRef.current = Date.now();
          scheduleChildTurnCue();
        }
        playAudibleNote(buildTurnNudgeAudio(turnAlternationRef.current.nextExpected));
        return;
      }

      const timestamp = Date.now() - sessionStartRef.current;
      const nextSelfTaps = participant === 'self' ? [...selfTaps, timestamp] : selfTaps;
      const nextPartnerTaps =
        participant === 'partner' ? [...partnerTaps, timestamp] : partnerTaps;
      const nextRhythmTap = [...nextSelfTaps, ...nextPartnerTaps].sort((a, b) => a - b);

      if (participant === 'self') {
        setSelfTaps(nextSelfTaps);
      } else {
        setPartnerTaps(nextPartnerTaps);
      }

      turnAlternationRef.current = alternationPreview;
      setSuccessfulTurnRounds(alternationPreview.consecutiveSuccessfulRounds);

      lastTapByRef.current = participant;
      setLastTapBy(participant);
      pulseRipple(participant, participant === 'partner' ? 0.55 : 0.42);

      if (participant === 'partner') {
        lastParentTouchAtRef.current = Date.now();
      }

      if (participant === 'partner' && alternationPreview.triggerMusicHover) {
        triggerMusicHover();
        return;
      }

      if (participant === 'self') {
        clearTurnTimers();
        setAwaitingChildTurn(false);
      }

      if (audio.isReady) {
        audio.setDrone(resolvePhase2AmbientDrone(alternationPreview.consecutiveSuccessfulRounds));
      }

      if (participant === 'partner') {
        playAudibleNote(buildParentCallAudio());
        scheduleChildTurnCue();
        return;
      }

      const fusion = runPipeline(nextRhythmTap);
      const jointAttention = gaze.snapshot.isJointAttention;
      playAudibleNote(
        buildChildComplementaryAudio(fusion.audioParams, { jointAttention }),
      );

      setTurnRewardTick(Date.now());
      pulseRipple('self', jointAttention ? 0.48 : 0.38);
      rewardAudioTimeoutRef.current = setTimeout(() => {
        playAudibleNote(
          fusion.rewardTriggered
            ? buildJointAttentionSyncRewardAudio()
            : buildChildTurnRewardAudio(),
        );
      }, fusion.rewardTriggered ? 180 : 300);
    },
    [
      audio.isReady,
      audio.setDrone,
      playAudibleNote,
      pulseRipple,
      runPipeline,
      clearTurnTimers,
      scheduleChildTurnCue,
      selfTaps,
      triggerMusicHover,
      gaze.snapshot.isJointAttention,
    ],
  );

  const resetSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setSelfTaps([]);
    setPartnerTaps([]);
    setLastFusion(null);
    setLastTapBy(null);
    lastTapByRef.current = null;
    lastParentTouchAtRef.current = null;
    setRippleBoost(0);
    setLastTapPulse(null);
    setAwaitingChildTurn(false);
    setTurnRewardTick(0);
    setJointAttentionPulseTick(0);
    wasJointAttentionRef.current = false;
    lastJointCueAtRef.current = 0;
    musicHoverActiveRef.current = false;
    setMusicHoverActive(false);
    setSuccessfulTurnRounds(0);
    turnAlternationRef.current = INITIAL_TURN_ALTERNATION;
    clearTurnTimers();
    clearMusicHoverTimers({ resumeAudio: true });
    resetHarmoniNet();
    audio.stop();
    if (audio.isReady) {
      audio.setDrone(buildPhase2SilentDrone());
    }
  }, [audio.isReady, audio.setDrone, audio.stop, audio.resume, clearMusicHoverTimers, clearTurnTimers, resetHarmoniNet]);

  useEffect(
    () => () => {
      clearTurnTimers();
      clearMusicHoverTimers({ resumeAudio: true });
    },
    [clearMusicHoverTimers, clearTurnTimers],
  );

  useEffect(() => {
    if (!audio.isReady) {
      return;
    }
    audio.setScale('pentatonic');
    audio.setDrone(buildPhase2SilentDrone());
  }, [audio.isReady, audio.setDrone, audio.setScale]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRippleBoost((current) => {
        if (current <= 0.01) {
          return current <= 0 ? current : 0;
        }
        return current * 0.94;
      });
    }, 120);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!jointAttentionMonitoring) {
      wasJointAttentionRef.current = false;
      return;
    }

    const active = gaze.snapshot.isJointAttention && !musicHoverActiveRef.current;
    if (!active) {
      wasJointAttentionRef.current = false;
      return;
    }

    if (wasJointAttentionRef.current) {
      return;
    }

    wasJointAttentionRef.current = true;
    const now = Date.now();
    if (now - lastJointCueAtRef.current < PHASE2_JOINT_ATTENTION_CUE_COOLDOWN_MS) {
      return;
    }

    lastJointCueAtRef.current = now;
    setJointAttentionPulseTick(now);
    setRippleBoost((current) => Math.min(1, current + 0.28));
    if (audio.isReady) {
      audio.resume();
      audio.playNote(buildJointAttentionCueAudio());
    }
  }, [
    audio.isReady,
    audio.playNote,
    audio.resume,
    gaze.snapshot.isJointAttention,
    jointAttentionMonitoring,
  ]);

  return {
    gaze,
    audio,
    selfTaps,
    partnerTaps,
    lastFusion,
    lastTapBy,
    lastInferenceMs,
    rippleBoost,
    lastTapPulse,
    awaitingChildTurn,
    turnRewardTick,
    jointAttentionPulseTick,
    musicHoverActive,
    successfulTurnRounds,
    handleTap,
    resetSession,
  };
}
