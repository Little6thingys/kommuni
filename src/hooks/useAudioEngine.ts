import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import {
  AUDIO_ENGINE_SMOKE_SEQUENCE,
  DEFAULT_AUDIO_SCALE,
  buildPlayNoteMessage,
  buildScaleMessage,
  buildStopMessage,
  parseAudioEngineEvent,
  serializeAudioEngineMessage,
} from '@/audio/audioEngineBridge';
import { metricsStore } from '@/metrics/MetricsStore';
import {
  AudioEngineLatencyReport,
  AudioEngineMessage,
  AudioEngineStatus,
  AudioParams,
  AudioScale,
} from '@/types';

const SMOKE_NOTE_INTERVAL_MS = 320;

function createLatencySnapshot(): AudioEngineLatencyReport {
  return {
    type: 'LATENCY_REPORT',
    inferenceMs: 0,
    renderMs: 0,
    activeVoices: 0,
  };
}

export function useAudioEngine() {
  const webViewRef = useRef<WebView>(null);
  const messageQueueRef = useRef<AudioEngineMessage[]>([]);
  const smokeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [status, setStatus] = useState<AudioEngineStatus>('loading');
  const [scale, setScaleState] = useState<AudioScale>(DEFAULT_AUDIO_SCALE);
  const [lastLatency, setLastLatency] = useState<AudioEngineLatencyReport>(
    createLatencySnapshot,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedMessages, setQueuedMessages] = useState(0);

  const flushQueue = useCallback(() => {
    if (status !== 'ready') {
      return;
    }

    for (const message of messageQueueRef.current) {
      webViewRef.current?.postMessage(serializeAudioEngineMessage(message));
    }

    messageQueueRef.current = [];
    setQueuedMessages(0);
  }, [status]);

  const post = useCallback(
    (message: AudioEngineMessage) => {
      if (status !== 'ready') {
        messageQueueRef.current.push(message);
        setQueuedMessages(messageQueueRef.current.length);
        return;
      }

      webViewRef.current?.postMessage(serializeAudioEngineMessage(message));
    },
    [status],
  );

  const playNote = useCallback(
    (payload: AudioParams) => {
      setErrorMessage(null);
      post(buildPlayNoteMessage(payload));
    },
    [post],
  );

  const stop = useCallback(() => {
    smokeTimeoutsRef.current.forEach(clearTimeout);
    smokeTimeoutsRef.current = [];
    post(buildStopMessage());
  }, [post]);

  const setScale = useCallback(
    (nextScale: AudioScale) => {
      setScaleState(nextScale);
      post(buildScaleMessage(nextScale));
    },
    [post],
  );

  const playSmokeTestSequence = useCallback(() => {
    stop();
    AUDIO_ENGINE_SMOKE_SEQUENCE.forEach((entry, index) => {
      const timeoutId = setTimeout(() => {
        playNote(entry);
      }, index * SMOKE_NOTE_INTERVAL_MS);
      smokeTimeoutsRef.current.push(timeoutId);
    });
  }, [playNote, stop]);

  const onLoadEnd = useCallback(() => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const bridgeEvent = parseAudioEngineEvent(event.nativeEvent.data);

    if (!bridgeEvent) {
      return;
    }

    if (bridgeEvent.type === 'BRIDGE_READY') {
      setStatus('ready');
      setErrorMessage(null);
      return;
    }

    if (bridgeEvent.type === 'ENGINE_ERROR') {
      setStatus('error');
      setErrorMessage(bridgeEvent.message);
      return;
    }

    setLastLatency(bridgeEvent);
    metricsStore.record({
      kind: 'audio_latency',
      payload: {
        inferenceMs: bridgeEvent.inferenceMs,
        renderMs: bridgeEvent.renderMs,
        activeVoices: bridgeEvent.activeVoices,
      },
    });
  }, []);

  useEffect(() => {
    flushQueue();
  }, [flushQueue]);

  useEffect(() => {
    return () => {
      smokeTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const isReady = status === 'ready';

  const diagnostics = useMemo(
    () => ({
      status,
      scale,
      errorMessage,
      lastLatency,
      queuedMessages,
    }),
    [errorMessage, lastLatency, queuedMessages, scale, status],
  );

  return {
    webViewRef,
    diagnostics,
    isReady,
    playNote,
    playSmokeTestSequence,
    setScale,
    stop,
    onLoadEnd,
    onMessage,
  };
}
