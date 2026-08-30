import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

import { CALM_AMBIENT_BLOBS, CALM_SPARKLE_COUNT, calmSparklePoint } from './calmAmbient';

type ParticleFieldProps = {
  z: Float32Array;
  stressLevel: number;
  width: number;
  height: number;
  vivid?: boolean;
};

type DriftParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hueOffset: number;
};

const PARTICLE_COUNT = 64;

function createParticles(width: number, height: number): DriftParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    x: (((index * 131) % 1000) / 1000) * width,
    y: (((index * 79) % 1000) / 1000) * height,
    vx: (Math.random() - 0.5) * 1.1,
    vy: (Math.random() - 0.5) * 1.1,
    radius: 2.5 + (index % 5) * 0.9,
    hueOffset: index * 9,
  }));
}

export function ParticleField({
  z,
  stressLevel,
  width,
  height,
  vivid = true,
}: ParticleFieldProps) {
  const [frame, setFrame] = useState(0);
  const particles = useMemo(
    () => createParticles(Math.max(width, 1), Math.max(height, 1)),
    [height, width],
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

  if (width < 2 || height < 2) {
    return null;
  }

  const baseHue = 205 - stressLevel * 90 + (z[0] ?? 0) * 18;
  const energy = Math.min(
    1,
    (vivid ? 0.42 : 0.2) + stressLevel * 0.5 + Math.abs(z[1] ?? 0) * 0.28,
  );
  const drift = frame * (0.06 + energy * 0.1);
  const minSide = Math.min(width, height);

  return (
    <View pointerEvents="none" style={[styles.overlay, { width, height }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {CALM_AMBIENT_BLOBS.map((blob, index) => {
          const pulse = 0.5 + 0.5 * Math.sin(drift * 0.04 + index * 1.1);
          const radius = blob.size * minSide * (0.92 + pulse * 0.12);
          return (
            <Circle
              key={`blob-${index}`}
              cx={blob.x * width + Math.sin(drift * 0.02 + index) * 12}
              cy={blob.y * height + Math.cos(drift * 0.018 + index) * 10}
              r={radius}
              color={`hsla(${blob.hue + stressLevel * 18}, 62%, 58%, ${0.1 + pulse * 0.1})`}
            />
          );
        })}

        {Array.from({ length: CALM_SPARKLE_COUNT }, (_, index) => {
          const sparkle = calmSparklePoint(index, width, height);
          const twinkle =
            0.34 + 0.28 * Math.sin(drift * 0.05 + index * 0.65 + (z[index % 8] ?? 0));
          return (
            <Circle
              key={`sparkle-${index}`}
              cx={sparkle.x}
              cy={sparkle.y}
              r={sparkle.radius + energy * 0.8}
              color={`hsla(${sparkle.hue}, 78%, 74%, ${twinkle})`}
            />
          );
        })}

        {particles.map((particle, index) => {
          const x =
            (particle.x +
              Math.sin((drift + index) * 0.028) * (22 + energy * 36) +
              particle.vx * drift) %
            width;
          const y =
            (particle.y +
              Math.cos((drift + index) * 0.024) * (18 + energy * 30) +
              particle.vy * drift) %
            height;
          const brightness = 56 + energy * 30 + Math.abs(z[index % 8] ?? 0) * 18;

          return (
            <Circle
              key={`particle-${index}`}
              cx={x < 0 ? x + width : x}
              cy={y < 0 ? y + height : y}
              r={particle.radius + energy * 2.8}
              color={`hsla(${baseHue + particle.hueOffset * 1.2}, 86%, ${brightness}%, ${
                0.42 + energy * 0.35
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
    top: 0,
  },
});
