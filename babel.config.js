module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required for Vision Camera frame processors and react-native-mediapipe worklets.
    plugins: ['react-native-worklets-core/plugin', 'react-native-reanimated/plugin'],
  };
};
