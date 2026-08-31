import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { ScreenShell } from '@/components/ScreenShell';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useMetricsStore } from '@/hooks/useMetricsStore';
import { buildSyntheticModels } from '@/ml/modelBuilder';
import { setDeveloperMode } from '@/session/developerModeStore';
import { colors, fonts, radii } from '@/theme';

export default function SetupScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const cameraPermission = useCameraPermission();
  const { webViewRef, isReady, onLoadEnd, onMessage } = useAudioEngine();
  const { setSessionDeveloperMode } = useMetricsStore();
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void buildSyntheticModels()
      .then(() => {
        if (!cancelled) {
          setModelsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canStart = modelsReady && isReady;
  const startButtonHeight = Math.max(windowHeight * 0.62, 320);

  const startSession = () => {
    setDeveloperMode(false);
    setSessionDeveloperMode(false);
    if (!cameraPermission.hasPermission) {
      void cameraPermission.requestPermission();
    }
    router.push('/phase1');
  };

  return (
    <ScreenShell title="Kommuni" centered>
      <HiddenAudioEngineWebView
        webViewRef={webViewRef}
        onMessage={onMessage}
        onLoadEnd={onLoadEnd}
      />

      <View style={styles.main}>
        <Pressable
          onPress={startSession}
          disabled={!canStart}
          style={({ pressed }) => [
            styles.startButton,
            { height: startButtonHeight },
            !canStart && styles.startButtonDisabled,
            pressed && canStart && styles.pressed,
          ]}
        >
          {canStart ? (
            <Text style={styles.startButtonText}>Start</Text>
          ) : (
            <ActivityIndicator color={colors.foam} size="large" />
          )}
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  main: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 20,
  },
  startButton: {
    backgroundColor: colors.deepTide,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.foam,
    letterSpacing: -0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
