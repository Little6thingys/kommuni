import {
  AudioEngineEvent,
  AudioEngineMessage,
  AudioEngineScaleMessage,
  AudioParams,
  AudioScale,
} from '@/types';

export const DEFAULT_AUDIO_SCALE: AudioScale = 'pentatonic';

export const AUDIO_ENGINE_SMOKE_SEQUENCE: readonly AudioParams[] = [
  {
    notes: [60],
    overtones: [1, 0.45, 0.22],
    filterFreq: 720,
    latentEnergy: 0.28,
  },
  {
    notes: [64],
    overtones: [1, 0.38, 0.2],
    filterFreq: 880,
    latentEnergy: 0.35,
  },
  {
    notes: [67],
    overtones: [1, 0.5, 0.26, 0.12],
    filterFreq: 1040,
    latentEnergy: 0.42,
  },
  {
    notes: [72],
    overtones: [1, 0.35, 0.18],
    filterFreq: 1260,
    latentEnergy: 0.3,
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
