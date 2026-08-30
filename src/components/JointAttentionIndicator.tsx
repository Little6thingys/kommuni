import { PHASE2_GUI } from '@/copy/phaseTitles';
import { StyleSheet, Text, View } from 'react-native';

type JointAttentionIndicatorProps = {
  active: boolean;
  /** Native MediaPipe gaze path is live (not preview-only mock). */
  nativeReady?: boolean;
};

/** Phase 2 overlay — surfaces joint-attention state on the camera / stage. */
export function JointAttentionIndicator({
  active,
  nativeReady = false,
}: JointAttentionIndicatorProps) {
  if (active) {
    return (
      <View style={styles.activeWrap} pointerEvents="none">
        <View style={styles.activePill}>
          <Text style={styles.activeDot}>●</Text>
          <Text style={styles.activeText}>{PHASE2_GUI.jointAttentionActive}</Text>
        </View>
      </View>
    );
  }

  if (nativeReady) {
    return (
      <View style={styles.hintWrap} pointerEvents="none">
        <Text style={styles.hintText}>{PHASE2_GUI.jointAttentionHint}</Text>
      </View>
    );
  }

  return (
    <View style={styles.hintWrap} pointerEvents="none">
      <Text style={styles.unavailableText}>{PHASE2_GUI.jointAttentionUnavailable}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(18, 72, 42, 0.92)',
    borderWidth: 2,
    borderColor: '#7EE787',
    shadowColor: '#7EE787',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  activeDot: {
    color: '#9BFFC0',
    fontSize: 14,
    lineHeight: 16,
  },
  activeText: {
    color: '#E8FFF0',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hintWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hintText: {
    color: 'rgba(200, 230, 210, 0.78)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  unavailableText: {
    color: 'rgba(180, 190, 210, 0.65)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
