import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { ScreenShell } from '@/components/ScreenShell';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { buildSyntheticModels } from '@/ml/modelBuilder';

type InitStep = {
  label: string;
  ready: boolean;
  detail: string;
};

export default function SetupScreen() {
  const router = useRouter();
  const cameraPermission = useCameraPermission();
  const { webViewRef, isReady, diagnostics, onLoadEnd, onMessage } = useAudioEngine();
  const [modelsReady, setModelsReady] = useState(false);
  const [modelDetail, setModelDetail] = useState('Synthesizing encoder weights…');

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

      <View style={styles.nav}>
        {canEnterPhase1 ? (
          <Pressable
            onPress={() => router.push('/phase1')}
            style={({ pressed }) => [styles.primaryLinkWrap, pressed && styles.pressed]}
          >
            <Text style={styles.link}>Continue to Phase 1 →</Text>
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
  pressed: {
    opacity: 0.75,
  },
  nav: {
    marginTop: 24,
    gap: 12,
  },
  primaryLinkWrap: {
    alignSelf: 'flex-start',
  },
  link: {
    color: '#7EB6FF',
    fontSize: 16,
    fontWeight: '600',
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
