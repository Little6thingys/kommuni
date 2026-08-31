import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import { PHASE2_GUI } from '@/copy/phaseTitles';
import { PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS } from '@/ml/phase2TurnStreak';
import { Phase2Participant, Phase2TapPulse } from '@/hooks/usePhase2Session';
import { colors, fonts, radii, visual } from '@/theme';

type FlowWave = {
  id: number;
  participant: Phase2Participant;
  offset: number;
  speed: number;
};

type Phase2RippleStageProps = {
  rippleBoost: number;
  lastTapPulse: Phase2TapPulse | null;
  isJointAttention: boolean;
  jointAttentionPulseTick?: number;
  isChildTurn?: boolean;
  rewardTick?: number;
  musicHoverActive?: boolean;
  successfulTurnRounds?: number;
  onTap: (participant: Phase2Participant) => void;
};

const WAVE_LIFETIME = 1.15;
const CHILD_TURN_BLINK_RATE = 12.5;
const REWARD_FLASH_MS = 1400;
const JOINT_PULSE_MS = 900;

function participantSide(participant: Phase2Participant): 'left' | 'right' {
  return participant === 'partner' ? 'left' : 'right';
}

export function Phase2RippleStage({
  rippleBoost,
  lastTapPulse,
  isJointAttention,
  jointAttentionPulseTick = 0,
  isChildTurn = false,
  rewardTick = 0,
  musicHoverActive = false,
  successfulTurnRounds = 0,
  onTap,
}: Phase2RippleStageProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [frame, setFrame] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [showJointPulse, setShowJointPulse] = useState(false);
  const wavesRef = useRef<FlowWave[]>([]);
  const waveIdRef = useRef(0);
  const lastPulseTickRef = useRef(0);
  const boostRef = useRef(rippleBoost);

  boostRef.current = rippleBoost;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  useEffect(() => {
    if (!lastTapPulse || lastTapPulse.tick === lastPulseTickRef.current) {
      return;
    }
    lastPulseTickRef.current = lastTapPulse.tick;
    const batch = Array.from({ length: 5 }, (_, index) => ({
      id: waveIdRef.current++,
      participant: lastTapPulse.participant,
      offset: index * 0.08,
      speed: 0.72 + index * 0.06,
    }));
    wavesRef.current = [...wavesRef.current, ...batch].slice(-24);
  }, [lastTapPulse]);

  useEffect(() => {
    if (!jointAttentionPulseTick) {
      return;
    }
    setShowJointPulse(true);
    const timer = setTimeout(() => setShowJointPulse(false), JOINT_PULSE_MS);
    return () => clearTimeout(timer);
  }, [jointAttentionPulseTick]);

  useEffect(() => {
    if (!rewardTick) {
      return;
    }
    setShowReward(true);
    const timer = setTimeout(() => setShowReward(false), REWARD_FLASH_MS);
    return () => clearTimeout(timer);
  }, [rewardTick]);

  useEffect(() => {
    let rafId = 0;
    let mounted = true;

    const loop = () => {
      if (!mounted) {
        return;
      }

      wavesRef.current = wavesRef.current
        .map((wave) => ({ ...wave, offset: wave.offset + 0.018 * wave.speed }))
        .filter((wave) => wave.offset < WAVE_LIFETIME + 0.2);

      startTransition(() => {
        setFrame((value) => value + 1);
      });

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  const centerX = size.width * 0.5;
  const centerY = size.height * 0.5;
  const drift = frame * 0.04;
  const hoverExpansion = musicHoverActive ? 2.15 + 0.14 * Math.sin(drift * 2.4) : 1;
  const poolRadius =
    Math.min(size.width, size.height) * (0.14 + boostRef.current * 0.04) * hoverExpansion;
  const poolPulse = 0.5 + 0.5 * Math.sin(drift * 1.4);
  const jointGlow = isJointAttention ? 1 : 0.35 + boostRef.current * 0.4;
  const childBlink = isChildTurn ? 0.5 + 0.5 * Math.sin(drift * CHILD_TURN_BLINK_RATE) : 0;
  const childBlinkSharp = isChildTurn && Math.sin(drift * CHILD_TURN_BLINK_RATE) > 0;
  const rewardPulse =
    showReward || musicHoverActive || showJointPulse
      ? 0.5 + 0.5 * Math.sin(drift * 6)
      : 0;
  const jointPulse = showJointPulse ? 0.5 + 0.5 * Math.sin(drift * 8) : 0;

  const flowPaths = wavesRef.current.map((wave) => {
    const side = participantSide(wave.participant);
    const progress = Math.min(1, wave.offset / WAVE_LIFETIME);
    const eased = 1 - (1 - progress) ** 2.2;
    const startX = side === 'left' ? size.width * 0.1 : size.width * 0.9;
    const startY = size.height * (0.62 + Math.sin(wave.id) * 0.03);
    const ctrlX = side === 'left' ? size.width * 0.34 : size.width * 0.66;
    const ctrlY = size.height * 0.42;
    const x = startX + (centerX - startX) * eased;
    const y = startY + (centerY - startY) * eased;
    const path = Skia.Path.Make();
    path.moveTo(startX, startY);
    path.quadTo(ctrlX, ctrlY, x, y);
    const hue = wave.participant === 'partner' ? visual.partnerHue : visual.selfHue;
    const alpha = Math.max(0, (1 - progress) * 0.48);
    return { id: wave.id, path, hue, alpha, progress, x, y };
  });

  return (
    <View style={styles.container}>
      <View style={styles.visualPane} onLayout={onLayout}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(size.width, size.height)}
              colors={[...visual.phase2Gradient]}
            />
          </Rect>

          {Array.from({ length: 2 }, (_, ring) => {
            const ringPulse = 0.5 + 0.5 * Math.sin(drift * 0.9 + ring * 1.1);
            const radius = poolRadius * (1.35 + ring * 0.42 + ringPulse * 0.08);
            return (
              <Circle
                key={`pool-ring-${ring}`}
                cx={centerX}
                cy={centerY}
                r={radius}
                color={`hsla(${176 + ring * 4}, 38%, 62%, ${0.08 + jointGlow * 0.1})`}
              />
            );
          })}

          <Circle
            cx={centerX}
            cy={centerY}
            r={poolRadius * (0.92 + poolPulse * 0.06)}
            color={
              musicHoverActive
                ? `hsla(38, 52%, 72%, ${0.28 + rewardPulse * 0.18})`
                : `hsla(176, 42%, 58%, ${0.16 + boostRef.current * 0.18})`
            }
          />
          <Circle
            cx={centerX}
            cy={centerY}
            r={poolRadius * (0.42 + (musicHoverActive ? rewardPulse * 0.12 : 0))}
            color={
              musicHoverActive
                ? `hsla(36, 58%, 74%, ${0.3 + rewardPulse * 0.22})`
                : `hsla(168, 48%, 62%, ${0.2 + jointGlow * 0.16})`
            }
          />

          {musicHoverActive
            ? Array.from({ length: 3 }, (_, ring) => {
                const swell = 0.5 + 0.5 * Math.sin(drift * 3.6 + ring * 0.85);
                return (
                  <Circle
                    key={`hover-ring-${ring}-${Math.floor(frame / 5)}`}
                    cx={centerX}
                    cy={centerY}
                    r={poolRadius * (0.75 + ring * 0.28 + swell * 0.18)}
                    color={`hsla(38, 48%, 68%, ${(0.12 - ring * 0.025) * swell})`}
                  />
                );
              })
            : null}

          {flowPaths.map((flow) => (
            <Path
              key={`flow-${flow.id}-${Math.floor(flow.progress * 100)}`}
              path={flow.path}
              style="stroke"
              strokeWidth={10 + flow.progress * 6}
              color={`hsla(${flow.hue}, 46%, 56%, ${flow.alpha})`}
            />
          ))}

          {flowPaths.map((flow) => (
            <Circle
              key={`spark-${flow.id}-${Math.floor(flow.progress * 100)}`}
              cx={flow.x}
              cy={flow.y}
              r={5 + flow.progress * 8}
              color={`hsla(${flow.hue}, 50%, 58%, ${flow.alpha * 0.85})`}
            />
          ))}

          {showReward ? (
            <>
              {Array.from({ length: 5 }, (_, ring) => {
                const burst = 0.5 + 0.5 * Math.sin(drift * 5.2 + ring * 0.75);
                const alpha = (0.38 - ring * 0.06) * burst;
                return (
                  <Circle
                    key={`reward-ring-${ring}-${Math.floor(frame / 4)}`}
                    cx={centerX}
                    cy={centerY}
                    r={poolRadius * (1 + ring * 0.48 + burst * 0.32 + rewardPulse * 0.18)}
                    color={`hsla(36, 48%, 62%, ${alpha})`}
                  />
                );
              })}
              <Circle
                cx={centerX}
                cy={centerY}
                r={poolRadius * (0.62 + rewardPulse * 0.18)}
                color={`hsla(38, 52%, 68%, ${0.32 + rewardPulse * 0.28})`}
              />
            </>
          ) : null}

          {isJointAttention ? (
            <Circle
              cx={centerX}
              cy={centerY}
              r={poolRadius * (1.55 + jointPulse * 0.12)}
              color={`rgba(111, 168, 162, ${0.16 + jointPulse * 0.14})`}
            />
          ) : null}
        </Canvas>

        {isJointAttention ? (
          <View style={styles.jointAttentionBadge} pointerEvents="none">
            <Text style={styles.jointAttentionText}>{PHASE2_GUI.jointAttentionActive}</Text>
          </View>
        ) : null}

        {showJointPulse ? (
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.jointPulseEmoji}>{PHASE2_GUI.jointAttentionRewardEmoji}</Text>
          </View>
        ) : null}

        {(musicHoverActive || showReward) ? (
          <View style={styles.centerLabel} pointerEvents="none">
            {musicHoverActive ? (
              <Text style={styles.hoverEmoji}>😊</Text>
            ) : (
              <Text style={styles.rewardEmoji}>👍</Text>
            )}
          </View>
        ) : null}
      </View>

      {musicHoverActive ? (
        <View style={styles.hoverDockBanner} pointerEvents="none">
          <Text style={styles.hoverDockEmoji}>😊</Text>
        </View>
      ) : null}

      {successfulTurnRounds > 0 && !musicHoverActive ? (
        <Text style={styles.streakHint} pointerEvents="none">
          {PHASE2_GUI.turnStreakLabel} {successfulTurnRounds}/{PHASE2_MUSIC_HOVER_SUCCESS_ROUNDS}
        </Text>
      ) : null}

      <View style={styles.tapRow}>
        <Pressable
          onPress={() => onTap('partner')}
          style={({ pressed }) => [
            styles.tapZone,
            styles.tapZonePartner,
            isChildTurn && styles.tapZoneDimmed,
            pressed && styles.tapZonePressed,
          ]}
        >
          <Text style={styles.tapIcon}>{PHASE2_GUI.tapDrumIcon}</Text>
          <Text style={styles.tapTitle}>{PHASE2_GUI.parentTapLabel}</Text>
        </Pressable>

        <Pressable
          onPress={() => onTap('self')}
          style={({ pressed }) => [
            styles.tapZone,
            styles.tapZoneSelf,
            isChildTurn && {
              borderColor: childBlinkSharp ? colors.ripple : colors.accent,
              borderWidth: childBlinkSharp ? 2.5 : 2,
              backgroundColor: childBlinkSharp
                ? 'rgba(197, 226, 221, 0.65)'
                : 'rgba(244, 250, 249, 0.92)',
              shadowColor: colors.tide,
              shadowOpacity: childBlink * 0.35,
              shadowRadius: 4 + childBlink * 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 2 + Math.round(childBlink * 3),
            },
            showReward && styles.tapZoneSelfReward,
            pressed && styles.tapZonePressed,
          ]}
        >
          <Text style={[styles.tapIcon, isChildTurn && childBlinkSharp && styles.tapIconBlink]}>
            {PHASE2_GUI.tapDrumIcon}
          </Text>
          <Text style={[styles.tapTitle, isChildTurn && childBlinkSharp && styles.tapTitleBlink]}>
            {PHASE2_GUI.childTapLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.mist,
  },
  visualPane: {
    height: 108,
    overflow: 'hidden',
    backgroundColor: colors.mist,
  },
  centerLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rewardEmoji: {
    fontSize: 40,
    lineHeight: 46,
  },
  hoverEmoji: {
    fontSize: 52,
    lineHeight: 58,
  },
  hoverDockBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(244, 250, 249, 0.92)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lagoon,
  },
  jointAttentionBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    backgroundColor: 'rgba(244, 250, 249, 0.9)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.tide,
  },
  jointAttentionText: {
    fontFamily: fonts.bodyMedium,
    color: colors.deepTide,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  jointPulseEmoji: {
    fontSize: 44,
    lineHeight: 50,
  },
  hoverDockEmoji: {
    fontSize: 64,
    lineHeight: 72,
  },
  streakHint: {
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 11,
    paddingTop: 4,
  },
  tapRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tapZone: {
    flex: 1,
    minHeight: 130,
    borderRadius: radii.button,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 16,
    backgroundColor: colors.foam,
  },
  tapZonePartner: {
    borderColor: colors.tide,
  },
  tapZoneSelf: {
    borderColor: colors.accent,
  },
  tapZoneSelfReward: {
    borderColor: colors.ripple,
    borderWidth: 2.5,
    backgroundColor: colors.rippleSoft,
    shadowColor: colors.tide,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  tapZoneDimmed: {
    opacity: 0.55,
  },
  tapZonePressed: {
    opacity: 0.85,
  },
  tapIcon: {
    fontSize: 28,
    lineHeight: 32,
  },
  tapIconBlink: {
    opacity: 1,
  },
  tapTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16,
  },
  tapTitleBlink: {
    color: colors.deepTide,
  },
});
