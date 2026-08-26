import { TouchLatent } from '@/types';

const WINDOW_SAMPLES = 32;
const FEATURES_PER_SAMPLE = 5;
const INPUT_SIZE = WINDOW_SAMPLES * FEATURES_PER_SAMPLE;
const LATENT_DIM = 8;

function createEncoderWeights(rows: number, cols: number, seed: number): Float32Array {
  const weights = new Float32Array(rows * cols);
  let state = seed >>> 0;

  for (let i = 0; i < weights.length; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    weights[i] = (state / 0xffffffff) * 2 - 1;
  }

  return weights;
}

const ENCODER_WEIGHTS = createEncoderWeights(LATENT_DIM, INPUT_SIZE, 0x4b0f_1a2c);
const ENCODER_BIAS = createEncoderWeights(LATENT_DIM, 1, 0x9e37_79b9);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function summarizeDynamics(window: Float32Array): {
  velocityMag: number;
  accelMag: number;
  curvatureMean: number;
} {
  let velocityMag = 0;
  let accelMag = 0;
  let curvatureMean = 0;

  for (let i = 0; i < WINDOW_SAMPLES; i += 1) {
    const base = i * FEATURES_PER_SAMPLE;
    velocityMag += Math.hypot(window[base], window[base + 1]);
    accelMag += Math.hypot(window[base + 2], window[base + 3]);
    curvatureMean += Math.abs(window[base + 4]);
  }

  const norm = 1 / WINDOW_SAMPLES;
  return {
    velocityMag: velocityMag * norm,
    accelMag: accelMag * norm,
    curvatureMean: curvatureMean * norm,
  };
}

/** Synthetic 1D-CNN-VAE encoder forward pass (pure TS, <1ms target). */
export function runTouchVAE(window: Float32Array): TouchLatent {
  const z = new Float32Array(LATENT_DIM);

  for (let row = 0; row < LATENT_DIM; row += 1) {
    let sum = ENCODER_BIAS[row];
    const offset = row * INPUT_SIZE;

    for (let col = 0; col < INPUT_SIZE; col += 1) {
      sum += window[col] * ENCODER_WEIGHTS[offset + col];
    }

    z[row] = Math.tanh(sum * 0.015);
  }

  const dynamics = summarizeDynamics(window);
  const stressLevel = clamp01(
    dynamics.velocityMag * 0.42 +
      dynamics.accelMag * 0.33 +
      dynamics.curvatureMean * 0.25,
  );

  z[6] = stressLevel * 2 - 1;
  z[7] = Math.tanh(dynamics.curvatureMean * 3 - 0.5);

  return { z, stressLevel };
}

export const TOUCH_VAE_WINDOW_SIZE = INPUT_SIZE;
