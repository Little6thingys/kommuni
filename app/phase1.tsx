import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ParticleField } from '@/components/ParticleField';
import { PhaseTransitionOverlay } from '@/components/PhaseTransitionOverlay';
import { TouchCanvas } from '@/components/TouchCanvas';
import { PATIENCE_DURATION_MS, STRESS_THRESHOLD } from '@/fsm/constants';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { usePhaseFSM } from '@/hooks/usePhaseFSM';
import { useTouchDynamicsVAE } from '@/hooks/useTouchDynamicsVAE';
import { computeConsonanceRate } from '@/metrics/consonance';
import { latentToAudioParams } from '@/ml/musicTheoryMask';
import { TouchPoint } from '@/ml/touchFeatureExtraction';
import { metricsStore } from '@/metrics/MetricsStore';
import { setPhase1Latent } from '@/session/phaseLatentStore';
import { isDemoMode } from '@/session/demoModeStore';
import { TouchLatent } from '@/types';

const NOTE_THROTTLE_MS = 110;

export default function Phase1Screen() {
  const router = useRouter();
  const { ingestTouchSample, emptyLatent } = useTouchDynamicsVAE();
  const [latent, setLatent] = useState<TouchLatent>(emptyLatent);
  const [hasTouched, setHasTouched] = useState(false);
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [consonance, setConsonance] = useState<number | null>(null);
  const lastNoteAtRef = useRef(0);

  const {
    webViewRef,
    isReady,
    playNote,
    setScale,
    stop,
    onLoadEnd,
    onMessage,
  } = useAudioEngine();

  const fsm = usePhaseFSM(hasTouched ? latent.stressLevel : 1);

  useEffect(() => {
    if (isReady) {
      setScale('pentatonic');
    }
  }, [isReady, setScale]);

  const handleTouchSample = useCallback(
    (sample: [number, number, number, number, number], _point: TouchPoint) => {
      const startedAt = performance.now();
      const result = ingestTouchSample(sample);
      const inferenceMs = performance.now() - startedAt;
      const audioParams = latentToAudioParams(result.z, result.stressLevel);
      setHasTouched(true);
      setLatent(result);
      setPhase1Latent(result.z);
      setLastInferenceMs(inferenceMs);
      setConsonance(computeConsonanceRate(audioParams.notes));

      metricsStore.record({
        kind: 'inference',
        payload: {
          inferenceMs,
          stressLevel: result.stressLevel,
        },
      });

      if (!isReady) {
        return;
      }

      const now = Date.now();
      if (now - lastNoteAtRef.current < NOTE_THROTTLE_MS) {
        return;
      }

      lastNoteAtRef.current = now;
      playNote(audioParams);
    },
    [ingestTouchSample, isReady, playNote],
  );

  const goToPhase2 = useCallback(() => {
    setPhase1Latent(latent.z);
    stop();
    router.replace(isDemoMode() ? '/demo' : '/phase2');
  }, [latent.z, router, stop]);

  const handleTransitionComplete = useCallback(() => {
    fsm.completeTransition();
    goToPhase2();
  }, [fsm.completeTransition, goToPhase2]);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <HiddenAudioEngineWebView
        webViewRef={webViewRef}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Phase 1</Text>
        <Text style={styles.subtitle}>
          Touch the canvas — calm below {STRESS_THRESHOLD.toFixed(2)} stress for{' '}
          {PATIENCE_DURATION_MS / 1000}s to enter Phase 2.
        </Text>
      </View>

      <View style={styles.canvasWrap} onLayout={onCanvasLayout}>
        <TouchCanvas
          stressLevel={latent.stressLevel}
          z={latent.z}
          onSample={handleTouchSample}
        />
        <ParticleField z={latent.z} stressLevel={latent.stressLevel} />
        <PhaseTransitionOverlay
          active={fsm.showTransition}
          width={layout.width}
          height={layout.height}
          onComplete={handleTransitionComplete}
        />
        <View style={styles.debugWrap} pointerEvents="none">
          <MetricsDebugOverlay
            latencyMs={lastInferenceMs}
            stress={latent.stressLevel}
            fsm={fsm.phase}
            consonance={consonance}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Stress</Text>
            <Text style={styles.metricValue}>{latent.stressLevel.toFixed(2)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>FSM</Text>
            <Text style={styles.metricValue}>{fsm.phase}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Audio</Text>
            <Text style={styles.metricValue}>{isReady ? 'Ready' : 'Loading'}</Text>
          </View>
        </View>

        {fsm.isPatienceActive ? (
          <View style={styles.patienceTrack}>
            <View
              style={[styles.patienceFill, { width: `${fsm.patienceProgress * 100}%` }]}
            />
          </View>
        ) : null}

        <Pressable
          onPress={goToPhase2}
          style={({ pressed }) => [styles.skipLink, pressed && styles.skipPressed]}
        >
          <Text style={styles.skipText}>
            {isDemoMode() ? 'Skip to Phase 2 (demo)' : 'Skip to Phase 2 (debug)'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B0B12',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 6,
  },
  title: {
    color: '#F5F5FA',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8888A0',
    fontSize: 13,
    lineHeight: 18,
  },
  canvasWrap: {
    flex: 1,
    minHeight: 360,
    borderRadius: 16,
    overflow: 'hidden',
  },
  debugWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 30,
    maxWidth: 220,
  },
  footer: {
    marginTop: 12,
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#151522',
    padding: 10,
    gap: 2,
  },
  metricLabel: {
    color: '#8888A0',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#F5F5FA',
    fontSize: 14,
    fontWeight: '700',
  },
  patienceTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1E1E2C',
    overflow: 'hidden',
  },
  patienceFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7EB6FF',
  },
  skipLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    color: '#666680',
    fontSize: 13,
  },
});
