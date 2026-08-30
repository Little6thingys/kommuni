import { StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: 'rgba(255, 250, 235, 0.55)',
  },
  emoji: {
    fontSize: 112,
    lineHeight: 124,
  },
});
