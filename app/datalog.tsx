import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DATALOG_GUI } from '@/copy/phaseTitles';
import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ScreenShell } from '@/components/ScreenShell';
import { SessionHighlightsChart } from '@/components/SessionHighlightsChart';
import { useMetricsStore } from '@/hooks/useMetricsStore';
import { colors, fonts, radii } from '@/theme';
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
  const router = useRouter();
  const { entries, summary, clear, shareCsvExport, shareEncryptedJsonExport } = useMetricsStore();
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

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
    Alert.alert(DATALOG_GUI.clearDataLogTitle, DATALOG_GUI.clearDataLogMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: DATALOG_GUI.clearDataLogConfirm, style: 'destructive', onPress: clear },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenShell
        title="Data & Log"
        subtitle="Session metrics with encrypted JSON and plain CSV export"
      >
        <MetricsDebugOverlay />

        <Pressable
          style={[styles.button, styles.buttonDanger, styles.clearTopButton, entries.length === 0 && styles.buttonDisabled]}
          onPress={handleClear}
          disabled={entries.length === 0}
        >
          <Text style={styles.buttonDangerText}>{DATALOG_GUI.clearDataLogLabel}</Text>
        </Pressable>

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.summaryRow}>ID: {summary.sessionId}</Text>
        <Text style={styles.summaryRow}>Started: {summary.startedAt}</Text>
        <Text style={styles.summaryRow}>
          Mode: {summary.developerMode ? 'Developer' : 'Normal'}
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

      <SessionHighlightsChart entries={entries} />

      <View style={styles.tableCard}>
        <Text style={styles.cardTitle}>Metrics ({entries.length})</Text>
        {entries.length === 0 ? (
          <Text style={styles.empty}>
            No session metrics recorded yet. Play notes on Phase 1 or run Benchmark Mode.
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
            <ActivityIndicator color={colors.foam} />
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
            <ActivityIndicator color={colors.inkSoft} />
          ) : (
            <Text style={styles.buttonSecondaryText}>Export encrypted JSON (share)</Text>
          )}
        </Pressable>
      </View>
      </ScreenShell>

      <Pressable
        style={({ pressed }) => [styles.cornerHomeButton, pressed && styles.cornerHomeButtonPressed]}
        onPress={() => router.push('/')}
      >
        <Text style={styles.cornerHomeButtonText}>{DATALOG_GUI.backHomeShortLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  cornerHomeButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: colors.deepTide,
    borderRadius: radii.button,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    zIndex: 10,
  },
  cornerHomeButtonPressed: {
    opacity: 0.85,
  },
  cornerHomeButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.foam,
    fontSize: 13,
  },
  summaryCard: {
    marginTop: 16,
    backgroundColor: colors.foam,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.lagoon,
    padding: 16,
    gap: 6,
  },
  tableCard: {
    marginTop: 16,
    backgroundColor: colors.foam,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.lagoon,
    padding: 16,
    gap: 10,
    minHeight: 180,
  },
  cardTitle: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryRow: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  kindChip: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    backgroundColor: colors.rippleSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.lagoon,
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rippleSoft,
  },
  headerCell: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cell: {
    fontFamily: fonts.body,
    color: colors.ink,
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
  clearTopButton: {
    marginTop: 4,
    marginBottom: 4,
  },
  button: {
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPrimary: {
    backgroundColor: colors.deepTide,
  },
  buttonPrimaryText: {
    fontFamily: fonts.bodyMedium,
    color: colors.foam,
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: colors.foam,
    borderWidth: 1,
    borderColor: colors.lagoon,
  },
  buttonSecondaryText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 14,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonGhostText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 14,
  },
  buttonDanger: {
    backgroundColor: colors.foam,
    borderWidth: 1,
    borderColor: '#C47A7A',
  },
  buttonDangerText: {
    fontFamily: fonts.bodyMedium,
    color: '#9A3F3F',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
