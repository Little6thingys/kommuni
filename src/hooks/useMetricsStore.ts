import { useCallback, useEffect, useState } from 'react';

import { metricsStore, SessionSummary } from '@/metrics/MetricsStore';
import { MetricEntry } from '@/types';

export function useMetricsStore() {
  const [entries, setEntries] = useState<readonly MetricEntry[]>(() => metricsStore.getEntries());
  const [summary, setSummary] = useState<SessionSummary>(() => metricsStore.getSessionSummary());

  useEffect(() => {
    return metricsStore.subscribe(() => {
      setEntries(metricsStore.getEntries());
      setSummary(metricsStore.getSessionSummary());
    });
  }, []);

  const clear = useCallback(() => {
    metricsStore.clear();
  }, []);

  const shareCsvExport = useCallback(() => metricsStore.shareCsvExport(), []);
  const shareEncryptedJsonExport = useCallback(
    () => metricsStore.shareEncryptedJsonExport(),
    [],
  );

  const setSessionDemoMode = useCallback((enabled: boolean) => {
    metricsStore.setSessionDemoMode(enabled);
  }, []);

  return {
    entries,
    summary,
    clear,
    setSessionDemoMode,
    shareCsvExport,
    shareEncryptedJsonExport,
  };
}
