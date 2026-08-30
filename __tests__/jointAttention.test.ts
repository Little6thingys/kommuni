import {
  advanceJointAttentionSmoothState,
  createJointAttentionSmoothState,
  isJointAttentionFrame,
  JOINT_ATTENTION_OFF_FRAMES,
  JOINT_ATTENTION_ON_FRAMES,
} from '@/ml/jointAttention';
import { GazeSnapshot } from '@/types';

describe('jointAttention', () => {
  const centered: GazeSnapshot = {
    gazeAngle: 3,
    gazePitch: 2,
    isJointAttention: false,
    headPose: { yaw: 4, pitch: 3, roll: 0 },
  };

  it('rejects wide eye or head offsets on a single frame', () => {
    expect(isJointAttentionFrame(centered)).toBe(true);
    expect(
      isJointAttentionFrame({
        ...centered,
        gazeAngle: 18,
      }),
    ).toBe(false);
    expect(
      isJointAttentionFrame({
        ...centered,
        gazePitch: 14,
      }),
    ).toBe(false);
  });

  it('requires consecutive on-target frames before latching on', () => {
    let state = createJointAttentionSmoothState();

    for (let i = 0; i < JOINT_ATTENTION_ON_FRAMES - 1; i += 1) {
      const step = advanceJointAttentionSmoothState(state, true);
      state = step.state;
      expect(step.latched).toBe(false);
    }

    const latched = advanceJointAttentionSmoothState(state, true);
    expect(latched.latched).toBe(true);
  });

  it('keeps latched through brief off-target blips', () => {
    let state = createJointAttentionSmoothState();

    for (let i = 0; i < JOINT_ATTENTION_ON_FRAMES; i += 1) {
      state = advanceJointAttentionSmoothState(state, true).state;
    }

    for (let i = 0; i < JOINT_ATTENTION_OFF_FRAMES - 1; i += 1) {
      const step = advanceJointAttentionSmoothState(state, false);
      state = step.state;
      expect(step.latched).toBe(true);
    }

    const released = advanceJointAttentionSmoothState(state, false);
    expect(released.latched).toBe(false);
  });
});
