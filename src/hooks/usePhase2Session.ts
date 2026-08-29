import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useCrossAttentionFusion } from '@/hooks/useCrossAttentionFusion';
import { useGazeTracking } from '@/hooks/useGazeTracking';
import { useHarmoniNet } from '@/hooks/useHarmoniNet';
import { buildGazeFeatureVector } from '@/ml/crossAttention';
import { metricsStore } from '@/metrics/MetricsStore';
import { getPhase1Latent } from '@/session/phaseLatentStore';
import { FusionOutput } from '@/types';

export type Phase2Participant = 'self' | 'partner';

export function usePhase2Session() {
  const gaze = useGazeTracking();
  const { infer: inferHarmoniNet, reset: resetHarmoniNet } = useHarmoniNet();
  const { fuse } = useCrossAttentionFusion();
  const audio = useAudioEngine();

  const [selfTaps, setSelfTaps] = useState<number[]>([]);
  const [partnerTaps, setPartnerTaps] = useState<number[]>([]);
  const [lastFusion, setLastFusion] = useState<FusionOutput | null>(null);
  const [lastTapBy, setLastTapBy] = useState<Phase2Participant | null>(null);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const sessionStartRef = useRef(Date.now());
  const phase1LatentRef = useRef(getPhase1Latent());

  const rhythmTap = useMemo(
    () => [...selfTaps, ...partnerTaps].sort((a, b) => a - b),
    [partnerTaps, selfTaps],
  );

  const gazeVector = useMemo(
    () => buildGazeFeatureVector(gaze.snapshot),
    [gaze.snapshot],
  );

  const runPipeline = useCallback(() => {
    const startedAt = performance.now();
    const harmoni = inferHarmoniNet(phase1LatentRef.current, rhythmTap);
    const fusion = fuse(harmoni.chordVector, gazeVector, gaze.snapshot.isJointAttention, {
      tension: harmoni.tension,
      rhythmTap,
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
  }, [fuse, gaze.snapshot.isJointAttention, gazeVector, inferHarmoniNet, rhythmTap]);

  const handleTap = useCallback(
    (participant: Phase2Participant) => {
      const timestamp = Date.now() - sessionStartRef.current;
      if (participant === 'self') {
        setSelfTaps((current) => [...current, timestamp]);
      } else {
        setPartnerTaps((current) => [...current, timestamp]);
      }
      setLastTapBy(participant);

      const fusion = runPipeline();
      if (audio.isReady) {
        audio.playNote(fusion.audioParams);
      }
    },
    [audio.isReady, audio.playNote, runPipeline],
  );

  const resetSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setSelfTaps([]);
    setPartnerTaps([]);
    setLastFusion(null);
    setLastTapBy(null);
    resetHarmoniNet();
    audio.stop();
  }, [audio.stop, resetHarmoniNet]);

  useEffect(() => {
    audio.setScale('pentatonic');
  }, [audio.setScale]);

  const prevJointAttentionRef = useRef(gaze.snapshot.isJointAttention);

  useEffect(() => {
    if (!audio.isReady || rhythmTap.length === 0) {
      return;
    }
    if (prevJointAttentionRef.current === gaze.snapshot.isJointAttention) {
      return;
    }
    prevJointAttentionRef.current = gaze.snapshot.isJointAttention;

    const fusion = runPipeline();
    audio.playNote(fusion.audioParams);
  }, [
    audio.isReady,
    audio.playNote,
    gaze.snapshot.isJointAttention,
    rhythmTap.length,
    runPipeline,
  ]);

  return {
    gaze,
    audio,
    selfTaps,
    partnerTaps,
    lastFusion,
    lastTapBy,
    lastInferenceMs,
    handleTap,
    resetSession,
  };
}
