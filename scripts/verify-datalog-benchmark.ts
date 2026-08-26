/**
 * Focused verification for datalog-benchmark slice (no React Native runtime).
 * Run: npx tsx scripts/verify-datalog-benchmark.ts
 */
import { runBenchmarkHarness } from '../src/metrics/benchmarkHarness';
import { BENCHMARK_PROFILE_COUNT, BENCHMARK_THRESHOLDS, METRICS_EXPORT_SECRET } from '../src/metrics/constants';
import { metricsStore } from '../src/metrics/MetricsStore';
import { decryptExportPayload, encryptExportPayload } from '../src/utils/encryption';

metricsStore.clear();
const report = runBenchmarkHarness(BENCHMARK_PROFILE_COUNT);

console.log('Benchmark harness (1000 profiles):');
console.log(`  PASS: ${report.passed}`);
console.log(
  `  avg inference: ${report.avgInferenceMs.toFixed(3)} ms (target < ${BENCHMARK_THRESHOLDS.maxInferenceMs})`,
);
console.log(
  `  avg end-to-end: ${report.avgEndToEndMs.toFixed(3)} ms (target < ${BENCHMARK_THRESHOLDS.maxEndToEndMs})`,
);
console.log(
  `  CPU proxy: ${report.cpuProxyPercent.toFixed(2)}% (target < ${BENCHMARK_THRESHOLDS.maxCpuProxyPercent})`,
);
console.log(
  `  consonance: ${(report.consonanceRate * 100).toFixed(1)}% (target > ${BENCHMARK_THRESHOLDS.minConsonanceRate * 100})`,
);

const csv = metricsStore.toCsv();
const plainJson = metricsStore.toPlainJson();
const encrypted = encryptExportPayload(plainJson, METRICS_EXPORT_SECRET);
const decrypted = decryptExportPayload(encrypted, METRICS_EXPORT_SECRET);

console.log('\nMetricsStore export:');
console.log(`  entries: ${metricsStore.getEntries().length}`);
console.log(`  CSV header ok: ${csv.startsWith('id,timestamp,kind,payload')}`);
console.log(
  `  JSON round-trip ok: ${JSON.parse(decrypted).entries.length === metricsStore.getEntries().length}`,
);

if (!report.passed) {
  process.exitCode = 1;
}
