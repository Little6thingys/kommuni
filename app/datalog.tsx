import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ScreenShell } from '@/components/ScreenShell';
import { useMetricsStore } from '@/hooks/useMetricsStore';
import { buildDemoSessionHighlights } from '@/metrics/demoSessionSummary';
import { MetricEntry } from '@/types';

function formatPayload(entry: MetricEntry): string {
  return Object.entries(entry.payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function kindLabel(kind: MetricEntry['kind']): string {
  switch (kind) {
    case 'audio_latency':
      return 'Audio latency';
    case 'inference':
      return 'Inference';
    case 'consonance':
      return 'Consonance';
    case 'benchmark':
      return 'Benchmark';
    default:
      return kind;
  }
}

export default function DataLogScreen() {
  const { entries, summary, clear, shareCsvExport, shareEncryptedJsonExport } = useMetricsStore();
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const demoHighlights = useMemo(
    () => (summary.demoMode ? buildDemoSessionHighlights(entries) : null),
    [entries, summary.demoMode],
  );

  const handleShareCsv = async () => {
    setExporting('csv');
    try {
      await shareCsvExport();
      Alert.alert(
        'Export ready',
        `Plain CSV shared.\nEncrypted JSON saved alongside export files.`,
      );
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  };

  const handleShareJson = async () => {
    setExporting('json');
    try {
      await shareEncryptedJsonExport();
      Alert.alert('Export ready', 'Encrypted JSON shared via system sheet.');
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setExporting(null);
    }
  };

  const handleClear = () => {
    Alert.alert('Clear session metrics?', 'This removes in-memory entries for the current session.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);
  };

  return (
    <ScreenShell
      title="Data & Log"
      subtitle={
        summary.demoMode
          ? 'Demo session — caregiver showcase metrics plus full event log'
          : 'Session metrics with encrypted JSON and plain CSV export'
      }
    >
      <MetricsDebugOverlay />

      {summary.demoMode && demoHighlights ? (
        <View style={styles.demoCard}>
          <View style={styles.demoBadgeRow}>
            <Text style={styles.demoBadge}>Demo Mode</Text>
            <Text style={styles.demoBadgeHint}>Parent-facing showcase session</Text>
          </View>
          <Text style={styles.cardTitle}>Showcase summary</Text>
          <Text style={styles.demoIntro}>
            Highlights from the calm-down → turn-taking flow. The full metrics table below is
            unchanged.
          </Text>
          <View style={styles.demoGrid}>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>{demoHighlights.phase1TouchInferences}</Text>
              <Text style={styles.demoStatLabel}>Phase 1 touch notes</Text>
            </View>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>
                {demoHighlights.avgPhase1Stress != null
                  ? `${Math.round(demoHighlights.avgPhase1Stress * 100)}%`
                  : '—'}
              </Text>
              <Text style={styles.demoStatLabel}>Avg touch stress</Text>
            </View>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>{demoHighlights.phase2ChildResponses}</Text>
              <Text style={styles.demoStatLabel}>Child responses</Text>
            </View>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>{demoHighlights.jointAttentionMoments}</Text>
              <Text style={styles.demoStatLabel}>Joint attention</Text>
            </View>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>{demoHighlights.rewardMoments}</Text>
              <Text style={styles.demoStatLabel}>Turn rewards</Text>
            </View>
            <View style={styles.demoStat}>
              <Text style={styles.demoStatValue}>{demoHighlights.musicHoverBeats}</Text>
              <Text style={styles.demoStatLabel}>Music hover 😊</Text>
            </View>
          </View>
          {demoHighlights.avgPhase2InferenceMs != null ? (
            <Text style={styles.summaryRow}>
              Avg Phase 2 inference: {demoHighlights.avgPhase2InferenceMs.toFixed(1)} ms
            </Text>
          ) : null}
          {entries.length === 0 ? (
            <Text style={styles.demoEmpty}>
              No demo events yet. Start a Demo Mode session from Setup, play Phase 1, then finish
              Phase 2.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.summaryRow}>ID: {summary.sessionId}</Text>
        <Text style={styles.summaryRow}>Started: {summary.startedAt}</Text>
        <Text style={styles.summaryRow}>
          Mode: {summary.demoMode ? 'Demo showcase' : 'Research'}
        </Text>
        <Text style={styles.summaryRow}>Entries: {summary.entryCount}</Text>
        {summary.avgAudioLatencyMs != null ? (
          <Text style={styles.summaryRow}>
            Avg audio latency: {summary.avgAudioLatencyMs.toFixed(1)} ms
          </Text>
        ) : null}
        <View style={styles.kindRow}>
          {Object.entries(summary.byKind).map(([kind, count]) => (
            <Text key={kind} style={styles.kindChip}>
              {kind}: {count}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.tableCard}>
        <Text style={styles.cardTitle}>Metrics ({entries.length})</Text>
        {entries.length === 0 ? (
          <Text style={styles.empty}>
            {summary.demoMode
              ? 'No session metrics recorded yet. Complete the demo flow (Phase 1 → Phase 2).'
              : 'No session metrics recorded yet. Play notes on Phase 1 or run Benchmark Mode.'}
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.timeCol]}>Time</Text>
                <Text style={[styles.headerCell, styles.kindCol]}>Kind</Text>
                <Text style={[styles.headerCell, styles.payloadCol]}>Payload</Text>
              </View>
              {[...entries].reverse().map((entry) => (
                <View key={entry.id} style={styles.tableRow}>
                  <Text style={[styles.cell, styles.timeCol]} numberOfLines={1}>
                    {entry.timestamp.slice(11, 19)}
                  </Text>
                  <Text style={[styles.cell, styles.kindCol]} numberOfLines={1}>
                    {kindLabel(entry.kind)}
                  </Text>
                  <Text style={[styles.cell, styles.payloadCol]} numberOfLines={2}>
                    {formatPayload(entry)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonPrimary, exporting != null && styles.buttonDisabled]}
          onPress={handleShareCsv}
          disabled={exporting != null || entries.length === 0}
        >
          {exporting === 'csv' ? (
            <ActivityIndicator color="#0B0B12" />
          ) : (
            <Text style={styles.buttonPrimaryText}>Export CSV (share)</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonSecondary, exporting != null && styles.buttonDisabled]}
          onPress={handleShareJson}
          disabled={exporting != null || entries.length === 0}
        >
          {exporting === 'json' ? (
            <ActivityIndicator color="#C8C8D8" />
          ) : (
            <Text style={styles.buttonSecondaryText}>Export encrypted JSON (share)</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonGhost]}
          onPress={handleClear}
          disabled={entries.length === 0}
        >
          <Text style={styles.buttonGhostText}>Clear session</Text>
        </Pressable>

        <Link href="/" style={styles.link}>
          ← Back to Setup
        </Link>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  demoCard: {
    marginTop: 16,
    backgroundColor: '#182018',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F4A35',
    padding: 16,
    gap: 10,
  },
  demoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  demoBadge: {
    color: '#0B0B12',
    backgroundColor: '#9BFFC0',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  demoBadgeHint: {
    color: '#A8DDB8',
    fontSize: 12,
    fontWeight: '600',
  },
  demoIntro: {
    color: '#A8DDB8',
    fontSize: 13,
    lineHeight: 18,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  demoStat: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: '#101810',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  demoStatValue: {
    color: '#E8FFF0',
    fontSize: 22,
    fontWeight: '800',
  },
  demoStatLabel: {
    color: '#7CB892',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  demoEmpty: {
    color: '#7CB892',
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCard: {
    marginTop: 16,
    backgroundColor: '#151522',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  tableCard: {
    marginTop: 16,
    backgroundColor: '#151522',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    minHeight: 180,
  },
  cardTitle: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    color: '#8888A0',
    fontSize: 13,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  kindChip: {
    color: '#A9A9C4',
    fontSize: 12,
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  empty: {
    color: '#666680',
    fontSize: 14,
    lineHeight: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3A',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#232333',
  },
  headerCell: {
    color: '#666680',
    fontSize: 12,
    fontWeight: '600',
  },
  cell: {
    color: '#8888A0',
    fontSize: 13,
  },
  timeCol: {
    width: 72,
  },
  kindCol: {
    width: 110,
  },
  payloadCol: {
    width: 220,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPrimary: {
    backgroundColor: '#7EB6FF',
  },
  buttonPrimaryText: {
    color: '#0B0B12',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: '#3A3A4E',
  },
  buttonSecondaryText: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostText: {
    color: '#8888A0',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  link: {
    color: '#7EB6FF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});
