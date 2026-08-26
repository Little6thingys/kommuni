import { runBenchmarkHarness } from '@/metrics/benchmarkHarness';
import { BENCHMARK_PROFILE_COUNT, BENCHMARK_THRESHOLDS } from '@/metrics/constants';
import { metricsStore } from '@/metrics/MetricsStore';

describe('benchmarkHarness', () => {
  beforeEach(() => {
    metricsStore.clear();
  });

  it('runs the Tier 1 synthetic harness for 1,000 profiles', () => {
    const report = runBenchmarkHarness(BENCHMARK_PROFILE_COUNT);
    expect(report.profileCount).toBe(BENCHMARK_PROFILE_COUNT);
    expect(report.criteria).toHaveLength(4);
    expect(report.wallClockMs).toBeGreaterThan(0);
  });

  it('evaluates pass/fail against plan thresholds', () => {
    const report = runBenchmarkHarness(100);

    for (const criterion of report.criteria) {
      if (criterion.id === 'consonance') {
        expect(criterion.passed).toBe(report.consonanceRate >= BENCHMARK_THRESHOLDS.minConsonanceRate);
      } else if (criterion.id === 'inference') {
        expect(criterion.passed).toBe(
          report.avgInferenceMs < BENCHMARK_THRESHOLDS.maxInferenceMs,
        );
      } else if (criterion.id === 'end_to_end') {
        expect(criterion.passed).toBe(
          report.avgEndToEndMs < BENCHMARK_THRESHOLDS.maxEndToEndMs,
        );
      } else if (criterion.id === 'cpu_proxy') {
        expect(criterion.passed).toBe(
          report.cpuProxyPercent < BENCHMARK_THRESHOLDS.maxCpuProxyPercent,
        );
      }
    }

    expect(report.passed).toBe(report.criteria.every((criterion) => criterion.passed));
  });

  it('records a benchmark metric entry', () => {
    runBenchmarkHarness(10);
    const entries = metricsStore.getEntries();
    expect(entries.some((entry) => entry.kind === 'benchmark')).toBe(true);
  });
});
