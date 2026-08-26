import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { GazeSnapshot } from '@/types';

const MOCK_GAZE: GazeSnapshot = {
  gazeAngle: 25,
  isJointAttention: false,
  headPose: { yaw: 0, pitch: 0, roll: 0 },
};

type GazeTrackingStatus =
  | 'request-permission'
  | 'permission-denied'
  | 'device-unavailable'
  | 'preview-only'
  | 'native-ready';

type GazeTrackingCapability = {
  label: string;
  ready: boolean;
};

function getMediaPipeModule(): object | null {
  try {
    return require('react-native-mediapipe');
  } catch {
    return null;
  }
}

function isResolvedNativeAssetPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(file:\/\/|content:\/\/|\/|[A-Za-z]:\\)/.test(value)
  );
}

export type UseGazeTrackingResult = {
  snapshot: GazeSnapshot;
  isMocked: boolean;
  status: GazeTrackingStatus;
  statusLabel: string;
  statusDetail: string;
  permissionGranted: boolean;
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  cameraDevice: ReturnType<typeof useCameraDevice>;
  modelPath: string | null;
  showLiveCameraPreview: boolean;
  enableNativeTracking: boolean;
  capabilities: GazeTrackingCapability[];
  blockers: string[];
  setNativeSnapshot: (next: GazeSnapshot) => void;
  setNativeError: (message: string) => void;
  runtimeError: string | null;
};

/** JS adapter for Module 2 that degrades cleanly until native MediaPipe wiring is prebuilt. */
export function useGazeTracking(): UseGazeTrackingResult {
  const [nativeSnapshot, setNativeSnapshot] = useState<GazeSnapshot | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState(() =>
    Camera.getCameraPermissionStatus(),
  );
  const cameraPermission = useCameraPermission();
  const cameraDevice = useCameraDevice('front');
  const modelPath =
    (Constants.expoConfig?.extra?.faceLandmarkerModelPath as string | undefined) ?? null;
  const mediaPipeModule = useMemo(() => getMediaPipeModule(), []);
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const modelPathResolved = isResolvedNativeAssetPath(modelPath);
  const permissionGranted = cameraPermission.hasPermission;
  const canRequestPermission = !permissionGranted;

  const capabilities = useMemo<GazeTrackingCapability[]>(
    () => [
      { label: 'Vision Camera permission', ready: permissionGranted },
      { label: 'Front camera device', ready: Boolean(cameraDevice) },
      { label: 'MediaPipe JS package', ready: Boolean(mediaPipeModule) },
      { label: 'Resolved .task asset path', ready: modelPathResolved },
      { label: 'Expo Dev Client runtime', ready: !isExpoGo },
    ],
    [cameraDevice, isExpoGo, mediaPipeModule, modelPathResolved, permissionGranted],
  );

  const blockers = useMemo(() => {
    const next: string[] = [];

    if (!permissionGranted) {
      next.push('Camera permission has not been granted.');
    }
    if (!cameraDevice) {
      next.push('No front camera device is available for preview.');
    }
    if (!mediaPipeModule) {
      next.push('react-native-mediapipe is not available at runtime.');
    }
    if (isExpoGo) {
      next.push('Frame processors require an Expo Dev Client or native build, not Expo Go.');
    }
    if (!modelPathResolved) {
      next.push(
        'The configured MediaPipe model path is still a bundle-relative string; the detector needs a native-readable file path after prebuild/asset resolution.',
      );
    }
    if (runtimeError) {
      next.push(runtimeError);
    }

    return next;
  }, [
    cameraDevice,
    isExpoGo,
    mediaPipeModule,
    modelPathResolved,
    permissionGranted,
    runtimeError,
  ]);

  const enableNativeTracking =
    permissionGranted &&
    Boolean(cameraDevice) &&
    Boolean(mediaPipeModule) &&
    !isExpoGo &&
    modelPathResolved &&
    !runtimeError;

  const status: GazeTrackingStatus = useMemo(() => {
    if (!permissionGranted) {
      return permissionStatus === 'denied' || permissionStatus === 'restricted'
        ? 'permission-denied'
        : 'request-permission';
    }
    if (!cameraDevice) {
      return 'device-unavailable';
    }
    if (enableNativeTracking) {
      return 'native-ready';
    }
    return 'preview-only';
  }, [cameraDevice, enableNativeTracking, permissionGranted, permissionStatus]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'request-permission':
        return 'Camera permission required';
      case 'permission-denied':
        return 'Camera permission denied';
      case 'device-unavailable':
        return 'Front camera unavailable';
      case 'native-ready':
        return 'Native gaze tracking ready';
      case 'preview-only':
      default:
        return 'Preview-only fallback active';
    }
  }, [status]);

  const statusDetail = useMemo(() => {
    switch (status) {
      case 'request-permission':
        return 'Grant camera access to enable Phase 2 camera preview and native gaze tracking when the dev client build is ready.';
      case 'permission-denied':
        return 'The hook falls back to mocked gaze data so the Phase 2 UI remains testable without camera access.';
      case 'device-unavailable':
        return 'No front-facing camera was detected, so gaze tracking stays on mocked state.';
      case 'native-ready':
        return 'The native frame processor path can be mounted from a dev client build with a resolved face landmarker model.';
      case 'preview-only':
      default:
        return 'The camera preview can run, but MediaPipe stays mocked until prebuild/native asset wiring provides a detector-ready .task file path.';
    }
  }, [status]);

  const requestPermission = useCallback(async () => {
    setRuntimeError(null);
    const granted = await cameraPermission.requestPermission();
    setPermissionStatus(granted ? 'granted' : Camera.getCameraPermissionStatus());
    return granted;
  }, [cameraPermission]);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  const setNativeError = useCallback((message: string) => {
    setRuntimeError(message);
  }, []);

  useEffect(() => {
    setPermissionStatus(cameraPermission.hasPermission ? 'granted' : Camera.getCameraPermissionStatus());
  }, [cameraPermission.hasPermission]);

  useEffect(() => {
    if (!permissionGranted) {
      setNativeSnapshot(null);
    }
  }, [permissionGranted]);

  return {
    snapshot: nativeSnapshot ?? MOCK_GAZE,
    isMocked: nativeSnapshot === null,
    status,
    statusLabel,
    statusDetail,
    permissionGranted,
    canRequestPermission,
    requestPermission,
    openSettings,
    cameraDevice,
    modelPath,
    showLiveCameraPreview: permissionGranted && Boolean(cameraDevice),
    enableNativeTracking,
    capabilities,
    blockers,
    setNativeSnapshot,
    setNativeError,
    runtimeError,
  };
}
