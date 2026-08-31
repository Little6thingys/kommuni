import { StyleSheet, Text, View } from 'react-native';

import { useMetricsStore } from '@/hooks/useMetricsStore';
import { isDeveloperMode } from '@/session/developerModeStore';
import { colors, fonts } from '@/theme';

const MAX_ROWS = 5;

type MetricsDebugOverlayProps = {
  latencyMs?: number | null;
  stress?: number | null;
  fsm?: string | null;
  gazeAngle?: number | null;
  consonance?: number | null;
  transparent?: boolean;
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
  transparent = false,
}: MetricsDebugOverlayProps) {
  const { entries, summary } = useMetricsStore();
  const recent = [...entries].slice(-MAX_ROWS).reverse();
  const resolvedLatency = latencyMs ?? summary.avgAudioLatencyMs;

  if (!isDeveloperMode()) {
    return null;
  }

  return (
    <View
      style={[styles.container, transparent && styles.containerTransparent]}
      pointerEvents="none"
    >
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
    backgroundColor: 'rgba(244, 250, 249, 0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lagoon,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
    minWidth: 168,
  },
  containerTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12,
  },
  meta: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 11,
  },
  event: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 11,
  },
});
