import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';

import { visual } from '@/theme';

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
  hue: number;
  sat: number;
};

const PARTICLE_COUNT = 48;

function createParticles(width: number, height: number): DriftParticle[] {
  const hues = visual.phase1LatentBarHues;
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    x: (((index * 131) % 1000) / 1000) * width,
    y: (((index * 79) % 1000) / 1000) * height,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    radius: 2 + (index % 5) * 0.7,
    hue: hues[index % hues.length],
    sat: 38 + (index % 4) * 10,
  }));
}

function stressHue(stressLevel: number): number {
  const t = Math.min(1, Math.max(0, stressLevel));
  return visual.phase1CalmHue + (visual.phase1StressedHue - visual.phase1CalmHue) * t;
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

  const stressShift = stressHue(stressLevel) - visual.phase1CalmHue;
  const energy = Math.min(
    1,
    (vivid ? 0.28 : 0.14) + stressLevel * 0.35 + Math.abs(z[1] ?? 0) * 0.2,
  );
  const drift = frame * (0.05 + energy * 0.07);
  const minSide = Math.min(width, height);

  return (
    <View pointerEvents="none" style={[styles.overlay, { width, height }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {CALM_AMBIENT_BLOBS.map((blob, index) => {
          const pulse = 0.5 + 0.5 * Math.sin(drift * 0.04 + index * 1.1);
          const radius = blob.size * minSide * (0.92 + pulse * 0.12);
          const hue = (blob.hue + stressShift * 0.35) % 360;
          return (
            <Circle
              key={`blob-${index}`}
              cx={blob.x * width + Math.sin(drift * 0.02 + index) * 12}
              cy={blob.y * height + Math.cos(drift * 0.018 + index) * 10}
              r={radius}
              color={`hsla(${hue}, ${blob.sat}%, 64%, ${0.12 + pulse * 0.1})`}
            />
          );
        })}

        {Array.from({ length: CALM_SPARKLE_COUNT }, (_, index) => {
          const sparkle = calmSparklePoint(index, width, height);
          const twinkle =
            0.18 + 0.16 * Math.sin(drift * 0.05 + index * 0.65 + (z[index % 8] ?? 0));
          const hue = (sparkle.hue + stressShift * 0.25) % 360;
          return (
            <Circle
              key={`sparkle-${index}`}
              cx={sparkle.x}
              cy={sparkle.y}
              r={sparkle.radius + energy * 0.5}
              color={`hsla(${hue}, ${sparkle.sat}%, 56%, ${twinkle})`}
            />
          );
        })}

        {particles.map((particle, index) => {
          const x =
            (particle.x +
              Math.sin((drift + index) * 0.028) * (18 + energy * 28) +
              particle.vx * drift) %
            width;
          const y =
            (particle.y +
              Math.cos((drift + index) * 0.024) * (14 + energy * 22) +
              particle.vy * drift) %
            height;
          const hue = (particle.hue + stressShift * 0.4 + (z[index % 8] ?? 0) * 18) % 360;
          const brightness = 44 + energy * 20 + Math.abs(z[index % 8] ?? 0) * 14;

          return (
            <Circle
              key={`particle-${index}`}
              cx={x < 0 ? x + width : x}
              cy={y < 0 ? y + height : y}
              r={particle.radius + energy * 2}
              color={`hsla(${hue}, ${particle.sat}%, ${brightness}%, ${
                0.24 + energy * 0.28
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
