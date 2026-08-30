import {
  AudioEngineEvent,
  AudioEngineMessage,
  AudioEngineScaleMessage,
  AudioParams,
  AudioScale,
  DroneParams,
} from '@/types';

export const DEFAULT_AUDIO_SCALE: AudioScale = 'pentatonic';

export const AUDIO_ENGINE_SMOKE_SEQUENCE: readonly AudioParams[] = [
  {
    notes: [60],
    overtones: [1, 0.22, 0.06],
    filterFreq: 520,
    latentEnergy: 0.22,
    releaseMs: 1200,
    cutPrevious: false,
    calmness: 0.72,
  },
  {
    notes: [64, 67],
    overtones: [1, 0.18, 0.05],
    filterFreq: 480,
    latentEnergy: 0.28,
    releaseMs: 1400,
    cutPrevious: false,
    calmness: 0.8,
  },
  {
    notes: [60, 64, 67],
    overtones: [1, 0.14, 0.05],
    filterFreq: 420,
    latentEnergy: 0.32,
    releaseMs: 1800,
    cutPrevious: false,
    calmness: 0.9,
  },
  {
    notes: [67, 69, 72],
    overtones: [1, 0.12, 0.04],
    filterFreq: 400,
    latentEnergy: 0.3,
    releaseMs: 2000,
    cutPrevious: false,
    calmness: 0.95,
  },
];

export function serializeAudioEngineMessage(message: AudioEngineMessage): string {
  return JSON.stringify(message);
}

export function buildPlayNoteMessage(payload: AudioParams): AudioEngineMessage {
  return {
    type: 'PLAY_NOTE',
    payload,
  };
}

export function buildScaleMessage(scale: AudioScale): AudioEngineScaleMessage {
  return {
    type: 'SET_SCALE',
    scale,
  };
}

export function buildStopMessage(): AudioEngineMessage {
  return {
    type: 'STOP',
  };
}

export function buildPauseMessage(): AudioEngineMessage {
  return { type: 'PAUSE' };
}

export function buildResumeMessage(): AudioEngineMessage {
  return { type: 'RESUME' };
}

export function buildDroneMessage(payload: DroneParams): AudioEngineMessage {
  return {
    type: 'SET_DRONE',
    payload,
  };
}

export function parseAudioEngineEvent(raw: string): AudioEngineEvent | null {
  try {
    const data = JSON.parse(raw) as Partial<AudioEngineEvent> & {
      type?: string;
      message?: string;
    };

    if (data.type === 'BRIDGE_READY') {
      return { type: 'BRIDGE_READY' };
    }

    if (data.type === 'ENGINE_ERROR' && typeof data.message === 'string') {
      return {
        type: 'ENGINE_ERROR',
        message: data.message,
      };
    }

    if (
      data.type === 'LATENCY_REPORT' &&
      typeof data.inferenceMs === 'number' &&
      typeof data.renderMs === 'number'
    ) {
      return {
        type: 'LATENCY_REPORT',
        inferenceMs: data.inferenceMs,
        renderMs: data.renderMs,
        activeVoices:
          typeof data.activeVoices === 'number' ? data.activeVoices : 0,
      };
    }
  } catch {
    return null;
  }

  return null;
}
