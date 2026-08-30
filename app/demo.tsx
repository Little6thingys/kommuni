import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GazeTrackingPreview } from '@/components/GazeTrackingPreview';
import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { MusicHoverOverlay } from '@/components/MusicHoverOverlay';
import { Phase2RippleStage } from '@/components/Phase2RippleStage';
import { Phase2TopBar } from '@/components/Phase2TopBar';
import { usePhase2Session } from '@/hooks/usePhase2Session';
import { computeConsonanceRate } from '@/metrics/consonance';

function formatNotes(notes: number[]): string {
  return notes.length > 0 ? notes.join(', ') : '—';
}

export default function DemoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [rewardFlash, setRewardFlash] = useState(false);
  const [showRealtimeData, setShowRealtimeData] = useState(false);
  const [lowerHeight, setLowerHeight] = useState(200);

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
      <HiddenAudioEngineWebView
        webViewRef={audio.webViewRef}
        onMessage={audio.onMessage}
        onLoadEnd={audio.onLoadEnd}
      />

      <Phase2TopBar
        topInset={insets.top}
        onBack={() => router.back()}
        rightSlot={
          <Pressable onPress={resetSession} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>重置</Text>
          </Pressable>
        }
      />

      <View
        style={[
          styles.cameraArea,
          { top: -insets.top, bottom: lowerHeight },
        ]}
      >
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
                  ? '请授权相机以显示面对面画面'
                  : '相机预览加载中…'}
              </Text>
              {gaze.canRequestPermission ? (
                <Pressable onPress={gaze.requestPermission} style={styles.cameraPermissionButton}>
                  <Text style={styles.cameraPermissionButtonText}>授权相机</Text>
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
        <SafeAreaView style={styles.lowerSafe} edges={['bottom']}>
        <View style={styles.rippleStage}>
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

        {showRealtimeData ? (
          <View style={styles.realtimePanel}>
            <ScrollView
              style={styles.realtimeScroll}
              contentContainerStyle={styles.realtimeScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <MetricsDebugOverlay
                latencyMs={lastInferenceMs}
                fsm="PHASE2"
                gazeAngle={gaze.snapshot.gazeAngle}
                consonance={
                  lastFusion ? computeConsonanceRate(lastFusion.audioParams.notes) : null
                }
                transparent
              />
              <Text style={styles.realtimeRow}>
                Gaze: {gaze.snapshot.gazeAngle.toFixed(1)}° ·{' '}
                {gaze.isMocked ? 'mocked' : gaze.statusLabel}
              </Text>
              {lastFusion ? (
                <Text style={styles.realtimeRow}>
                  Notes: {formatNotes(lastFusion.audioParams.notes)}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push('/datalog')}
            hitSlop={10}
            style={({ pressed }) => [styles.endSessionButton, pressed && styles.endSessionButtonPressed]}
          >
            <Text style={styles.link}>End session → Data Log</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowRealtimeData((current) => !current)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, showRealtimeData && styles.checkboxChecked]}>
              {showRealtimeData ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>Show real time data</Text>
          </Pressable>
        </View>
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
  resetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(11, 11, 18, 0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetButtonText: {
    color: '#F5F5FA',
    fontSize: 12,
    fontWeight: '600',
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
  cameraPermissionButton: {
    borderRadius: 999,
    backgroundColor: '#7EB6FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  cameraPermissionButtonText: {
    color: '#0B0B12',
    fontWeight: '700',
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
    flexGrow: 0,
    flexShrink: 0,
    gap: 4,
  },
  rippleStage: {
    flexGrow: 0,
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: '#2A3348',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
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
  link: {
    color: '#7EB6FF',
    fontSize: 13,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7EB6FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151522',
  },
  checkboxChecked: {
    backgroundColor: '#7EB6FF',
  },
  checkboxMark: {
    color: '#0B0B12',
    fontSize: 12,
    fontWeight: '800',
  },
  checkboxLabel: {
    color: '#C8C8D8',
    fontSize: 11,
    fontWeight: '600',
  },
  realtimePanel: {
    maxHeight: 100,
    marginHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 11, 18, 0.88)',
    borderWidth: 1,
    borderColor: '#2A3348',
  },
  realtimeScroll: {
    flexGrow: 0,
  },
  realtimeScrollContent: {
    padding: 8,
    gap: 4,
  },
  realtimeRow: {
    color: '#E8E8F0',
    fontSize: 11,
    lineHeight: 16,
  },
});
