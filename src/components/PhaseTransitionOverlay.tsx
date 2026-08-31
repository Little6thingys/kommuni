import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Rect } from '@shopify/react-native-skia';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PHASE_TRANSITION_MS } from '@/fsm/constants';
import { colors } from '@/theme';

type PhaseTransitionOverlayProps = {
  active: boolean;
  width: number;
  height: number;
  onComplete: () => void;
};

export function PhaseTransitionOverlay({
  active,
  width,
  height,
  onComplete,
}: PhaseTransitionOverlayProps) {
  const radius = useSharedValue(0);
  const maxRadius = Math.hypot(width, height) * 0.75;
  const centerX = width / 2;
  const centerY = height / 2;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const notifyComplete = useCallback(() => {
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (!active) {
      radius.value = 0;
      return;
    }

    radius.value = withTiming(maxRadius, { duration: PHASE_TRANSITION_MS }, (finished) => {
      if (finished) {
        runOnJS(notifyComplete)();
      }
    });
  }, [active, maxRadius, notifyComplete, radius]);

  const animatedRadius = useDerivedValue(() => radius.value);

  if (!active) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height} color="rgba(232, 241, 240, 0.55)" />
        <Circle
          cx={centerX}
          cy={centerY}
          r={animatedRadius}
          color={`${colors.ripple}EB`}
        />
        <Circle
          cx={centerX}
          cy={centerY}
          r={animatedRadius}
          color="rgba(244, 250, 249, 0.22)"
          blendMode="screen"
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
  },
});
