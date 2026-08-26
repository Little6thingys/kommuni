import { useCallback } from 'react';

import { runCrossAttentionFusion } from '@/ml/crossAttention';
import { FusionOutput } from '@/types';

/** Module 4 hook — cross-attention fusion into audio params. */
export function useCrossAttentionFusion() {
  const fuse = useCallback(
    (
      chordVector: Float32Array,
      gazeVector: Float32Array,
      isJointAttention: boolean,
      options?: {
        tension?: number;
        rhythmTap?: number[];
      },
    ): FusionOutput =>
      runCrossAttentionFusion(chordVector, gazeVector, isJointAttention, options),
    [],
  );

  return { fuse };
};
