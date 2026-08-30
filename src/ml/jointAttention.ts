import { GazeSnapshot } from '@/types';

/** Max horizontal iris offset (degrees) while still “looking at screen”. */
export const JOINT_ATTENTION_MAX_GAZE_ANGLE = 7;

/** Max vertical iris offset (degrees). */
export const JOINT_ATTENTION_MAX_GAZE_PITCH = 8;

/** Max head yaw while facing the device. */
export const JOINT_ATTENTION_MAX_HEAD_YAW = 9;

/** Max head pitch while facing the device. */
export const JOINT_ATTENTION_MAX_HEAD_PITCH = 11;

/** Consecutive on-target frames required before latching joint attention on. */
export const JOINT_ATTENTION_ON_FRAMES = 12;

/** Consecutive off-target frames required before latching off (hysteresis). */
export const JOINT_ATTENTION_OFF_FRAMES = 8;

export type JointAttentionSmoothState = {
  onStreak: number;
  offStreak: number;
  latched: boolean;
};

export function createJointAttentionSmoothState(): JointAttentionSmoothState {
  return { onStreak: 0, offStreak: 0, latched: false };
}

/** Single-frame gate — strict, used only as input to temporal smoothing. */
export function isJointAttentionFrame(snapshot: GazeSnapshot): boolean {
  return (
    Math.abs(snapshot.gazeAngle) <= JOINT_ATTENTION_MAX_GAZE_ANGLE &&
    Math.abs(snapshot.gazePitch ?? 0) <= JOINT_ATTENTION_MAX_GAZE_PITCH &&
    Math.abs(snapshot.headPose.yaw) <= JOINT_ATTENTION_MAX_HEAD_YAW &&
    Math.abs(snapshot.headPose.pitch) <= JOINT_ATTENTION_MAX_HEAD_PITCH
  );
}

/** Debounced joint-attention latch updated once per gaze frame. */
export function advanceJointAttentionSmoothState(
  state: JointAttentionSmoothState,
  onTarget: boolean,
): { state: JointAttentionSmoothState; latched: boolean } {
  const next = { ...state };

  if (onTarget) {
    next.onStreak += 1;
    next.offStreak = 0;
    if (!next.latched && next.onStreak >= JOINT_ATTENTION_ON_FRAMES) {
      next.latched = true;
    }
  } else {
    next.offStreak += 1;
    next.onStreak = 0;
    if (next.latched && next.offStreak >= JOINT_ATTENTION_OFF_FRAMES) {
      next.latched = false;
    }
  }

  return { state: next, latched: next.latched };
}
