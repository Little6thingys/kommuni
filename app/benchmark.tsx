import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';
import { ScreenShell } from '@/components/ScreenShell';
import { useBenchmarkRunner } from '@/hooks/useBenchmarkRunner';
import { BENCHMARK_PROFILE_COUNT, BENCHMARK_THRESHOLDS } from '@/metrics/constants';
import { BenchmarkCriterion } from '@/metrics/benchmarkHarness';

const BENCHMARK_TARGETS = [
  {
    label: 'Inference',
    detail: `< ${BENCHMARK_THRESHOLDS.maxInferenceMs} ms`,
  },
  {
    label: 'End-to-end',
    detail: `< ${BENCHMARK_THRESHOLDS.maxEndToEndMs} ms`,
  },
  {
    label: 'CPU proxy',
    detail: `< ${BENCHMARK_THRESHOLDS.maxCpuProxyPercent}%`,
  },
  {
    label: 'Consonance',
    detail: `> ${BENCHMARK_THRESHOLDS.minConsonanceRate * 100}%`,
  },
] as const;

function formatCriterionValue(criterion: BenchmarkCriterion): string {
  if (criterion.id === 'consonance') {
    return `${criterion.value.toFixed(1)}%`;
  }
  if (criterion.id === 'cpu_proxy') {
    return `${criterion.value.toFixed(1)}%`;
  }
  return `${criterion.value.toFixed(2)} ms`;
}

function formatCriterionThreshold(criterion: BenchmarkCriterion): string {
  if (criterion.id === 'consonance') {
    return `> ${criterion.threshold.toFixed(0)}%`;
  }
  if (criterion.id === 'cpu_proxy') {
    return `< ${criterion.threshold.toFixed(0)}%`;
  }
  return `< ${criterion.threshold.toFixed(0)} ms`;
}

export default function BenchmarkScreen() {
  const { state, progress, report, run, reset } = useBenchmarkRunner();
  const isRunning = state === 'running';
  const progressRatio =
    progress.total > 0 ? Math.min(1, progress.completed / progress.total) : 0;

  return (
    <ScreenShell
      title="Benchmark Mode"
      subtitle={`Tier 1 synthetic harness — ${BENCHMARK_PROFILE_COUNT.toLocaleString()} profiles`}
    >
      <MetricsDebugOverlay />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pass / Fail Criteria</Text>
        {BENCHMARK_TARGETS.map((target) => (
          <Text key={target.label} style={styles.target}>
            ○ {target.label} {target.detail}
          </Text>
        ))}
      </View>

      <View style={styles.runnerCard}>
        <Text style={styles.cardTitle}>Harness</Text>
        <Text style={styles.runnerHint}>
          Runs touch → HarmoniNet → cross-attention fusion for{' '}
          {BENCHMARK_PROFILE_COUNT.toLocaleString()} seeded synthetic profiles.
        </Text>

        <Pressable
          style={[styles.button, isRunning && styles.buttonDisabled]}
          onPress={run}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator color="#0B0B12" />
          ) : (
            <Text style={styles.buttonText}>Run benchmark</Text>
          )}
        </Pressable>

        {isRunning ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {progress.completed} / {progress.total} profiles
            </Text>
          </View>
        ) : null}

        {report && state === 'done' ? (
          <Pressable style={styles.resetButton} onPress={reset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.report}>
        <Text style={styles.reportLabel}>Report</Text>
        {!report ? (
          <Text style={styles.reportHint}>
            {isRunning
              ? 'Benchmark in progress…'
              : 'Run the harness to generate a pass/fail report.'}
          </Text>
        ) : (
          <>
            <Text
              style={[
                styles.verdict,
                report.passed ? styles.verdictPass : styles.verdictFail,
              ]}
            >
              {report.passed ? 'PASS' : 'FAIL'}
            </Text>
            <Text style={styles.reportMeta}>
              {report.profileCount.toLocaleString()} profiles in{' '}
              {report.wallClockMs.toFixed(0)} ms wall clock
            </Text>
            {report.criteria.map((criterion) => (
              <View key={criterion.id} style={styles.criterionRow}>
                <Text
                  style={[
                    styles.criterionStatus,
                    criterion.passed ? styles.statusPass : styles.statusFail,
                  ]}
                >
                  {criterion.passed ? '✓' : '✗'}
                </Text>
                <View style={styles.criterionBody}>
                  <Text style={styles.criterionLabel}>{criterion.label}</Text>
                  <Text style={styles.criterionValue}>
                    {formatCriterionValue(criterion)} (target {formatCriterionThreshold(criterion)})
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      <Link href="/" style={styles.link}>
        ← Back to Setup
      </Link>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: '#151522',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  runnerCard: {
    marginTop: 16,
    backgroundColor: '#151522',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  target: {
    color: '#8888A0',
    fontSize: 14,
  },
  runnerHint: {
    color: '#666680',
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#7EB6FF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#0B0B12',
    fontSize: 15,
    fontWeight: '700',
  },
  progressBlock: {
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#232333',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7EB6FF',
  },
  progressLabel: {
    color: '#8888A0',
    fontSize: 13,
  },
  resetButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  resetButtonText: {
    color: '#8888A0',
    fontSize: 14,
    fontWeight: '600',
  },
  report: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3A',
  },
  reportLabel: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportHint: {
    color: '#666680',
    fontSize: 14,
    lineHeight: 20,
  },
  verdict: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  verdictPass: {
    color: '#6EE7A8',
  },
  verdictFail: {
    color: '#FF8A8A',
  },
  reportMeta: {
    color: '#8888A0',
    fontSize: 13,
    marginBottom: 12,
  },
  criterionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A3A',
  },
  criterionStatus: {
    fontSize: 16,
    fontWeight: '700',
    width: 18,
  },
  statusPass: {
    color: '#6EE7A8',
  },
  statusFail: {
    color: '#FF8A8A',
  },
  criterionBody: {
    flex: 1,
    gap: 2,
  },
  criterionLabel: {
    color: '#C8C8D8',
    fontSize: 14,
    fontWeight: '600',
  },
  criterionValue: {
    color: '#8888A0',
    fontSize: 13,
  },
  link: {
    marginTop: 24,
    color: '#7EB6FF',
    fontSize: 16,
    fontWeight: '600',
  },
});
