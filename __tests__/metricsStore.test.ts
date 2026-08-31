import { METRICS_EXPORT_SECRET } from '@/metrics/constants';
import { metricsStore } from '@/metrics/MetricsStore';
import { decryptExportPayload, encryptExportPayload } from '@/utils/encryption';

describe('MetricsStore', () => {
  beforeEach(() => {
    metricsStore.clear();
  });

  it('records entries with generated id and timestamp', () => {
    const entry = metricsStore.record({
      kind: 'audio_latency',
      payload: { inferenceMs: 1, renderMs: 2, activeVoices: 1 },
    });

    expect(entry.id).toMatch(/^\d+-\d+$/);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(metricsStore.getEntries()).toHaveLength(1);
  });

  it('builds session summary with audio latency average', () => {
    metricsStore.record({
      kind: 'audio_latency',
      payload: { inferenceMs: 2, renderMs: 4, activeVoices: 1 },
    });
    metricsStore.record({
      kind: 'audio_latency',
      payload: { inferenceMs: 4, renderMs: 6, activeVoices: 2 },
    });

    const summary = metricsStore.getSessionSummary();
    expect(summary.entryCount).toBe(2);
    expect(summary.byKind.audio_latency).toBe(2);
    expect(summary.avgAudioLatencyMs).toBe(8);
    expect(summary.developerMode).toBe(false);
  });

  it('tracks developer mode on the session summary', () => {
    metricsStore.setSessionDeveloperMode(true);
    expect(metricsStore.getSessionSummary().developerMode).toBe(true);
    metricsStore.clear();
    expect(metricsStore.getSessionSummary().developerMode).toBe(false);
  });

  it('exports CSV rows and round-trips encrypted JSON', () => {
    metricsStore.record({
      kind: 'benchmark',
      payload: { passed: true, profileCount: 1000 },
    });

    const csv = metricsStore.toCsv();
    expect(csv.startsWith('id,timestamp,kind,payload')).toBe(true);
    expect(csv).toContain('benchmark');

    const plainJson = metricsStore.toPlainJson();
    const encrypted = encryptExportPayload(plainJson, METRICS_EXPORT_SECRET);
    const decrypted = decryptExportPayload(encrypted, METRICS_EXPORT_SECRET);
    expect(JSON.parse(decrypted).entries).toHaveLength(1);
  });
});
