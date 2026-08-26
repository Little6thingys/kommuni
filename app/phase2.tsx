import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GazeTrackingPreview } from '@/components/GazeTrackingPreview';
import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ScreenShell } from '@/components/ScreenShell';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useCrossAttentionFusion } from '@/hooks/useCrossAttentionFusion';
import { useGazeTracking } from '@/hooks/useGazeTracking';
import { useHarmoniNet } from '@/hooks/useHarmoniNet';
import { computeConsonanceRate } from '@/metrics/consonance';
import { buildGazeFeatureVector } from '@/ml/crossAttention';
import { metricsStore } from '@/metrics/MetricsStore';
import { getPhase1Latent } from '@/session/phaseLatentStore';
import { FusionOutput } from '@/types';

type Participant = 'self' | 'partner';

function formatNotes(notes: number[]): string {
  return notes.length > 0 ? notes.join(', ') : '—';
}

export default function Phase2Screen() {
  const gaze = useGazeTracking();
  const { infer: inferHarmoniNet, reset: resetHarmoniNet } = useHarmoniNet();
  const { fuse } = useCrossAttentionFusion();
  const {
    webViewRef,
    diagnostics,
    isReady,
    onLoadEnd,
    onMessage,
    playNote,
    setScale,
    stop,
  } = useAudioEngine();

  const [selfTaps, setSelfTaps] = useState<number[]>([]);
  const [partnerTaps, setPartnerTaps] = useState<number[]>([]);
  const [lastFusion, setLastFusion] = useState<FusionOutput | null>(null);
  const [lastTapBy, setLastTapBy] = useState<Participant | null>(null);
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
    (participant: Participant) => {
      const timestamp = Date.now() - sessionStartRef.current;
      if (participant === 'self') {
        setSelfTaps((current) => [...current, timestamp]);
      } else {
        setPartnerTaps((current) => [...current, timestamp]);
      }
      setLastTapBy(participant);

      const fusion = runPipeline();
      if (isReady) {
        playNote(fusion.audioParams);
      }
    },
    [isReady, playNote, runPipeline],
  );

  const resetSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setSelfTaps([]);
    setPartnerTaps([]);
    setLastFusion(null);
    setLastTapBy(null);
    resetHarmoniNet();
    stop();
  }, [resetHarmoniNet, stop]);

  useEffect(() => {
    setScale('pentatonic');
  }, [setScale]);

  const prevJointAttentionRef = useRef(gaze.snapshot.isJointAttention);

  useEffect(() => {
    if (!isReady || rhythmTap.length === 0) {
      return;
    }
    if (prevJointAttentionRef.current === gaze.snapshot.isJointAttention) {
      return;
    }
    prevJointAttentionRef.current = gaze.snapshot.isJointAttention;

    const fusion = runPipeline();
    playNote(fusion.audioParams);
  }, [gaze.snapshot.isJointAttention, isReady, playNote, rhythmTap.length, runPipeline]);

  return (
    <ScreenShell
      title="Phase 2"
      subtitle="Dyadic rhythm taps fused with gaze-driven cross-attention audio"
    >
      <View style={styles.debugSlot}>
        <MetricsDebugOverlay
          latencyMs={lastInferenceMs}
          fsm="PHASE2"
          gazeAngle={gaze.snapshot.gazeAngle}
          consonance={
            lastFusion ? computeConsonanceRate(lastFusion.audioParams.notes) : null
          }
        />
      </View>

      <HiddenAudioEngineWebView
        webViewRef={webViewRef}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
      />

      <View style={styles.statusCard}>
        <Text style={styles.statusEyebrow}>Phase 2 loop</Text>
        <Text style={styles.statusTitle}>{gaze.statusLabel}</Text>
        <Text style={styles.statusDetail}>
          Tap rhythm targets for both participants. HarmoniNet and cross-attention drive audio when
          taps or joint attention change.
        </Text>

        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Gaze angle</Text>
            <Text style={styles.metricValue}>
              {gaze.snapshot.gazeAngle.toFixed(1)}
              {'°'}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Joint attention</Text>
            <Text
              style={[
                styles.metricValue,
                gaze.snapshot.isJointAttention && styles.metricValueActive,
              ]}
            >
              {gaze.snapshot.isJointAttention ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Audio</Text>
            <Text style={styles.metricValue}>{diagnostics.status}</Text>
          </View>
        </View>

        {lastFusion ? (
          <View style={styles.fusionCard}>
            <Text style={styles.fusionTitle}>
              {lastFusion.rewardTriggered ? 'Reward chord triggered' : 'Latest fusion output'}
            </Text>
            <Text style={styles.fusionMeta}>
              Notes: {formatNotes(lastFusion.audioParams.notes)} | filter:{' '}
              {lastFusion.audioParams.filterFreq.toFixed(0)} Hz | overtones:{' '}
              {lastFusion.audioParams.overtones.length}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {gaze.canRequestPermission ? (
            <Pressable onPress={gaze.requestPermission} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Grant camera access</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={resetSession} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Reset session</Text>
          </Pressable>
        </View>

        {gaze.blockers.length > 0 ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {gaze.permissionGranted ? 'Fallback active' : 'Permission fallback active'}
            </Text>
            {gaze.blockers.map((blocker) => (
              <Text key={blocker} style={styles.bannerText}>
                • {blocker}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.split}>
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Camera / Gaze</Text>
          <View style={styles.cameraFrame}>
            {gaze.showLiveCameraPreview ? (
              <>
                <GazeTrackingPreview
                  device={gaze.cameraDevice}
                  enableNativeTracking={gaze.enableNativeTracking}
                  modelPath={gaze.modelPath}
                  onSnapshot={gaze.setNativeSnapshot}
                  onRuntimeError={gaze.setNativeError}
                />
                <View style={styles.gazeOverlay} pointerEvents="none">
                  <View
                    style={[
                      styles.jointAttentionRing,
                      gaze.snapshot.isJointAttention && styles.jointAttentionRingActive,
                    ]}
                  />
                  <Text style={styles.overlayMetric}>
                    {gaze.snapshot.gazeAngle.toFixed(1)}° gaze
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.cameraFrame, styles.placeholderCenter]}>
                <Text style={styles.panelHint}>
                  Camera preview will appear here after permission is granted.
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.panelHint}>
            {gaze.isMocked
              ? 'Mocked gaze feeds cross-attention until native tracking is ready.'
              : 'Live gaze features update fusion and overtone boosts on joint attention.'}
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Dyadic Rhythm Tap</Text>
          <Text style={styles.panelHint}>
            Self taps: {selfTaps.length} | Partner taps: {partnerTaps.length}
            {lastTapBy ? ` | Last tap: ${lastTapBy}` : ''}
          </Text>

          <View style={styles.tapRow}>
            <Pressable
              onPress={() => handleTap('self')}
              style={({ pressed }) => [
                styles.tapPad,
                styles.tapPadSelf,
                pressed && styles.tapPadPressed,
              ]}
            >
              <Text style={styles.tapPadLabel}>You</Text>
              <Text style={styles.tapPadHint}>Tap</Text>
            </Pressable>

            <Pressable
              onPress={() => handleTap('partner')}
              style={({ pressed }) => [
                styles.tapPad,
                styles.tapPadPartner,
                pressed && styles.tapPadPressed,
              ]}
            >
              <Text style={styles.tapPadLabel}>Partner</Text>
              <Text style={styles.tapPadHint}>Tap</Text>
            </Pressable>
          </View>

          <View style={styles.capabilityList}>
            {gaze.capabilities.map((capability) => (
              <Text key={capability.label} style={styles.capabilityItem}>
                {capability.ready ? '●' : '○'} {capability.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <Link href="/datalog" style={styles.link}>
        End session → Data Log
      </Link>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: 16,
    backgroundColor: '#151522',
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  statusEyebrow: {
    color: '#7EB6FF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusTitle: {
    color: '#F5F5FA',
    fontSize: 18,
    fontWeight: '700',
  },
  statusDetail: {
    color: '#A6A6BA',
    fontSize: 14,
    lineHeight: 20,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metric: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#10101A',
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: '#8888A0',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#F5F5FA',
    fontSize: 18,
    fontWeight: '700',
  },
  metricValueActive: {
    color: '#7EE787',
  },
  fusionCard: {
    borderRadius: 12,
    backgroundColor: '#101726',
    borderWidth: 1,
    borderColor: '#2D3B57',
    padding: 12,
    gap: 4,
  },
  fusionTitle: {
    color: '#F5F5FA',
    fontWeight: '700',
  },
  fusionMeta: {
    color: '#A6A6BA',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#7EB6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#0B0B12',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#35354A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#C8C8D8',
    fontWeight: '600',
  },
  banner: {
    borderRadius: 12,
    backgroundColor: '#261A1A',
    borderWidth: 1,
    borderColor: '#593535',
    padding: 12,
    gap: 4,
  },
  bannerTitle: {
    color: '#FFC9C9',
    fontWeight: '700',
  },
  bannerText: {
    color: '#F2C0C0',
    fontSize: 13,
    lineHeight: 18,
  },
  split: {
    flex: 1,
    gap: 12,
    minHeight: 320,
  },
  panel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    borderStyle: 'dashed',
    padding: 16,
    gap: 12,
  },
  panelLabel: {
    color: '#C8C8D8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  panelHint: {
    color: '#666680',
    fontSize: 14,
    lineHeight: 20,
  },
  cameraFrame: {
    minHeight: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12131A',
  },
  placeholderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  gazeOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jointAttentionRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(126, 182, 255, 0.35)',
  },
  jointAttentionRingActive: {
    borderColor: '#7EE787',
    backgroundColor: 'rgba(126, 231, 135, 0.12)',
  },
  overlayMetric: {
    position: 'absolute',
    bottom: 12,
    color: '#F5F5FA',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(11, 11, 18, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tapRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  tapPad: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    gap: 4,
  },
  tapPadSelf: {
    backgroundColor: '#142038',
    borderColor: '#4067A5',
  },
  tapPadPartner: {
    backgroundColor: '#1A1428',
    borderColor: '#6A4AA5',
  },
  tapPadPressed: {
    opacity: 0.75,
  },
  tapPadLabel: {
    color: '#F5F5FA',
    fontSize: 18,
    fontWeight: '700',
  },
  tapPadHint: {
    color: '#A6A6BA',
    fontSize: 13,
  },
  capabilityList: {
    gap: 8,
    marginTop: 8,
  },
  capabilityItem: {
    color: '#A6A6BA',
    fontSize: 13,
  },
  link: {
    marginTop: 16,
    color: '#7EB6FF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugSlot: {
    marginBottom: 16,
  },
});
