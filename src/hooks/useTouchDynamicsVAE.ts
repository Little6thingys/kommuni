import { useCallback, useRef } from 'react';

import { runTouchVAE, TOUCH_VAE_WINDOW_SIZE } from '@/ml/touchVAE';
import { TouchLatent } from '@/types';

const EMPTY_LATENT: TouchLatent = {
  z: new Float32Array(8),
  stressLevel: 0,
};

/** Module 1 — rolling 32×5 touch window fed into the CNN-VAE encoder. */
export function useTouchDynamicsVAE() {
  const windowRef = useRef(new Float32Array(TOUCH_VAE_WINDOW_SIZE));

  const ingestTouchSample = useCallback(
    (sample: [number, number, number, number, number]): TouchLatent => {
      windowRef.current.copyWithin(0, 5);
      windowRef.current.set(sample, TOUCH_VAE_WINDOW_SIZE - 5);
      return runTouchVAE(windowRef.current);
    },
    [],
  );

  const resetWindow = useCallback(() => {
    windowRef.current.fill(0);
  }, []);

  return {
    ingestTouchSample,
    resetWindow,
    emptyLatent: EMPTY_LATENT,
  };
}
