import { useCallback, useMemo, useRef, useState } from 'react';
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

const TRAIL_LENGTH = 24;
const LATENT_BAR_COUNT = 8;

type TouchCanvasProps = {
  stressLevel: number;
  z: Float32Array;
  onSample: (sample: TouchFeatureTuple, point: TouchPoint) => void;
};

function stressHue(stressLevel: number): number {
  return 210 - stressLevel * 150;
}

export function TouchCanvas({ stressLevel, z, onSample }: TouchCanvasProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [active, setActive] = useState(false);
  const [touchPoint, setTouchPoint] = useState<TouchPoint | null>(null);
  const [trail, setTrail] = useState<TouchPoint[]>([]);
  const historyRef = useRef<TouchPoint[]>([]);

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

  return (
    <View style={styles.container} onLayout={onLayout} {...panResponder.panHandlers}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(size.width, size.height)}
            colors={['#0B0B12', '#12182A', '#0B0B12']}
          />
        </Rect>

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

        <Group transform={[{ translateY: size.height - 96 }]}>
          {Array.from({ length: LATENT_BAR_COUNT }, (_, index) => {
            const value = Math.abs(z[index] ?? 0);
            const barHeight = 12 + value * 56;
            const x = 24 + index * (latentBarWidth + 8);
            return (
              <RoundedRect
                key={`latent-${index}`}
                x={x}
                y={72 - barHeight}
                width={latentBarWidth}
                height={barHeight}
                r={6}
                color={`hsla(${hue + index * 8}, 72%, ${48 + value * 28}%, 0.9)`}
              />
            );
          })}
        </Group>
      </Canvas>

      {!active && trail.length === 0 ? (
        <View pointerEvents="none" style={styles.hintOverlay}>
          <Text style={styles.hintText}>Draw on the canvas to play</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B0B12',
    borderWidth: 1,
    borderColor: '#222233',
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
});
