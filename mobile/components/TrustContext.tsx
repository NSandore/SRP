import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { hexToRgba, useBrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';

type TrustPost = {
  perspective_type?: string | null;
  perspective_label?: string | null;
  perspective_description?: string | null;
  verified?: number | string;
  reviewed_at?: string | null;
  verified_at?: string | null;
  review_status?: string | null;
  review_note?: string | null;
  reviewer_first_name?: string | null;
  reviewer_last_name?: string | null;
  applicable_community_name?: string | null;
  source_name?: string | null;
  source_url?: string | null;
};

const FALLBACK_LABELS: Record<string, string> = {
  student_experience: 'Student experience',
  alumni_experience: 'Alumni experience',
  professional_guidance: 'Professional guidance',
  official_institutional: 'Official institutional information',
  community_suggestion: 'Community suggestion',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function TrustContext({ post, institutional = false }: { post: TrustPost; institutional?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const type = institutional ? 'official_institutional' : (post.perspective_type || 'community_suggestion');
  const label = post.perspective_label || FALLBACK_LABELS[type] || FALLBACK_LABELS.community_suggestion;
  const reviewed = Number(post.verified) === 1 || Boolean(post.reviewed_at);
  const stale = post.review_status === 'stale';
  const reviewedDate = formatDate(post.reviewed_at || post.verified_at);
  const reviewer = [post.reviewer_first_name, post.reviewer_last_name].filter(Boolean).join(' ');

  return (
    <View style={[styles.container, stale && styles.containerStale]}>
      <Pressable style={styles.summary} onPress={() => setExpanded((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.perspectivePill}>
          <MaterialCommunityIcons name="information-outline" size={14} color={colors.primaryFrom} />
          <ThemedText style={styles.perspectiveText}>{label}</ThemedText>
        </View>
        {reviewed && !stale ? (
          <View style={styles.reviewedPill}>
            <MaterialCommunityIcons name="check-decagram" size={14} color="#16804a" />
            <ThemedText style={styles.reviewedText}>Reviewed</ThemedText>
          </View>
        ) : null}
        {stale ? (
          <View style={styles.stalePill}>
            <MaterialCommunityIcons name="alert-outline" size={14} color="#b45f06" />
            <ThemedText style={styles.staleText}>May be outdated</ThemedText>
          </View>
        ) : null}
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subtext} />
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <ThemedText style={styles.detailText}>{post.perspective_description || 'This label describes the perspective behind the answer, not a guarantee that it applies to everyone.'}</ThemedText>
          {reviewed ? (
            <ThemedText style={styles.detailText}>
              Reviewed{reviewedDate ? ` on ${reviewedDate}` : ''}{reviewer ? ` by ${reviewer}` : ''}. Policies can still change after review.
            </ThemedText>
          ) : null}
          {post.applicable_community_name ? <ThemedText style={styles.detailText}>Applies to: {post.applicable_community_name}</ThemedText> : null}
          {post.review_note ? <ThemedText style={styles.detailText}>Reviewer note: {post.review_note}</ThemedText> : null}
          {post.source_url ? (
            <Pressable onPress={() => Linking.openURL(post.source_url as string)}>
              <ThemedText style={styles.sourceLink}>{post.source_name || 'Open supporting source'} ↗</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useBrandColors>) => StyleSheet.create({
  container: { borderWidth: 1, borderColor: hexToRgba(colors.primaryFrom, 0.28), borderRadius: 12, backgroundColor: hexToRgba(colors.primaryFrom, 0.06), marginVertical: 8 },
  containerStale: { borderColor: 'rgba(217,119,6,0.45)' },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, padding: 9 },
  perspectivePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: hexToRgba(colors.primaryFrom, 0.11), borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, flexShrink: 1 },
  perspectiveText: { color: colors.primaryFrom, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  reviewedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(22,163,74,0.11)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  reviewedText: { color: '#16804a', fontSize: 11, fontWeight: '700' },
  stalePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(217,119,6,0.13)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  staleText: { color: '#b45f06', fontSize: 11, fontWeight: '700' },
  details: { paddingHorizontal: 11, paddingBottom: 11, gap: 6 },
  detailText: { color: colors.subtext, fontSize: 12, lineHeight: 17 },
  sourceLink: { color: colors.primaryFrom, fontSize: 12, fontWeight: '700' },
});
