import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { buildDemoSessionHighlights } from '@/metrics/demoSessionSummary';
import { colors, fonts, radii } from '@/theme';
import { MetricEntry } from '@/types';

type SessionHighlightsChartProps = {
  entries: readonly MetricEntry[];
};

type ChartRow = {
  key: string;
  label: string;
  value: number;
  color: string;
};

function buildChartRows(entries: readonly MetricEntry[]): ChartRow[] {
  const highlights = buildDemoSessionHighlights(entries);

  return [
    {
      key: 'phase1',
      label: 'Phase 1 touches',
      value: highlights.phase1TouchInferences,
      color: colors.tide,
    },
    {
      key: 'phase2',
      label: 'Child responses',
      value: highlights.phase2ChildResponses,
      color: colors.deepTide,
    },
    {
      key: 'joint_attention',
      label: 'Joint attention',
      value: highlights.jointAttentionMoments,
      color: colors.accent,
    },
    {
      key: 'rewards',
      label: 'Rewards',
      value: highlights.rewardMoments,
      color: colors.ripple,
    },
    {
      key: 'music_hover',
      label: 'Music hover',
      value: highlights.musicHoverBeats,
      color: colors.warnSoft,
    },
  ];
}

export function SessionHighlightsChart({ entries }: SessionHighlightsChartProps) {
  const highlights = useMemo(() => buildDemoSessionHighlights(entries), [entries]);
  const rows = useMemo(() => buildChartRows(entries), [entries]);
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const hasActivity = rows.some((row) => row.value > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Session highlights</Text>

      {!hasActivity ? (
        <Text style={styles.empty}>
          Play Phase 1 or Phase 2 to see joint attention, rewards, and other counts here.
        </Text>
      ) : (
        <View style={styles.chart}>
          {rows.map((row) => {
            const widthPercent = Math.max(6, (row.value / maxValue) * 100);

            return (
              <View key={row.key} style={styles.row}>
                <View style={styles.labelCol}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.value}>{row.value}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${widthPercent}%`, backgroundColor: row.color },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.statsRow}>
        {highlights.avgPhase1Stress != null ? (
          <Text style={styles.stat}>
            Avg Phase 1 stress: {(highlights.avgPhase1Stress * 100).toFixed(0)}%
          </Text>
        ) : null}
        {highlights.avgPhase2InferenceMs != null ? (
          <Text style={styles.stat}>
            Avg Phase 2 inference: {highlights.avgPhase2InferenceMs.toFixed(1)} ms
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: colors.foam,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.lagoon,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  chart: {
    gap: 10,
  },
  row: {
    gap: 6,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 13,
  },
  value: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13,
    minWidth: 24,
    textAlign: 'right',
  },
  barTrack: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.rippleSoft,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    minWidth: 6,
  },
  statsRow: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lagoon,
  },
  stat: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
  },
});
