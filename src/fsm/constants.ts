/** Stress below this value enters the patience countdown toward Phase 2. */
export const STRESS_THRESHOLD = 0.25;

/** Consecutive calm duration required before Phase 1 → Phase 2 transition. */
export const PATIENCE_DURATION_MS = 5000;

/** Reanimated gradient expansion duration before navigating to Phase 2. */
export const PHASE_TRANSITION_MS = 1800;
