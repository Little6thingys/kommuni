/** Stress below this value enters the patience countdown toward Phase 2. */
export const STRESS_THRESHOLD = 0.25;

/** Consecutive calm duration required before Phase 1 → Phase 2 transition. */
export const PATIENCE_DURATION_MS = 15000;

/** Reanimated gradient expansion duration before navigating to Phase 2. */
export const PHASE_TRANSITION_MS = 1800;

/** When false, joint-attention is never reported and Phase 2 ignores gaze-based rewards. */
export const JOINT_ATTENTION_ENABLED = true;
