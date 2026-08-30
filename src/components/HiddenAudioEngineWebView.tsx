import { RefObject } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { SYNTH_ENGINE_SOURCE } from '@/audio/synthEngineSource';

type HiddenAudioEngineWebViewProps = {
  webViewRef: RefObject<WebView | null>;
  onMessage: (event: WebViewMessageEvent) => void;
  onLoadEnd?: () => void;
};

export function HiddenAudioEngineWebView({
  webViewRef,
  onMessage,
  onLoadEnd,
}: HiddenAudioEngineWebViewProps) {
  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html: SYNTH_ENGINE_SOURCE }}
      onMessage={onMessage}
      onLoadEnd={onLoadEnd}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      pointerEvents="none"
      style={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -1000,
    top: 0,
    width: 120,
    height: 120,
    opacity: 0.01,
  },
});
