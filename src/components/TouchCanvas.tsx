import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

import {
  extractTouchFeatures,
  TouchFeatureTuple,
  TouchPoint,
} from '@/ml/touchFeatureExtraction';

import { CALM_AMBIENT_BLOBS, CALM_SPARKLE_COUNT, calmSparklePoint } from './calmAmbient';

const TRAIL_LENGTH = 24;
const LATENT_BAR_COUNT = 8;
const LATENT_DOCK_HEIGHT = 96;
const LATENT_BAR_HUES = [188, 210, 232, 255, 168, 145, 38, 285] as const;

function latentDisplayLevel(
  z: Float32Array,
  index: number,
  stressLevel: number,
): number {
  const raw = Math.abs(z[index] ?? 0);
  const boosted =
    index >= 6
      ? raw
      : Math.min(1, raw * 6.5 + stressLevel * 0.22);
  return Math.min(1, Math.pow(boosted, 0.7));
}

function latentBarColor(
  index: number,
  level: number,
  stressLevel: number,
  zValue: number,
): string {
  const baseHue = LATENT_BAR_HUES[index % LATENT_BAR_HUES.length];
  const warmShift = stressLevel * 28;
  const hue = (baseHue + warmShift) % 360;
  const lightness = 46 + level * 30 + (zValue >= 0 ? 6 : 0);
  const saturation = 74 + level * 20;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${0.82 + level * 0.16})`;
}

type TouchCanvasProps = {
  stressLevel: number;
  z: Float32Array;
  onSample: (sample: TouchFeatureTuple, point: TouchPoint) => void;
  edgeToEdge?: boolean;
  showLatentBars?: boolean;
  /** Extra space reserved above the bottom edge (e.g. footer metrics). */
  latentBarBottomReserve?: number;
};

function stressHue(stressLevel: number): number {
  return 210 - stressLevel * 150;
}

export function TouchCanvas({
  stressLevel,
  z,
  onSample,
  edgeToEdge,
  showLatentBars = true,
  latentBarBottomReserve = 16,
}: TouchCanvasProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(false);
  const [touchPoint, setTouchPoint] = useState<TouchPoint | null>(null);
  const [trail, setTrail] = useState<TouchPoint[]>([]);
  const [ambientFrame, setAmbientFrame] = useState(0);
  const historyRef = useRef<TouchPoint[]>([]);
  const barLevelsRef = useRef(new Float32Array(LATENT_BAR_COUNT));

  useEffect(() => {
    if (!edgeToEdge) {
      return;
    }

    let rafId = 0;
    const loop = () => {
      setAmbientFrame((frame) => frame + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [edgeToEdge]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const recordPoint = useCallback(
    (x: number, y: number) => {
      const point: TouchPoint = { x, y, t: Date.now() };
      const history = [...historyRef.current, point].slice(-TRAIL_LENGTH);
      historyRef.current = history;
      setTouchPoint(point);
      setTrail(history);
      const sample = extractTouchFeatures(history);
      onSample(sample, point);
    },
    [onSample],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setActive(true);
          recordPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderMove: (event) => {
          recordPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          setActive(false);
        },
        onPanResponderTerminate: () => {
          setActive(false);
        },
      }),
    [recordPoint],
  );

  const hue = stressHue(stressLevel);
  const touchRadius = 18 + stressLevel * 28;
  const latentBarWidth = Math.max(12, (size.width - 48) / LATENT_BAR_COUNT - 8);
  const latentDockY = Math.max(
    0,
    size.height - latentBarBottomReserve - LATENT_DOCK_HEIGHT,
  );
  const ambientDrift = ambientFrame * 0.06;
  const minSide = Math.min(size.width, size.height);

  for (let index = 0; index < LATENT_BAR_COUNT; index += 1) {
    const target = latentDisplayLevel(z, index, stressLevel);
    const current = barLevelsRef.current[index] ?? 0;
    barLevelsRef.current[index] = current + (target - current) * 0.32;
  }

  return (
    <View
      style={[styles.container, edgeToEdge && styles.containerEdgeToEdge]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(size.width, size.height)}
            colors={
              edgeToEdge
                ? ['#081018', '#102038', '#141830', '#0A1220']
                : ['#0B0B12', '#12182A', '#0B0B12']
            }
          />
        </Rect>

        {edgeToEdge
          ? CALM_AMBIENT_BLOBS.map((blob, index) => {
              const pulse = 0.5 + 0.5 * Math.sin(ambientDrift * 0.5 + index);
              const radius = blob.size * minSide * (0.9 + pulse * 0.1);
              return (
                <Circle
                  key={`ambient-blob-${index}`}
                  cx={blob.x * size.width + Math.sin(ambientDrift * 0.25 + index) * 10}
                  cy={blob.y * size.height + Math.cos(ambientDrift * 0.22 + index) * 8}
                  r={radius}
                  color={`hsla(${blob.hue}, 58%, 56%, ${0.11 + pulse * 0.09})`}
                />
              );
            })
          : null}

        {edgeToEdge
          ? Array.from({ length: CALM_SPARKLE_COUNT }, (_, index) => {
              const sparkle = calmSparklePoint(index, size.width, size.height);
              const twinkle =
                0.3 + 0.26 * Math.sin(ambientDrift * 0.6 + index * 0.55);
              return (
                <Circle
                  key={`ambient-sparkle-${index}`}
                  cx={sparkle.x}
                  cy={sparkle.y}
                  r={sparkle.radius}
                  color={`hsla(${sparkle.hue}, 76%, 72%, ${twinkle})`}
                />
              );
            })
          : null}

        {trail.map((point, index) => {
          const alpha = (index + 1) / trail.length;
          return (
            <Circle
              key={`${point.t}-${index}`}
              cx={point.x}
              cy={point.y}
              r={4 + alpha * 10}
              color={`hsla(${hue}, 78%, ${42 + alpha * 24}%, ${alpha * 0.45})`}
            />
          );
        })}

        {touchPoint ? (
          <Group>
            <Circle
              cx={touchPoint.x}
              cy={touchPoint.y}
              r={touchRadius}
              color={`hsla(${hue}, 85%, ${55 + stressLevel * 20}%, 0.22)`}
            />
            <Circle
              cx={touchPoint.x}
              cy={touchPoint.y}
              r={8 + stressLevel * 10}
              color={`hsl(${hue}, 88%, ${62 + stressLevel * 18}%)`}
            />
          </Group>
        ) : null}

        {showLatentBars ? (
          <Group transform={[{ translateY: latentDockY }]}>
            {Array.from({ length: LATENT_BAR_COUNT }, (_, index) => {
              const level = barLevelsRef.current[index] ?? 0;
              const zValue = z[index] ?? 0;
              const barHeight = 10 + level * (LATENT_DOCK_HEIGHT - 14);
              const x = 20 + index * (latentBarWidth + 8);
              const pulse = 1 + Math.sin(ambientDrift * 0.8 + index * 0.9) * 0.04 * level;
              return (
                <Group key={`latent-${index}`}>
                  <RoundedRect
                    x={x}
                    y={6}
                    width={latentBarWidth}
                    height={LATENT_DOCK_HEIGHT - 12}
                    r={7}
                    color="rgba(18, 22, 38, 0.72)"
                  />
                  <RoundedRect
                    x={x}
                    y={LATENT_DOCK_HEIGHT - barHeight * pulse}
                    width={latentBarWidth}
                    height={barHeight * pulse}
                    r={7}
                    color={latentBarColor(index, level, stressLevel, zValue)}
                  />
                  <RoundedRect
                    x={x + 2}
                    y={LATENT_DOCK_HEIGHT - barHeight * pulse + 2}
                    width={Math.max(4, latentBarWidth - 4)}
                    height={Math.max(6, barHeight * pulse * 0.35)}
                    r={4}
                    color={`rgba(255, 255, 255, ${0.08 + level * 0.18})`}
                  />
                </Group>
              );
            })}
          </Group>
        ) : null}
      </Canvas>

      {!active && trail.length === 0 ? (
        <View pointerEvents="none" style={styles.hintOverlay}>
          <Text style={[styles.hintText, edgeToEdge && styles.hintTextEdge]}>
            Draw anywhere to play
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B0B12',
    borderWidth: 1,
    borderColor: '#222233',
  },
  containerEdgeToEdge: {
    borderRadius: 0,
    borderWidth: 0,
  },
  hintOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#8888A0',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 18, 28, 0.72)',
    borderWidth: 1,
    borderColor: '#2A3348',
  },
  hintTextEdge: {
    marginTop: 48,
  },
});
