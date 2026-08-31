import { PHASE2_GUI } from '@/copy/phaseTitles';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

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
    borderRadius: radii.pill,
    backgroundColor: 'rgba(244, 250, 249, 0.92)',
    borderWidth: 2,
    borderColor: colors.tide,
    shadowColor: colors.tide,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  activeDot: {
    color: colors.accent,
    fontSize: 14,
    lineHeight: 16,
  },
  activeText: {
    fontFamily: fonts.bodyMedium,
    color: colors.deepTide,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hintWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hintText: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    textAlign: 'center',
  },
  unavailableText: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.75,
  },
});
