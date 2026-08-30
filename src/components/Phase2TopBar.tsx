import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PHASE2_GUI } from '@/copy/phaseTitles';

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
      <Text style={styles.description}>{PHASE2_GUI.description}</Text>
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
    backgroundColor: 'rgba(11, 11, 18, 0.55)',
    borderRadius: 8,
    flexShrink: 0,
  },
  backButtonText: {
    color: '#7EB6FF',
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    flex: 1,
    color: '#C8C8D8',
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 7,
    paddingRight: 4,
  },
  rightSlot: {
    flexShrink: 0,
    paddingTop: 2,
  },
});
