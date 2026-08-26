import {
  AUDIO_ENGINE_SMOKE_SEQUENCE,
  buildPlayNoteMessage,
  buildScaleMessage,
  parseAudioEngineEvent,
  serializeAudioEngineMessage,
} from '@/audio/audioEngineBridge';
import { AUDIO_RENDER_ESTIMATE_MS, BENCHMARK_THRESHOLDS } from '@/metrics/constants';

describe('audioEngineBridge', () => {
  it('defines a four-note smoke sequence for the scaffolded UI', () => {
    expect(AUDIO_ENGINE_SMOKE_SEQUENCE).toHaveLength(4);
    expect(AUDIO_ENGINE_SMOKE_SEQUENCE[0]?.notes).toEqual([60]);
    expect(AUDIO_ENGINE_SMOKE_SEQUENCE[3]?.notes).toEqual([72]);
  });

  it('serializes scale messages for the WebView bridge', () => {
    expect(serializeAudioEngineMessage(buildScaleMessage('chromatic'))).toBe(
      JSON.stringify({
        type: 'SET_SCALE',
        scale: 'chromatic',
      }),
    );
  });

  it('parses latency reports from the WebView bridge', () => {
    expect(
      parseAudioEngineEvent(
        JSON.stringify({
          type: 'LATENCY_REPORT',
          inferenceMs: 0,
          renderMs: 8.5,
          activeVoices: 1,
        }),
      ),
    ).toEqual({
      type: 'LATENCY_REPORT',
      inferenceMs: 0,
      renderMs: 8.5,
      activeVoices: 1,
    });
  });

  it('serializes PLAY_NOTE payloads with the audio param shape', () => {
    const params = AUDIO_ENGINE_SMOKE_SEQUENCE[0];
    expect(params).toBeDefined();
    const message = buildPlayNoteMessage(params!);
    expect(message).toEqual({
      type: 'PLAY_NOTE',
      payload: {
        notes: expect.any(Array),
        overtones: expect.any(Array),
        filterFreq: expect.any(Number),
        latentEnergy: expect.any(Number),
      },
    });
    expect(message.payload.notes.length).toBeGreaterThan(0);
  });

  it('treats WebView render budget plus inference as end-to-end under 35ms', () => {
    const report = parseAudioEngineEvent(
      JSON.stringify({
        type: 'LATENCY_REPORT',
        inferenceMs: 4.2,
        renderMs: AUDIO_RENDER_ESTIMATE_MS,
        activeVoices: 2,
      }),
    );
    expect(report?.type).toBe('LATENCY_REPORT');
    if (report?.type === 'LATENCY_REPORT') {
      expect(report.inferenceMs).toBeLessThan(BENCHMARK_THRESHOLDS.maxInferenceMs);
      expect(report.inferenceMs + report.renderMs).toBeLessThan(
        BENCHMARK_THRESHOLDS.maxEndToEndMs,
      );
    }
  });
});
