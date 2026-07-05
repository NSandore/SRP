import { ScrollView, StyleSheet, View } from 'react-native';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';

export default function PlaceholderScreen({
  title,
  description,
  showSearch = true,
}: {
  title: string;
  description: string;
  showSearch?: boolean;
}) {
  const styles = useBrandStyles(createStyles);

  return (
    <AppShell showSearch={showSearch}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title">{title}</ThemedText>
        <ThemedText style={styles.helper}>{description}</ThemedText>
        <View style={styles.card}>
          <ThemedText type="defaultSemiBold">Next up</ThemedText>
          <ThemedText style={styles.meta}>
            We will wire this screen to the same backend endpoints used by the web app.
          </ThemedText>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  container: {
    padding: Brand.spacing.lg,
    gap: 12,
  },
  helper: {
    opacity: 0.7,
  },
  card: {
    padding: 12,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  meta: {
    opacity: 0.6,
  },
});
