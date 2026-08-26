import { extractTouchFeatures } from '@/ml/touchFeatureExtraction';

describe('touchFeatureExtraction', () => {
  it('derives velocity and curvature from touch history', () => {
    const features = extractTouchFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 16 },
      { x: 20, y: 10, t: 32 },
    ]);

    expect(features[0]).toBeGreaterThan(0);
    expect(features[4]).toBeGreaterThan(0);
  });
});
