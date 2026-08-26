import { render } from '@testing-library/react-native';

import { MetricsDebugOverlay } from '@/components/MetricsDebugOverlay';

describe('MetricsDebugOverlay', () => {
  it('renders live latency, stress, FSM, gaze, and consonance', () => {
    const { getByText } = render(
      <MetricsDebugOverlay
        latencyMs={4.2}
        stress={0.18}
        fsm="PATIENCE"
        gazeAngle={12.5}
        consonance={0.94}
      />,
    );

    expect(getByText('Debug')).toBeTruthy();
    expect(getByText('Latency 4.2 ms')).toBeTruthy();
    expect(getByText('Stress 0.18')).toBeTruthy();
    expect(getByText('FSM PATIENCE')).toBeTruthy();
    expect(getByText('Gaze 12.5°')).toBeTruthy();
    expect(getByText('Consonance 94%')).toBeTruthy();
  });
});
