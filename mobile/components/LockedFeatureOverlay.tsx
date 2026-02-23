import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useBrandStyles } from '@/hooks/use-brand-styles';

type LockedFeatureOverlayProps = {
  visible: boolean;
  feature: string;
  onClose: () => void;
  onLogin: () => void;
  onSignUp: () => void;
};

const highlights = [
  { icon: 'bookmark-outline', label: 'Save threads & posts for later' },
  { icon: 'account-group-outline', label: 'Grow your network and chat directly' },
  { icon: 'account-circle-outline', label: 'Build a rich profile others can see' },
];

export default function LockedFeatureOverlay({
  visible,
  feature,
  onClose,
  onLogin,
  onSignUp,
}: LockedFeatureOverlayProps) {
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={18} color={colors.subtext} />
          </Pressable>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="lock" size={28} color={colors.primaryFrom} />
          </View>
          <View style={styles.chip}>
            <ThemedText style={styles.chipText}>Members only</ThemedText>
          </View>
          <ThemedText style={styles.title}>{feature} is locked</ThemedText>
          <ThemedText style={styles.description}>
            Create a free StudentSphere account or sign back in to unlock personalized tools
            like saved collections, your connections list, and rich profile insights.
          </ThemedText>
          <View style={styles.highlights}>
            {highlights.map((item) => (
              <View key={item.label} style={styles.highlightRow}>
                <View style={styles.highlightIcon}>
                  <MaterialCommunityIcons name={item.icon as any} size={16} color={colors.primaryFrom} />
                </View>
                <ThemedText style={styles.highlightText}>{item.label}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={onSignUp}>
              <ThemedText style={styles.primaryText}>Create free account</ThemedText>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={onLogin}>
              <ThemedText style={styles.ghostText}>Log in instead</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0c1831',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.text, 0.06),
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
  },
  highlights: {
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
    width: '100%',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.page,
  },
  highlightText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.primaryFrom,
    shadowColor: colors.primaryFrom,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  ghostButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.4),
  },
  ghostText: {
    color: colors.primaryFrom,
    fontSize: 13,
    fontWeight: '600',
  },
});
