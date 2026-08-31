import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GazeTrackingPreview } from '@/components/GazeTrackingPreview';
import { PHASE2_GUI } from '@/copy/phaseTitles';
import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { JointAttentionIndicator } from '@/components/JointAttentionIndicator';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { MusicHoverOverlay } from '@/components/MusicHoverOverlay';
import { Phase2RippleStage } from '@/components/Phase2RippleStage';
import { Phase2TopBar } from '@/components/Phase2TopBar';
import { usePhase2Session } from '@/hooks/usePhase2Session';
import { computeConsonanceRate } from '@/metrics/consonance';
import { colors, fonts, radii } from '@/theme';

export default function Phase2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
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
    jointAttentionPulseTick,
    musicHoverActive,
    successfulTurnRounds,
    handleTap,
    resetSession,
  } = usePhase2Session({ jointAttentionMonitoring: isFocused });

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

        <View style={styles.jointAttentionOverlay} pointerEvents="none">
          <JointAttentionIndicator
            active={gaze.snapshot.isJointAttention}
            nativeReady={gaze.enableNativeTracking}
          />
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
              jointAttentionPulseTick={jointAttentionPulseTick}
              isChildTurn={awaitingChildTurn}
              rewardTick={turnRewardTick}
              musicHoverActive={musicHoverActive}
              successfulTurnRounds={successfulTurnRounds}
              onTap={handleTap}
            />
          </View>

          <View style={styles.actions}>
            <Pressable onPress={resetSession} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {PHASE2_GUI.resetSessionShortLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/datalog')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{PHASE2_GUI.dataLogShortLabel}</Text>
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
    backgroundColor: colors.mist,
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
    backgroundColor: colors.lagoon,
    overflow: 'hidden',
    zIndex: 1,
  },
  cameraFill: {
    ...StyleSheet.absoluteFill,
  },
  jointAttentionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '18%',
    zIndex: 5,
    alignItems: 'center',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  cameraPlaceholderText: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
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
    backgroundColor: colors.mist,
  },
  lowerSafe: {
    gap: 4,
  },
  stage: {
    flexGrow: 0,
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: colors.lagoon,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButton: {
    borderRadius: radii.button,
    backgroundColor: colors.deepTide,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.foam,
    fontSize: 13,
  },
  secondaryButton: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.lagoon,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13,
  },
  banner: {
    borderRadius: radii.card,
    backgroundColor: colors.foam,
    borderWidth: 1,
    borderColor: colors.warnSoft,
    padding: 12,
    gap: 4,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  bannerTitle: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
  bannerText: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
});
