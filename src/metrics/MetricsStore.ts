import { METRICS_EXPORT_SECRET } from '@/metrics/constants';
import { MetricEntry, MetricKind } from '@/types';
import { encryptExportPayload } from '@/utils/encryption';

export type SessionSummary = {
  sessionId: string;
  startedAt: string;
  entryCount: number;
  byKind: Record<MetricKind, number>;
  avgAudioLatencyMs: number | null;
  developerMode: boolean;
};

export type MetricsExportResult = {
  csvUri: string;
  encryptedJsonUri: string;
};

type Listener = () => void;

function createSessionId(): string {
  return `session-${Date.now()}`;
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function flattenPayload(payload: MetricEntry['payload']): string {
  return Object.entries(payload)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('; ');
}

class MetricsStoreImpl {
  private entries: MetricEntry[] = [];
  private listeners = new Set<Listener>();
  private sessionId = createSessionId();
  private startedAt = new Date().toISOString();
  private developerMode = false;

  setSessionDeveloperMode(enabled: boolean): void {
    this.developerMode = enabled;
    this.notify();
  }

  isSessionDeveloperMode(): boolean {
    return this.developerMode;
  }

  record(entry: Omit<MetricEntry, 'id' | 'timestamp'>): MetricEntry {
    const full: MetricEntry = {
      ...entry,
      id: `${Date.now()}-${this.entries.length}`,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    this.notify();
    return full;
  }

  getEntries(): readonly MetricEntry[] {
    return this.entries;
  }

  getSessionSummary(): SessionSummary {
    const byKind: Record<MetricKind, number> = {
      inference: 0,
      audio_latency: 0,
      consonance: 0,
      benchmark: 0,
    };

    let latencySum = 0;
    let latencyCount = 0;

    for (const entry of this.entries) {
      byKind[entry.kind] += 1;

      if (entry.kind === 'audio_latency') {
        const inferenceMs = entry.payload.inferenceMs;
        const renderMs = entry.payload.renderMs;
        if (typeof inferenceMs === 'number' && typeof renderMs === 'number') {
          latencySum += inferenceMs + renderMs;
          latencyCount += 1;
        }
      }
    }

    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      entryCount: this.entries.length,
      byKind,
      avgAudioLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
      developerMode: this.developerMode,
    };
  }

  toPlainJson(): string {
    return JSON.stringify(
      {
        session: this.getSessionSummary(),
        entries: this.entries,
      },
      null,
      2,
    );
  }

  toCsv(): string {
    const header = 'id,timestamp,kind,payload';
    const rows = this.entries.map((entry) =>
      [
        escapeCsvValue(entry.id),
        escapeCsvValue(entry.timestamp),
        escapeCsvValue(entry.kind),
        escapeCsvValue(flattenPayload(entry.payload)),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  private async writeExportFile(name: string, contents: string): Promise<string> {
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.cache, name);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(contents);
    return file.uri;
  }

  async exportSession(): Promise<MetricsExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const plainJson = this.toPlainJson();
    const csvUri = await this.writeExportFile(
      `kommuni-metrics-${timestamp}.csv`,
      this.toCsv(),
    );
    const encryptedJson = encryptExportPayload(plainJson, METRICS_EXPORT_SECRET);
    const encryptedJsonUri = await this.writeExportFile(
      `kommuni-metrics-${timestamp}.json.enc`,
      encryptedJson,
    );

    return {
      csvUri,
      encryptedJsonUri,
    };
  }

  async shareCsvExport(): Promise<MetricsExportResult> {
    const exports = await this.exportSession();
    const Sharing = await import('expo-sharing');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exports.csvUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share Kommuni session metrics (CSV)',
      });
    }

    return exports;
  }

  async shareEncryptedJsonExport(): Promise<MetricsExportResult> {
    const exports = await this.exportSession();
    const Sharing = await import('expo-sharing');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(exports.encryptedJsonUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Share Kommuni encrypted session JSON',
      });
    }

    return exports;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.entries = [];
    this.sessionId = createSessionId();
    this.startedAt = new Date().toISOString();
    this.developerMode = false;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const metricsStore = new MetricsStoreImpl();
