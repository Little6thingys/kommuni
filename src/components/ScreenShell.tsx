import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing, typography } from '@/theme';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  centered?: boolean;
};

export function ScreenShell({ title, subtitle, children, centered = false }: ScreenShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, centered && styles.contentCentered]}
      >
        <View style={[styles.header, centered && styles.headerCentered]}>
          <Text style={[styles.title, centered && styles.titleCentered]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 32,
    maxWidth: spacing.contentMaxWidth + spacing.screenPadding * 2,
    alignSelf: 'center',
    width: '100%',
  },
  contentCentered: {
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  headerCentered: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    ...typography.displayTitle,
  },
  titleCentered: {
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
});
