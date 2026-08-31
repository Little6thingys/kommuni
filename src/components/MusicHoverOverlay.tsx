import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

type MusicHoverOverlayProps = {
  active: boolean;
};

/** Full-screen smile flash — must sit above camera + lower dock. */
export function MusicHoverOverlay({ active }: MusicHoverOverlayProps) {
  if (!active) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Text style={styles.emoji}>😊</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 250, 249, 0.62)',
  },
  emoji: {
    fontSize: 112,
    lineHeight: 124,
  },
});
