import { StyleSheet, Text, View } from 'react-native';

import { useMetricsStore } from '@/hooks/useMetricsStore';

const MAX_ROWS = 5;

type MetricsDebugOverlayProps = {
  latencyMs?: number | null;
  stress?: number | null;
  fsm?: string | null;
  gazeAngle?: number | null;
  consonance?: number | null;
};

function formatOptional(value: number | null | undefined, digits: number): string {
  return value == null ? '—' : value.toFixed(digits);
}

export function MetricsDebugOverlay({
  latencyMs,
  stress,
  fsm,
  gazeAngle,
  consonance,
}: MetricsDebugOverlayProps) {
  const { entries, summary } = useMetricsStore();
  const recent = [...entries].slice(-MAX_ROWS).reverse();
  const resolvedLatency = latencyMs ?? summary.avgAudioLatencyMs;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.title}>Debug</Text>
      <Text style={styles.row}>Latency {formatOptional(resolvedLatency, 1)} ms</Text>
      {stress != null ? <Text style={styles.row}>Stress {stress.toFixed(2)}</Text> : null}
      {fsm != null ? <Text style={styles.row}>FSM {fsm}</Text> : null}
      {gazeAngle != null ? (
        <Text style={styles.row}>Gaze {gazeAngle.toFixed(1)}°</Text>
      ) : null}
      {consonance != null ? (
        <Text style={styles.row}>Consonance {(consonance * 100).toFixed(0)}%</Text>
      ) : null}
      {summary.avgAudioLatencyMs != null ? (
        <Text style={styles.meta}>
          Avg audio: {summary.avgAudioLatencyMs.toFixed(1)} ms · {summary.entryCount} events
        </Text>
      ) : (
        <Text style={styles.meta}>Metrics ({summary.entryCount})</Text>
      )}
      {recent.length === 0 ? (
        <Text style={styles.empty}>Waiting for events…</Text>
      ) : (
        recent.map((entry) => (
          <Text key={entry.id} style={styles.event} numberOfLines={1}>
            {entry.kind} · {entry.timestamp.slice(11, 19)}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(11, 11, 18, 0.88)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A3A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
    minWidth: 168,
  },
  title: {
    color: '#C8C8D8',
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    color: '#F5F5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: '#8888A0',
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    color: '#666680',
    fontSize: 11,
  },
  event: {
    color: '#A9A9C4',
    fontSize: 11,
  },
});
