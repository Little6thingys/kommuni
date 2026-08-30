import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GazeTrackingPreview } from '@/components/GazeTrackingPreview';
import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { MusicHoverOverlay } from '@/components/MusicHoverOverlay';
import { Phase2RippleStage } from '@/components/Phase2RippleStage';
import { Phase2TopBar } from '@/components/Phase2TopBar';
import { usePhase2Session } from '@/hooks/usePhase2Session';
import { computeConsonanceRate } from '@/metrics/consonance';

export default function Phase2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lowerHeight, setLowerHeight] = useState(200);
  const [rewardFlash, setRewardFlash] = useState(false);
  const {
    gaze,
    audio,
    lastFusion,
    lastInferenceMs,
    rippleBoost,
    lastTapPulse,
    awaitingChildTurn,
    turnRewardTick,
    musicHoverActive,
    successfulTurnRounds,
    handleTap,
    resetSession,
  } = usePhase2Session();

  useEffect(() => {
    if (!turnRewardTick) {
      return;
    }
    setRewardFlash(true);
    const timer = setTimeout(() => setRewardFlash(false), 1400);
    return () => clearTimeout(timer);
  }, [turnRewardTick]);

  return (
    <View style={styles.root}>
      <Phase2TopBar topInset={insets.top} onBack={() => router.back()} />

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
        webViewRef={audio.webViewRef}
        onMessage={audio.onMessage}
        onLoadEnd={audio.onLoadEnd}
      />

      <View style={[styles.cameraArea, { top: -insets.top, bottom: lowerHeight }]}>
        <View style={styles.cameraFill} pointerEvents="none">
          {gaze.showLiveCameraPreview && gaze.cameraDevice ? (
            <GazeTrackingPreview
              device={gaze.cameraDevice}
              enableNativeTracking={gaze.enableNativeTracking}
              modelPath={gaze.modelPath}
              onSnapshot={gaze.setNativeSnapshot}
              onRuntimeError={gaze.setNativeError}
              edgeToEdge
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraPlaceholderText}>
                {gaze.canRequestPermission
                  ? 'Grant camera access for face-to-face preview'
                  : 'Camera preview loading…'}
              </Text>
              {gaze.canRequestPermission ? (
                <Pressable onPress={gaze.requestPermission} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Grant camera access</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {rewardFlash && !musicHoverActive ? (
          <View style={styles.rewardFlash} pointerEvents="none">
            <Text style={styles.rewardFlashText}>👍</Text>
          </View>
        ) : null}
      </View>

      <MusicHoverOverlay active={musicHoverActive} />

      <View
        style={styles.lowerDock}
        onLayout={(event) => {
          setLowerHeight(event.nativeEvent.layout.height);
        }}
      >
        <SafeAreaView edges={['bottom']} style={styles.lowerSafe}>
          <View style={styles.stage}>
            <Phase2RippleStage
              rippleBoost={rippleBoost}
              lastTapPulse={lastTapPulse}
              isJointAttention={gaze.snapshot.isJointAttention}
              isChildTurn={awaitingChildTurn}
              rewardTick={turnRewardTick}
              musicHoverActive={musicHoverActive}
              successfulTurnRounds={successfulTurnRounds}
              onTap={handleTap}
            />
          </View>

          <View style={styles.actions}>
            <Pressable onPress={resetSession} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Reset session</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/datalog')}
              hitSlop={10}
              style={({ pressed }) => [styles.endSessionButton, pressed && styles.endSessionButtonPressed]}
            >
              <Text style={styles.link}>End session → Data Log</Text>
            </Pressable>
          </View>

          {gaze.blockers.length > 0 ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>{gaze.statusLabel}</Text>
              {gaze.blockers.map((blocker) => (
                <Text key={blocker} style={styles.bannerText}>
                  • {blocker}
                </Text>
              ))}
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B12',
  },
  debugSlot: {
    position: 'absolute',
    top: 72,
    right: 8,
    zIndex: 25,
    maxWidth: 200,
  },
  cameraArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#12131A',
    overflow: 'hidden',
    zIndex: 1,
  },
  cameraFill: {
    ...StyleSheet.absoluteFill,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  cameraPlaceholderText: {
    color: '#8888A0',
    fontSize: 14,
    textAlign: 'center',
  },
  rewardFlash: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 186, 73, 0.22)',
  },
  rewardFlashText: {
    fontSize: 56,
    lineHeight: 64,
  },
  lowerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
    backgroundColor: '#0B0B12',
  },
  lowerSafe: {
    gap: 4,
  },
  stage: {
    flexGrow: 0,
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: '#2A3348',
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  endSessionButton: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  endSessionButtonPressed: {
    opacity: 0.7,
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
    marginHorizontal: 12,
    marginBottom: 8,
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
  link: {
    color: '#7EB6FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
