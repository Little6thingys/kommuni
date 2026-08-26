import { useCallback, useRef, useState } from 'react';

import { BenchmarkProgress, BenchmarkReport, runBenchmarkHarness } from '@/metrics/benchmarkHarness';
import { BENCHMARK_PROFILE_COUNT } from '@/metrics/constants';

export type BenchmarkRunnerState = 'idle' | 'running' | 'done';

export function useBenchmarkRunner() {
  const [state, setState] = useState<BenchmarkRunnerState>('idle');
  const [progress, setProgress] = useState<BenchmarkProgress>({
    completed: 0,
    total: BENCHMARK_PROFILE_COUNT,
  });
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(() => {
    if (runningRef.current) {
      return;
    }

    runningRef.current = true;
    setState('running');
    setReport(null);
    setProgress({ completed: 0, total: BENCHMARK_PROFILE_COUNT });

    requestAnimationFrame(() => {
      try {
        const nextReport = runBenchmarkHarness(BENCHMARK_PROFILE_COUNT, setProgress);
        setReport(nextReport);
        setState('done');
      } finally {
        runningRef.current = false;
      }
    });
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) {
      return;
    }
    setState('idle');
    setReport(null);
    setProgress({ completed: 0, total: BENCHMARK_PROFILE_COUNT });
  }, []);

  return {
    state,
    progress,
    report,
    run,
    reset,
  };
}
