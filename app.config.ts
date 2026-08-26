import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Kommuni',
  slug: 'kommuni',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'kommuni',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.kommuni.app',
    infoPlist: {
      NSCameraUsageDescription:
        'Kommuni uses the camera for gaze tracking during Phase 2 dyadic interaction.',
      NSMicrophoneUsageDescription:
        'Kommuni does not record audio; microphone access is not required.',
    },
  },
  android: {
    package: 'com.kommuni.app',
    adaptiveIcon: {
      backgroundColor: '#0B0B12',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['android.permission.CAMERA'],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'react-native-vision-camera',
      {
        cameraPermissionText:
          'Kommuni uses the camera for gaze tracking during Phase 2 dyadic interaction.',
        enableMicrophonePermission: false,
      },
    ],
    'onnxruntime-react-native',
    // react-native-mediapipe has no Expo config plugin. The remaining native step is
    // prebuild/manual Android+iOS detector wiring plus resolving face_landmarker.task to a native file path.
    'expo-file-system',
    'expo-sharing',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'kommuni-research-prototype',
    },
    // A bundle-relative string is useful for config, but the native detector still needs a
    // real file/content URI after prebuild or explicit asset-copy setup in the dev client build.
    faceLandmarkerModelPath: './assets/models/face_landmarker.task',
  },
};

export default config;
