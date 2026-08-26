const DEFAULT_LATENT = new Float32Array([
  0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0.04, 0.06,
]);

let phase1Latent = new Float32Array(DEFAULT_LATENT);

/** Snapshot of the live Phase 1 VAE vector used by Phase 2 HarmoniNet. */
export function setPhase1Latent(z: Float32Array): void {
  phase1Latent = Float32Array.from(z);
}

export function getPhase1Latent(): Float32Array {
  return phase1Latent;
}

export function getDefaultPhase1Latent(): Float32Array {
  return new Float32Array(DEFAULT_LATENT);
}

export function resetPhase1Latent(): void {
  phase1Latent = new Float32Array(DEFAULT_LATENT);
}
