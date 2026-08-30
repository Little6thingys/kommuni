import Constants from 'expo-constants';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Camera, type CameraDevice, type CameraProps } from 'react-native-vision-camera';

import { isJointAttentionFrame } from '@/ml/jointAttention';
import { normalizeModelPathForMediaPipe } from '@/ml/resolveFaceLandmarkerModel';
import type { GazeSnapshot } from '@/types';

type GazeTrackingPreviewProps = {
  device: CameraDevice | undefined;
  enableNativeTracking: boolean;
  modelPath: string | null;
  onSnapshot: (snapshot: GazeSnapshot) => void;
  onRuntimeError: (message: string) => void;
  resizeMode?: 'cover' | 'contain';
  edgeToEdge?: boolean;
};

type MediaPipeSolution = {
  frameProcessor: NonNullable<CameraProps['frameProcessor']>;
  cameraViewLayoutChangeHandler: (event: LayoutChangeEvent) => void;
  cameraDeviceChangeHandler: (device: CameraDevice | undefined) => void;
};

type MediaPipeBindings = {
  Delegate: { CPU: number; GPU: number };
  RunningMode: { LIVE_STREAM: number };
  useFaceLandmarkDetection: (
    onResults: (
      result: {
        results: Array<{
          faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
          facialTransformationMatrixes: Array<{ data: number[] }>;
        }>;
      },
      viewSize: { width: number; height: number },
      mirrored: boolean,
    ) => void,
    onError: (error: { message: string }) => void,
    runningMode: number,
    model: string,
    options?: {
      numFaces?: number;
      minFaceDetectionConfidence?: number;
      minFacePresenceConfidence?: number;
      minTrackingConfidence?: number;
      delegate?: number;
      mirrorMode?: 'no-mirror' | 'mirror' | 'mirror-front-only';
    },
  ) => MediaPipeSolution;
};

function getCameraPreviewRotationDeg(): number {
  const value = Constants.expoConfig?.extra?.cameraPreviewRotationDeg;
  return typeof value === 'number' ? value : 0;
}

function buildPreviewTransform(rotationDeg: number) {
  if (rotationDeg === 0) {
    return undefined;
  }

  return {
    transform: [{ rotate: `${rotationDeg}deg` }],
  };
}

/** Sizes the camera view so a 90°/270° rotation fills the preview box edge-to-edge. */
function buildCameraPreviewStyle(
  rotationDeg: number,
  layout: { width: number; height: number },
) {
  if (layout.width <= 0 || layout.height <= 0) {
    return StyleSheet.absoluteFill;
  }

  const normalized = ((rotationDeg % 360) + 360) % 360;
  if (normalized === 0) {
    return StyleSheet.absoluteFill;
  }

  const isSideways = normalized === 90 || normalized === 270;
  if (!isSideways) {
    return [StyleSheet.absoluteFill, buildPreviewTransform(rotationDeg)];
  }

  const bleed = 1.05;
  return {
    position: 'absolute' as const,
    width: layout.height,
    height: layout.width,
    left: (layout.width - layout.height) / 2,
    top: (layout.height - layout.width) / 2,
    transform: [{ rotate: `${rotationDeg}deg` }, { scale: bleed }],
  };
}

function loadMediaPipeBindings(): MediaPipeBindings | null {
  try {
    return require('react-native-mediapipe') as MediaPipeBindings;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function averagePoint(points: Array<{ x: number; y: number; z: number }>) {
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const total = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
      z: acc.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function getLandmark(
  landmarks: Array<{ x: number; y: number; z: number }>,
  index: number,
) {
  return landmarks[index] ?? { x: 0, y: 0, z: 0 };
}

function getPoseFromMatrix(matrixData?: number[]) {
  if (!matrixData || matrixData.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const m00 = matrixData[0];
  const m10 = matrixData[4];
  const m20 = matrixData[8];
  const m21 = matrixData[9];
  const m22 = matrixData[10];

  return {
    yaw: toDegrees(Math.atan2(m20, m00)),
    pitch: toDegrees(Math.atan2(-m21, Math.sqrt(m20 * m20 + m22 * m22))),
    roll: toDegrees(Math.atan2(m10, m00)),
  };
}

function deriveSnapshot(
  result: {
    faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
    facialTransformationMatrixes: Array<{ data: number[] }>;
  } | null,
): GazeSnapshot | null {
  const landmarks = result?.faceLandmarks?.[0];

  if (!landmarks || landmarks.length < 478) {
    return null;
  }

  const leftIris = averagePoint([468, 469, 470, 471, 472].map((index) => getLandmark(landmarks, index)));
  const rightIris = averagePoint([473, 474, 475, 476, 477].map((index) => getLandmark(landmarks, index)));
  const leftInner = getLandmark(landmarks, 133);
  const leftOuter = getLandmark(landmarks, 33);
  const rightInner = getLandmark(landmarks, 362);
  const rightOuter = getLandmark(landmarks, 263);

  const leftSpan = Math.max(Math.abs(leftOuter.x - leftInner.x), 0.001);
  const rightSpan = Math.max(Math.abs(rightOuter.x - rightInner.x), 0.001);
  const leftOffset = ((leftIris.x - Math.min(leftOuter.x, leftInner.x)) / leftSpan - 0.5) * 2;
  const rightOffset =
    ((rightIris.x - Math.min(rightOuter.x, rightInner.x)) / rightSpan - 0.5) * 2;
  const horizontalOffset = clamp((leftOffset + rightOffset) / 2, -1, 1);
  const gazeAngle = clamp(horizontalOffset * 30, -30, 30);

  const leftUpper = getLandmark(landmarks, 159);
  const leftLower = getLandmark(landmarks, 145);
  const rightUpper = getLandmark(landmarks, 386);
  const rightLower = getLandmark(landmarks, 374);
  const leftVertSpan = Math.max(Math.abs(leftUpper.y - leftLower.y), 0.001);
  const rightVertSpan = Math.max(Math.abs(rightUpper.y - rightLower.y), 0.001);
  const leftVertOffset =
    ((leftIris.y - (leftUpper.y + leftLower.y) / 2) / leftVertSpan) * 2;
  const rightVertOffset =
    ((rightIris.y - (rightUpper.y + rightLower.y) / 2) / rightVertSpan) * 2;
  const verticalOffset = clamp((leftVertOffset + rightVertOffset) / 2, -1, 1);
  const gazePitch = clamp(verticalOffset * 24, -24, 24);

  const headPose = getPoseFromMatrix(result?.facialTransformationMatrixes?.[0]?.data);

  const snapshot: GazeSnapshot = {
    gazeAngle,
    gazePitch,
    isJointAttention: false,
    headPose,
  };

  return {
    ...snapshot,
    isJointAttention: isJointAttentionFrame(snapshot),
  };
}

function VisionCameraPreview({
  device,
  frameProcessor,
  onLayout,
  resizeMode = 'cover',
}: {
  device: CameraDevice;
  frameProcessor?: CameraProps['frameProcessor'];
  onLayout?: (event: LayoutChangeEvent) => void;
  resizeMode?: 'cover' | 'contain';
}) {
  const [uiRotation, setUiRotation] = useState(0);
  const [layout, setLayout] = useState({ width: 1, height: 1 });
  const configRotation = getCameraPreviewRotationDeg();
  // Manual config overrides auto uiRotation to avoid stacking two corrections.
  const rotationDeg = configRotation !== 0 ? configRotation : uiRotation;
  const cameraStyle = buildCameraPreviewStyle(rotationDeg, layout);

  return (
    <View
      style={styles.previewHost}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout({ width, height });
        onLayout?.(event);
      }}
    >
      <Camera
        style={cameraStyle}
        device={device}
        isActive
        photo={false}
        video={false}
        audio={false}
        pixelFormat={frameProcessor ? 'rgb' : undefined}
        resizeMode={resizeMode}
        androidPreviewViewType="texture-view"
        onUIRotationChanged={configRotation === 0 ? setUiRotation : undefined}
        frameProcessor={frameProcessor}
      />
    </View>
  );
}

function NativeMediapipeCamera({
  bindings,
  device,
  modelPath,
  onSnapshot,
  onRuntimeError,
  resizeMode = 'cover',
}: {
  bindings: MediaPipeBindings;
  device: CameraDevice;
  modelPath: string;
  onSnapshot: (snapshot: GazeSnapshot) => void;
  onRuntimeError: (message: string) => void;
  resizeMode?: 'cover' | 'contain';
}) {
  const { Delegate, RunningMode, useFaceLandmarkDetection } = bindings;

  const onResults = useMemo(
    () =>
      (
        bundle: {
          results: Array<{
            faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
            facialTransformationMatrixes: Array<{ data: number[] }>;
          }>;
        },
      ) => {
        const snapshot = deriveSnapshot(bundle.results?.[0] ?? null);
        if (snapshot) {
          onSnapshot(snapshot);
        }
      },
    [onSnapshot],
  );

  const solution = useFaceLandmarkDetection(
    onResults,
    (error) => {
      onRuntimeError(error.message || 'MediaPipe detector failed to start.');
    },
    RunningMode.LIVE_STREAM,
    normalizeModelPathForMediaPipe(modelPath),
    {
      delegate: Delegate.CPU,
      mirrorMode: 'mirror-front-only',
      numFaces: 1,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    },
  );

  useEffect(() => {
    solution.cameraDeviceChangeHandler(device);
  }, [device, solution]);

  return (
    <VisionCameraPreview
      device={device}
      frameProcessor={solution.frameProcessor}
      onLayout={solution.cameraViewLayoutChangeHandler}
      resizeMode={resizeMode}
    />
  );
}

export function GazeTrackingPreview({
  device,
  enableNativeTracking,
  modelPath,
  onSnapshot,
  onRuntimeError,
  resizeMode = 'cover',
  edgeToEdge = false,
}: GazeTrackingPreviewProps) {
  const bindings = useMemo(() => {
    if (!enableNativeTracking || !modelPath) {
      return null;
    }

    const loaded = loadMediaPipeBindings();
    if (!loaded) {
      onRuntimeError('react-native-mediapipe could not be loaded from this runtime.');
    }
    return loaded;
  }, [enableNativeTracking, modelPath, onRuntimeError]);

  const containerStyle = edgeToEdge ? styles.fillEdgeToEdge : styles.fill;

  if (!device) {
    return (
      <View style={[containerStyle, styles.center]}>
        <Text style={styles.placeholderText}>Front camera device unavailable.</Text>
      </View>
    );
  }

  if (enableNativeTracking && bindings && modelPath) {
    return (
      <View style={containerStyle}>
        <NativeMediapipeCamera
          bindings={bindings}
          device={device}
          modelPath={modelPath}
          onSnapshot={onSnapshot}
          onRuntimeError={onRuntimeError}
          resizeMode={resizeMode}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <VisionCameraPreview device={device} resizeMode={resizeMode} />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Preview only</Text>
        <Text style={styles.overlaySubtext}>
          MediaPipe stays mocked until the dev-client native detector is prebuilt.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12131A',
  },
  fillEdgeToEdge: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#12131A',
  },
  previewHost: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#12131A',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    color: '#8888A0',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    left: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(11, 11, 18, 0.84)',
    padding: 12,
    gap: 4,
  },
  overlayText: {
    color: '#F5F5FA',
    fontWeight: '700',
  },
  overlaySubtext: {
    color: '#B7B7C9',
    fontSize: 12,
    lineHeight: 18,
  },
});
