import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PATIENCE_DURATION_MS,
  STRESS_THRESHOLD,
} from '@/fsm/constants';
import { transitionPhase } from '@/fsm/phaseFSM';
import { PhaseState } from '@/types';

const TICK_MS = 100;

export type PhaseFSMViewState = {
  phase: PhaseState;
  patienceProgress: number;
  patienceElapsedSeconds: number;
  showTransition: boolean;
  isPatienceActive: boolean;
  completeTransition: () => void;
};

/** Drives Phase 1 patience countdown and transition trigger from live stress level. */
export function usePhaseFSM(stressLevel: number): PhaseFSMViewState {
  const [phase, setPhase] = useState<PhaseState>('PHASE1');
  const [patienceProgress, setPatienceProgress] = useState(0);
  const [showTransition, setShowTransition] = useState(false);
  const patienceStartedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<PhaseState>('PHASE1');
  const stressRef = useRef(stressLevel);
  const showTransitionRef = useRef(showTransition);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    stressRef.current = stressLevel;
  }, [stressLevel]);

  useEffect(() => {
    showTransitionRef.current = showTransition;
  }, [showTransition]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (phaseRef.current === 'PHASE2' || showTransitionRef.current) {
        return;
      }

      const belowThreshold = stressRef.current < STRESS_THRESHOLD;

      if (!belowThreshold) {
        patienceStartedAtRef.current = null;
        setPatienceProgress(0);
        setPhase((current) =>
          current === 'PATIENCE'
            ? transitionPhase(current, { type: 'STRESS_SPIKE' })
            : current,
        );
        return;
      }

      setPhase((current) => {
        if (current === 'PHASE1') {
          return transitionPhase(current, { type: 'STRESS_BELOW_THRESHOLD' });
        }
        return current;
      });

      if (patienceStartedAtRef.current === null) {
        patienceStartedAtRef.current = Date.now();
      }

      const elapsed = Date.now() - patienceStartedAtRef.current;
      const progress = Math.min(1, elapsed / PATIENCE_DURATION_MS);
      setPatienceProgress(progress);

      if (elapsed >= PATIENCE_DURATION_MS) {
        setPhase((current) =>
          transitionPhase(current, { type: 'PATIENCE_ELAPSED' }),
        );
        setShowTransition(true);
      }
    }, TICK_MS);

    return () => clearInterval(intervalId);
  }, []);

  const completeTransition = useCallback(() => {
    setShowTransition(false);
  }, []);

  return {
    phase,
    patienceProgress,
    patienceElapsedSeconds: Math.min(
      Math.floor(PATIENCE_DURATION_MS / 1000),
      Math.floor((patienceProgress * PATIENCE_DURATION_MS) / 1000),
    ),
    showTransition,
    isPatienceActive: phase === 'PATIENCE' && !showTransition,
    completeTransition,
  };
}
