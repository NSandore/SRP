import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';

export default function FundingScreen() {
  const router = useRouter();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  return (
    <AppShell>
      <View style={styles.screen}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.pageTitle}>
            Funding
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            We&apos;re crafting a richer funding experience. Stay tuned!
          </ThemedText>
        </View>

        <View style={styles.lockedWrapper}>
          <View style={styles.lockedCard}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="medal" size={28} color={colors.primaryFrom} />
            </View>
            <View style={styles.chip}>
              <ThemedText style={styles.chipText}>Funding lab</ThemedText>
            </View>
            <ThemedText style={styles.cardTitle}>Funding hub is coming soon</ThemedText>
            <ThemedText style={styles.cardText}>
              We&apos;re building curated scholarship tracking, mentor tips, and deadline reminders
              so you can secure the support you need faster.
            </ThemedText>
            <View style={styles.actions}>
              <Pressable onPress={() => router.push('/feed')}>
                <LinearGradient
                  colors={[colors.primaryFrom, colors.primaryTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <ThemedText style={styles.primaryButtonText}>Go back home</ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    padding: Brand.spacing.lg,
    gap: 16,
    backgroundColor: colors.page,
  },
  header: {
    gap: 6,
  },
  pageTitle: {
    fontWeight: '700',
  },
  subtitle: {
    color: colors.subtext,
    fontSize: 12,
  },
  lockedWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  lockedCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 28,
    elevation: 5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: hexToRgba('#0f172a', 0.08),
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
  },
  actions: {
    marginTop: 6,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
