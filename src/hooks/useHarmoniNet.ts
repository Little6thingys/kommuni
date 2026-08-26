import { useCallback, useRef } from 'react';

import { applyMusicTheoryMask } from '@/ml/musicTheoryMask';
import { chordNotesToVector, createHarmoniNetState, runHarmoniNet } from '@/ml/harmoniNet';
import { HarmoniNetOutput } from '@/types';

/** Module 3 hook — Adaptive HarmoniNet with persistent RNN hidden state. */
export function useHarmoniNet() {
  const stateRef = useRef(createHarmoniNetState());

  const infer = useCallback((z: Float32Array, rhythmTap: number[]): HarmoniNetOutput => {
    const { output, state } = runHarmoniNet(z, rhythmTap, stateRef.current);
    stateRef.current = state;

    const maskedNotes = applyMusicTheoryMask(output.chordNotes);
    return {
      ...output,
      chordNotes: maskedNotes,
      chordVector: chordNotesToVector(maskedNotes),
    };
  }, []);

  const reset = useCallback(() => {
    stateRef.current = createHarmoniNetState();
  }, []);

  return { infer, reset };
};
