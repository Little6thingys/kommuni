import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GazeTrackingPreview } from '@/components/GazeTrackingPreview';
import { HiddenAudioEngineWebView } from '@/components/HiddenAudioEngineWebView';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { Phase2Participant, usePhase2Session } from '@/hooks/usePhase2Session';
import { computeConsonanceRate } from '@/metrics/consonance';

function formatNotes(notes: number[]): string {
  return notes.length > 0 ? notes.join(', ') : '—';
}

type RhythmDot = {
  id: string;
  participant: Phase2Participant;
};

function buildRhythmDots(
  selfTaps: number[],
  partnerTaps: number[],
  maxDots = 12,
): RhythmDot[] {
  const merged = [
    ...selfTaps.map((time, index) => ({
      id: `self-${time}-${index}`,
      participant: 'self' as const,
      time,
    })),
    ...partnerTaps.map((time, index) => ({
      id: `partner-${time}-${index}`,
      participant: 'partner' as const,
      time,
    })),
  ].sort((a, b) => a.time - b.time);

  return merged.slice(-maxDots).map(({ id, participant }) => ({ id, participant }));
}

function JointAttentionBadge({ active }: { active: boolean }) {
  return (
    <View style={[styles.jointBadge, active && styles.jointBadgeActive]}>
      <View style={[styles.jointDot, active && styles.jointDotActive]} />
      <Text style={[styles.jointLabel, active && styles.jointLabelActive]}>
        {active ? '共同注视' : '等待注视'}
      </Text>
    </View>
  );
}

function DrumPad({
  label,
  hint,
  accent,
  pressed,
  onPress,
}: {
  label: string;
  hint: string;
  accent: 'self' | 'partner';
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed: isPressed }) => [
        styles.drumPad,
        accent === 'self' ? styles.drumPadSelf : styles.drumPadPartner,
        (isPressed || pressed) && styles.drumPadActive,
      ]}
    >
      <Text style={styles.drumIcon}>🥁</Text>
      <Text style={styles.drumLabel}>{label}</Text>
      <Text style={styles.drumHint}>{hint}</Text>
    </Pressable>
  );
}

export default function DemoScreen() {
  const router = useRouter();
  const {
    gaze,
    audio,
    selfTaps,
    partnerTaps,
    lastFusion,
    lastTapBy,
    lastInferenceMs,
    handleTap,
    resetSession,
  } = usePhase2Session();
  const [rewardFlash, setRewardFlash] = useState(false);
  const [tapPulse, setTapPulse] = useState<Phase2Participant | null>(null);
  const [showRealtimeData, setShowRealtimeData] = useState(false);

  const rhythmDots = useMemo(
    () => buildRhythmDots(selfTaps, partnerTaps),
    [partnerTaps, selfTaps],
  );

  useEffect(() => {
    if (!lastFusion?.rewardTriggered) {
      return;
    }
    setRewardFlash(true);
    const timer = setTimeout(() => setRewardFlash(false), 1400);
    return () => clearTimeout(timer);
  }, [lastFusion]);

  useEffect(() => {
    if (!lastTapBy) {
      return;
    }
    setTapPulse(lastTapBy);
    const timer = setTimeout(() => setTapPulse(null), 220);
    return () => clearTimeout(timer);
  }, [lastTapBy, selfTaps.length, partnerTaps.length]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <HiddenAudioEngineWebView
        webViewRef={audio.webViewRef}
        onMessage={audio.onMessage}
        onLoadEnd={audio.onLoadEnd}
      />

      <View style={styles.stage}>
        <View style={styles.cameraArea}>
          {gaze.showLiveCameraPreview ? (
            <>
              <GazeTrackingPreview
                device={gaze.cameraDevice}
                enableNativeTracking={gaze.enableNativeTracking}
                modelPath={gaze.modelPath}
                onSnapshot={gaze.setNativeSnapshot}
                onRuntimeError={gaze.setNativeError}
                resizeMode="contain"
                edgeToEdge
              />
              <View style={styles.gazeOverlay} pointerEvents="none">
                <View
                  style={[
                    styles.jointAttentionRing,
                    gaze.snapshot.isJointAttention && styles.jointAttentionRingActive,
                  ]}
                />
              </View>
            </>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraPlaceholderText}>
                {gaze.canRequestPermission
                  ? '请授权相机以启用眼神追踪'
                  : '相机预览加载中…'}
              </Text>
              {gaze.canRequestPermission ? (
                <Pressable onPress={gaze.requestPermission} style={styles.cameraPermissionButton}>
                  <Text style={styles.cameraPermissionButtonText}>授权相机</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← 返回</Text>
            </Pressable>
            <Text style={styles.title}>Kommuni Demo</Text>
            <JointAttentionBadge active={gaze.snapshot.isJointAttention} />
            <Pressable onPress={resetSession} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>重置</Text>
            </Pressable>
          </View>

          {rewardFlash ? (
            <View style={styles.rewardFlash} pointerEvents="none">
              <Text style={styles.rewardFlashText}>Harmony!</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.rhythmRow}>
          {rhythmDots.length === 0 ? (
            <Text style={styles.rhythmHint}>轮流敲击鼓垫，建立节奏</Text>
          ) : (
            rhythmDots.map((dot) => (
              <View
                key={dot.id}
                style={[
                  styles.rhythmDot,
                  dot.participant === 'self' ? styles.rhythmDotSelf : styles.rhythmDotPartner,
                ]}
              />
            ))
          )}
        </View>

        {showRealtimeData ? (
          <View style={styles.realtimePanel} pointerEvents="box-none">
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

              <View style={styles.realtimeBlock}>
                <Text style={styles.realtimeTitle}>Gaze</Text>
                <Text style={styles.realtimeRow}>
                  Gaze angle: {gaze.snapshot.gazeAngle.toFixed(1)}°
                </Text>
                <Text style={styles.realtimeRow}>
                  Joint attention: {gaze.snapshot.isJointAttention ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.realtimeRow}>
                  Head yaw: {gaze.snapshot.headPose.yaw.toFixed(1)}° · pitch:{' '}
                  {gaze.snapshot.headPose.pitch.toFixed(1)}°
                </Text>
                <Text style={styles.realtimeRow}>
                  Status: {gaze.statusLabel}
                  {gaze.isMocked ? ' (mocked)' : ''}
                </Text>
                <Text style={styles.realtimeRow}>Audio: {audio.diagnostics.status}</Text>
              </View>

              <View style={styles.realtimeBlock}>
                <Text style={styles.realtimeTitle}>Fusion</Text>
                {lastFusion ? (
                  <Text style={styles.realtimeRow}>
                    Notes: {formatNotes(lastFusion.audioParams.notes)} | filter:{' '}
                    {lastFusion.audioParams.filterFreq.toFixed(0)} Hz | overtones:{' '}
                    {lastFusion.audioParams.overtones.length}
                    {lastFusion.rewardTriggered ? ' | reward' : ''}
                  </Text>
                ) : (
                  <Text style={styles.realtimeMuted}>No fusion output yet</Text>
                )}
                <Text style={styles.realtimeRow}>
                  Self taps: {selfTaps.length} | Partner taps: {partnerTaps.length}
                  {lastTapBy ? ` | Last: ${lastTapBy}` : ''}
                </Text>
              </View>

              <View style={styles.realtimeBlock}>
                <Text style={styles.realtimeTitle}>Capabilities</Text>
                {gaze.capabilities.map((capability) => (
                  <Text key={capability.label} style={styles.realtimeRow}>
                    {capability.ready ? '●' : '○'} {capability.label}
                  </Text>
                ))}
                {gaze.blockers.length > 0 ? (
                  <>
                    <Text style={[styles.realtimeTitle, styles.realtimeTitleSpaced]}>Blockers</Text>
                    {gaze.blockers.map((blocker) => (
                      <Text key={blocker} style={styles.realtimeMuted}>
                        • {blocker}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.drumRow}>
        <DrumPad
          label="玩家 A"
          hint="左侧"
          accent="self"
          pressed={tapPulse === 'self'}
          onPress={() => handleTap('self')}
        />
        <DrumPad
          label="玩家 B"
          hint="右侧"
          accent="partner"
          pressed={tapPulse === 'partner'}
          onPress={() => handleTap('partner')}
        />
      </View>

      <View style={styles.footer}>
        <Link href="/datalog" style={styles.link}>
          End session → Data Log
        </Link>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B12',
    gap: 6,
  },
  stage: {
    flex: 5,
    minHeight: 280,
    position: 'relative',
  },
  cameraArea: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#12131A',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(11, 11, 18, 0.72)',
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 4,
  },
  backButtonText: {
    color: '#7EB6FF',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    color: '#F5F5FA',
    fontSize: 16,
    fontWeight: '700',
  },
  jointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#35354A',
    backgroundColor: '#151522',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  jointBadgeActive: {
    borderColor: '#3D6B47',
    backgroundColor: '#14261A',
  },
  jointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#55556A',
  },
  jointDotActive: {
    backgroundColor: '#7EE787',
  },
  jointLabel: {
    color: '#A6A6BA',
    fontSize: 12,
    fontWeight: '600',
  },
  jointLabelActive: {
    color: '#7EE787',
  },
  resetButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#35354A',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetButtonText: {
    color: '#C8C8D8',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  cameraPlaceholderText: {
    color: '#8888A0',
    textAlign: 'center',
    fontSize: 14,
  },
  cameraPermissionButton: {
    borderRadius: 999,
    backgroundColor: '#7EB6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cameraPermissionButtonText: {
    color: '#0B0B12',
    fontWeight: '700',
  },
  gazeOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jointAttentionRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(126, 182, 255, 0.35)',
  },
  jointAttentionRingActive: {
    borderColor: '#7EE787',
    backgroundColor: 'rgba(126, 231, 135, 0.12)',
  },
  rewardFlash: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 214, 102, 0.22)',
  },
  rewardFlashText: {
    color: '#FFE8A3',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rhythmRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  rhythmHint: {
    color: '#666680',
    fontSize: 13,
  },
  rhythmDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rhythmDotSelf: {
    backgroundColor: '#7EB6FF',
  },
  rhythmDotPartner: {
    backgroundColor: '#B48CFF',
  },
  drumRow: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
    paddingBottom: 6,
    minHeight: 130,
  },
  drumPad: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  drumPadSelf: {
    backgroundColor: '#142038',
    borderColor: '#4067A5',
  },
  drumPadPartner: {
    backgroundColor: '#1A1428',
    borderColor: '#6A4AA5',
  },
  drumPadActive: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  drumIcon: {
    fontSize: 32,
  },
  drumLabel: {
    color: '#F5F5FA',
    fontSize: 20,
    fontWeight: '800',
  },
  drumHint: {
    color: '#A6A6BA',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 12,
  },
  link: {
    color: '#7EB6FF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
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
    lineHeight: 14,
  },
  checkboxLabel: {
    color: '#C8C8D8',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  realtimePanel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    maxHeight: '50%',
    backgroundColor: 'rgba(11, 11, 18, 0.42)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(126, 182, 255, 0.2)',
  },
  realtimeScroll: {
    flexGrow: 0,
  },
  realtimeScrollContent: {
    padding: 10,
    gap: 10,
  },
  realtimeBlock: {
    gap: 3,
  },
  realtimeTitle: {
    color: '#7EB6FF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  realtimeTitleSpaced: {
    marginTop: 6,
  },
  realtimeRow: {
    color: '#E8E8F0',
    fontSize: 11,
    lineHeight: 16,
  },
  realtimeMuted: {
    color: '#8888A0',
    fontSize: 11,
    lineHeight: 16,
  },
});
