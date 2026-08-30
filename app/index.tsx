import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { ScreenShell } from '@/components/ScreenShell';
import { SETUP_GUI } from '@/copy/phaseTitles';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useMetricsStore } from '@/hooks/useMetricsStore';
import { buildSyntheticModels } from '@/ml/modelBuilder';
import { setDemoMode } from '@/session/demoModeStore';

type InitStep = {
  label: string;
  ready: boolean;
  detail: string;
};

export default function SetupScreen() {
  const router = useRouter();
  const cameraPermission = useCameraPermission();
  const { webViewRef, isReady, diagnostics, onLoadEnd, onMessage } = useAudioEngine();
  const { setSessionDemoMode } = useMetricsStore();
  const [modelsReady, setModelsReady] = useState(false);
  const [modelDetail, setModelDetail] = useState('Synthesizing encoder weights…');
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void buildSyntheticModels()
      .then((paths) => {
        if (cancelled) {
          return;
        }
        setModelsReady(true);
        setModelDetail(
          `In-memory encoder ready (${paths.length} artifact path${paths.length === 1 ? '' : 's'})`,
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setModelsReady(true);
        setModelDetail('Using pure-TS encoder fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canEnterPhase1 = modelsReady && isReady;
  const steps: InitStep[] = [
    {
      label: 'ONNX / encoder sessions',
      ready: modelsReady,
      detail: modelDetail,
    },
    {
      label: 'WebView audio engine',
      ready: isReady,
      detail: diagnostics.errorMessage ?? diagnostics.status,
    },
    {
      label: 'Camera permission',
      ready: cameraPermission.hasPermission,
      detail: cameraPermission.hasPermission
        ? 'Granted — Phase 2 can attempt live gaze'
        : 'Optional for Phase 1; required for native gaze in Phase 2',
    },
  ];

  const startSession = () => {
    setDemoMode(demoModeEnabled);
    setSessionDemoMode(demoModeEnabled);
    router.push('/phase1');
  };

  return (
    <ScreenShell
      title="Kommuni"
      subtitle="Research prototype — on-device multimodal music interaction"
    >
      <HiddenAudioEngineWebView
        webViewRef={webViewRef}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Initialization</Text>
        {steps.map((step) => (
          <View key={step.label} style={styles.stepRow}>
            <Text style={[styles.stepMark, step.ready && styles.stepMarkReady]}>
              {step.ready ? '●' : '○'}
            </Text>
            <View style={styles.stepCopy}>
              <Text style={styles.step}>{step.label}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.note}>
          Phase 1 waits for encoder + audio. Camera permission is requested here so Phase 2 can
          mount a preview; Expo Go is not supported.
        </Text>
      </View>

      {!cameraPermission.hasPermission ? (
        <Pressable
          onPress={() => {
            void cameraPermission.requestPermission();
          }}
          style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
        >
          <Text style={styles.permissionButtonText}>Grant camera access</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => setDemoModeEnabled((current) => !current)}
        style={styles.checkboxRow}
        disabled={!canEnterPhase1}
      >
        <View style={[styles.checkbox, demoModeEnabled && styles.checkboxChecked]}>
          {demoModeEnabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <View style={styles.checkboxCopy}>
          <Text style={styles.checkboxLabel}>{SETUP_GUI.demoModeLabel}</Text>
          <Text style={styles.checkboxHint}>
            {demoModeEnabled ? SETUP_GUI.demoModeHint : SETUP_GUI.researchModeHint}
          </Text>
        </View>
      </Pressable>

      <View style={styles.nav}>
        {canEnterPhase1 ? (
          <Pressable
            onPress={startSession}
            style={({ pressed }) => [
              demoModeEnabled ? styles.demoButton : styles.startButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={demoModeEnabled ? styles.demoButtonText : styles.startButtonText}>
              {demoModeEnabled ? SETUP_GUI.startDemo : SETUP_GUI.startResearch}
            </Text>
            {demoModeEnabled ? (
              <Text style={styles.demoButtonHint}>{SETUP_GUI.demoHint}</Text>
            ) : null}
          </Pressable>
        ) : (
          <Text style={styles.linkDisabled}>Waiting for models + audio…</Text>
        )}
        <Link href="/datalog" style={styles.linkSecondary}>
          Data & Log
        </Link>
        <Link href="/benchmark" style={styles.linkSecondary}>
          Benchmark Mode
        </Link>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151522',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  stepMark: {
    color: '#55556A',
    fontSize: 14,
    marginTop: 1,
  },
  stepMarkReady: {
    color: '#7EE787',
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  step: {
    color: '#8888A0',
    fontSize: 14,
  },
  stepDetail: {
    color: '#666680',
    fontSize: 12,
    lineHeight: 16,
  },
  note: {
    color: '#A9A9C4',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  permissionButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#7EB6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: '#0B0B12',
    fontWeight: '700',
  },
  checkboxRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#7EB6FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151522',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#7EB6FF',
  },
  checkboxMark: {
    color: '#0B0B12',
    fontSize: 14,
    fontWeight: '800',
  },
  checkboxCopy: {
    flex: 1,
    gap: 4,
  },
  checkboxLabel: {
    color: '#F5F5FA',
    fontSize: 15,
    fontWeight: '700',
  },
  checkboxHint: {
    color: '#8888A0',
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
  nav: {
    marginTop: 24,
    gap: 12,
  },
  demoButton: {
    borderRadius: 16,
    backgroundColor: '#7EB6FF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 4,
  },
  demoButtonText: {
    color: '#0B0B12',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  demoButtonHint: {
    color: '#0B0B12',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.75,
  },
  startButton: {
    borderRadius: 12,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: '#3A3A4E',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  startButtonText: {
    color: '#7EB6FF',
    fontSize: 17,
    fontWeight: '700',
  },
  linkDisabled: {
    color: '#55556A',
    fontSize: 16,
    fontWeight: '600',
  },
  linkSecondary: {
    color: '#8888A0',
    fontSize: 14,
  },
});
