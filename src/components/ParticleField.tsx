import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

const PARTICLE_COUNT = 36;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hueOffset: number;
};

type ParticleFieldProps = {
  z: Float32Array;
  stressLevel: number;
};

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 1.4,
    vy: (Math.random() - 0.5) * 1.4,
    radius: 2 + Math.random() * 4,
    hueOffset: index * 7,
  }));
}

export function ParticleField({ z, stressLevel }: ParticleFieldProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [frame, setFrame] = useState(0);
  const particles = useMemo(
    () => createParticles(size.width, size.height),
    [size.height, size.width],
  );

  useEffect(() => {
    let rafId = 0;
    const loop = () => {
      setFrame((current) => current + 1);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const baseHue = 210 - stressLevel * 140 + (z[0] ?? 0) * 24;
  const energy = Math.min(1, stressLevel + Math.abs(z[1] ?? 0) * 0.35);
  const drift = frame * (0.08 + energy * 0.12);

  return (
    <View pointerEvents="none" style={styles.overlay} onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        {particles.map((particle, index) => {
          const x =
            (particle.x +
              Math.sin((drift + index) * 0.03) * (18 + energy * 40) +
              particle.vx * drift) %
            size.width;
          const y =
            (particle.y +
              Math.cos((drift + index) * 0.025) * (14 + energy * 32) +
              particle.vy * drift) %
            size.height;
          const brightness = 48 + energy * 34 + Math.abs(z[index % 8] ?? 0) * 18;

          return (
            <Circle
              key={`particle-${index}`}
              cx={x < 0 ? x + size.width : x}
              cy={y < 0 ? y + size.height : y}
              r={particle.radius + energy * 2.5}
              color={`hsla(${baseHue + particle.hueOffset}, 82%, ${brightness}%, ${
                0.18 + energy * 0.42
              })`}
            />
          );
        })}
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
  },
});
