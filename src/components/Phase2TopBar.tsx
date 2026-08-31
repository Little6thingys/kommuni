import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PHASE2_GUI } from '@/copy/phaseTitles';
import { colors, fonts } from '@/theme';

type Phase2TopBarProps = {
  topInset: number;
  onBack: () => void;
  rightSlot?: ReactNode;
};

export function Phase2TopBar({ topInset, onBack, rightSlot }: Phase2TopBarProps) {
  return (
    <View style={[styles.bar, { top: topInset + 4 }]} pointerEvents="box-none">
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={styles.backButtonText}>{PHASE2_GUI.backLabel}</Text>
      </Pressable>
      <View style={styles.descriptionWrap}>
        <Text style={styles.description}>{PHASE2_GUI.description}</Text>
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(244, 250, 249, 0.75)',
    borderRadius: 8,
    flexShrink: 0,
  },
  backButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
    fontSize: 15,
  },
  descriptionWrap: {
    flex: 1,
    backgroundColor: 'rgba(244, 250, 249, 0.92)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(111, 168, 162, 0.35)',
  },
  description: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  rightSlot: {
    flexShrink: 0,
    paddingTop: 2,
  },
});
