import { PhaseState } from '@/types';

export type PhaseFSMEvent =
  | { type: 'MODELS_READY' }
  | { type: 'STRESS_BELOW_THRESHOLD' }
  | { type: 'STRESS_SPIKE' }
  | { type: 'PATIENCE_ELAPSED' }
  | { type: 'SESSION_END' };

export function transitionPhase(
  state: PhaseState,
  event: PhaseFSMEvent,
): PhaseState {
  switch (state) {
    case 'LOADING':
      return event.type === 'MODELS_READY' ? 'PHASE1' : state;
    case 'PHASE1':
      if (event.type === 'STRESS_BELOW_THRESHOLD') return 'PATIENCE';
      return state;
    case 'PATIENCE':
      if (event.type === 'STRESS_SPIKE') return 'PHASE1';
      if (event.type === 'PATIENCE_ELAPSED') return 'PHASE2';
      return state;
    case 'PHASE2':
      return event.type === 'SESSION_END' ? 'DATALOG' : state;
    case 'DATALOG':
    default:
      return state;
  }
}

export const INITIAL_PHASE_STATE: PhaseState = 'LOADING';
