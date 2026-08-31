import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ParticleField } from '@/components/ParticleField';
import { PhaseTransitionOverlay } from '@/components/PhaseTransitionOverlay';
import { TouchCanvas } from '@/components/TouchCanvas';
import { PHASE1_GUI, PHASE2_GUI } from '@/copy/phaseTitles';
import { PATIENCE_DURATION_MS } from '@/fsm/constants';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { usePhaseFSM } from '@/hooks/usePhaseFSM';
import { useTouchDynamicsVAE } from '@/hooks/useTouchDynamicsVAE';
import { computeConsonanceRate } from '@/metrics/consonance';
import { metricsStore } from '@/metrics/MetricsStore';
import {
  buildDroneParams,
  buildMelodyBridgeAudio,
  createMelodyBridgeState,
  noteThrottleMs,
  recoverStressWhenIdle,
} from '@/ml/melodyBridge';
import { TouchPoint } from '@/ml/touchFeatureExtraction';
import { colors, fonts, radii } from '@/theme';
import { setPhase1Latent } from '@/session/phaseLatentStore';
import { TouchLatent } from '@/types';

const TOUCH_IDLE_MS = 220;
const DRONE_TICK_MS = 120;

export default function Phase1Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ingestTouchSample, emptyLatent } = useTouchDynamicsVAE();
  const melodyBridgeRef = useRef(createMelodyBridgeState());
  const hasTouchedRef = useRef(false);
  const lastTouchAtRef = useRef(0);
  const [latent, setLatent] = useState<TouchLatent>(emptyLatent);
  const [audioCalmness, setAudioCalmness] = useState(0);
  const [hasTouched, setHasTouched] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [consonance, setConsonance] = useState<number | null>(null);
  const lastNoteAtRef = useRef(0);

  const {
    webViewRef,
    isReady,
    playNote,
    setScale,
    setDrone,
    stop,
    onLoadEnd,
    onMessage,
  } = useAudioEngine();

  const fsmStress = hasTouched && isTouching ? latent.stressLevel : 1;
  const fsm = usePhaseFSM(fsmStress);

  useEffect(() => {
    if (isReady) {
      setScale('pentatonic');
    }
  }, [isReady, setScale]);

  useEffect(() => {
    if (isReady) {
      setDrone(buildDroneParams(melodyBridgeRef.current, false));
    }
  }, [isReady, setDrone]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const bridge = melodyBridgeRef.current;
      const idleMs = Date.now() - lastTouchAtRef.current;
      const touching =
        hasTouchedRef.current &&
        lastTouchAtRef.current > 0 &&
        idleMs <= TOUCH_IDLE_MS;

      setIsTouching(touching);

      if (!hasTouchedRef.current) {
        if (isReady) {
          setDrone(buildDroneParams(bridge, false));
        }
        return;
      }

      if (!touching) {
        recoverStressWhenIdle(bridge);
        setAudioCalmness(1 - bridge.smoothedStress);
        if (isReady) {
          setDrone(buildDroneParams(bridge, false));
        }
        return;
      }

      setAudioCalmness(1 - bridge.smoothedStress);
      if (isReady) {
        setDrone(buildDroneParams(bridge, true));
      }
    }, DRONE_TICK_MS);

    return () => clearInterval(intervalId);
  }, [isReady, setDrone]);

  const handleTouchSample = useCallback(
    (sample: [number, number, number, number, number], _point: TouchPoint) => {
      const startedAt = performance.now();
      const result = ingestTouchSample(sample);
      const inferenceMs = performance.now() - startedAt;
      const audioParams = buildMelodyBridgeAudio(
        result.z,
        result.stressLevel,
        melodyBridgeRef.current,
      );
      lastTouchAtRef.current = Date.now();
      hasTouchedRef.current = true;
      setIsTouching(true);
      setHasTouched(true);
      setLatent(result);
      setAudioCalmness(1 - melodyBridgeRef.current.smoothedStress);
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

      setDrone(buildDroneParams(melodyBridgeRef.current, true));

      const throttleMs = noteThrottleMs(melodyBridgeRef.current.smoothedStress);
      const now = Date.now();
      if (now - lastNoteAtRef.current < throttleMs) {
        return;
      }

      lastNoteAtRef.current = now;
      playNote(audioParams);
    },
    [ingestTouchSample, isReady, playNote, setDrone],
  );

  const goToPhase2 = useCallback(() => {
    setPhase1Latent(latent.z);
    stop();
    router.replace('/phase2');
  }, [latent.z, router, stop]);

  const handleTransitionComplete = useCallback(() => {
    fsm.completeTransition();
    goToPhase2();
  }, [fsm.completeTransition, goToPhase2]);

  const onCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  }, []);

  const handleBack = useCallback(() => {
    stop();
    router.back();
  }, [router, stop]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.stage} onLayout={onCanvasLayout}>
          <TouchCanvas
            stressLevel={latent.stressLevel}
            z={latent.z}
            onSample={handleTouchSample}
            edgeToEdge
            showLatentBars
            latentBarBottomReserve={68}
          />

          <View style={styles.overlayLayer} pointerEvents="none">
            <ParticleField
              z={latent.z}
              stressLevel={latent.stressLevel}
              width={layout.width}
              height={layout.height}
              vivid
            />
            <PhaseTransitionOverlay
              active={fsm.showTransition}
              width={layout.width}
              height={layout.height}
              onComplete={handleTransitionComplete}
            />
          </View>

          <View
            style={[styles.topBar, { paddingTop: insets.top + 6 }]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
              hitSlop={8}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <View style={styles.topBarCopy} pointerEvents="none">
              <Text style={styles.title}>{PHASE1_GUI.title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {PHASE1_GUI.description}
              </Text>
              <Text style={styles.hint}>{PHASE1_GUI.hint}</Text>
            </View>
          </View>

          <View style={styles.debugWrap} pointerEvents="none">
            <MetricsDebugOverlay
              latencyMs={lastInferenceMs}
              stress={latent.stressLevel}
              fsm={fsm.phase}
              consonance={consonance}
            />
          </View>

          <View style={styles.footerOverlay} pointerEvents="box-none">
            <View style={styles.footerRow}>
              <View style={styles.footerLeft}>
                <View style={styles.calmMetric} pointerEvents="none">
                  <Text style={styles.metricLabel}>Calm</Text>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricValue}>{audioCalmness.toFixed(2)}</Text>
                    <Text
                      style={[
                        styles.gentleSeconds,
                        fsm.patienceElapsedSeconds > 0 && styles.gentleSecondsActive,
                      ]}
                    >
                      {fsm.patienceElapsedSeconds}s / {PATIENCE_DURATION_MS / 1000}s
                    </Text>
                  </View>
                </View>

                {fsm.isPatienceActive ? (
                  <View style={styles.patienceTrack} pointerEvents="none">
                    <View
                      style={[
                        styles.patienceFill,
                        { width: `${fsm.patienceProgress * 100}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={goToPhase2}
                style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
              >
                <Text style={styles.skipButtonText}>{PHASE2_GUI.skipLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.hiddenAudio} pointerEvents="none">
        <HiddenAudioEngineWebView
          webViewRef={webViewRef}
          onMessage={onMessage}
          onLoadEnd={onLoadEnd}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.mist,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  hiddenAudio: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(244, 250, 249, 0.88)',
    zIndex: 20,
  },
  backButton: {
    paddingTop: 2,
    paddingRight: 4,
  },
  backPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
    fontSize: 15,
  },
  topBarCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 1,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  debugWrap: {
    position: 'absolute',
    top: 72,
    right: 8,
    zIndex: 30,
    maxWidth: 200,
  },
  footerOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerLeft: {
    flex: 1,
    gap: 4,
    maxWidth: '72%',
  },
  calmMetric: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: 'rgba(244, 250, 249, 0.92)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 1,
    minWidth: 168,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricLabel: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontFamily: fonts.displayRegular,
    color: colors.ink,
    fontSize: 13,
  },
  gentleSeconds: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  gentleSecondsActive: {
    color: colors.accent,
  },
  patienceTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(61, 111, 106, 0.15)',
    overflow: 'hidden',
  },
  patienceFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.tide,
  },
  skipButton: {
    backgroundColor: colors.deepTide,
    borderRadius: radii.button,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 168,
    flexShrink: 0,
  },
  skipButtonPressed: {
    opacity: 0.85,
  },
  skipButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.foam,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
