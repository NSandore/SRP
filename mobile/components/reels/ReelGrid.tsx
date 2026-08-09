import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import {
  fetchReels,
  getReelThumbnailUrl,
  type Reel,
} from '@/lib/api/reels';

type ReelGridProps = {
  userId?: string;
  communityId?: string;
  isOwnProfile?: boolean;
  title?: string;
};

export default function ReelGrid({
  userId,
  communityId,
  isOwnProfile = false,
  title = 'Reels',
}: ReelGridProps) {
  const router = useRouter();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
    fetchReels({
      scope: 'feed',
      userId,
      communityId,
      limit: 18,
    })
      .then((result) => {
        if (mounted) setReels(result.reels);
      })
      .catch((reason) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load reels.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [communityId, userId]);

  const introReel = reels.find((reel) => reel.is_intro);

  const openReel = (reelId: string) => {
    router.push({
      pathname: '/reels',
      params: {
        reelId,
        userId: userId || undefined,
        communityId: communityId || undefined,
      },
    } as never);
  };

  const openComposer = (intro: boolean) => {
    router.push({
      pathname: '/reels',
      params: {
        compose: '1',
        intro: intro ? '1' : undefined,
        communityId: communityId || undefined,
      },
    } as never);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.subtitle}>
            {reels.length > 0
              ? `${reels.length} short ${reels.length === 1 ? 'video' : 'videos'}`
              : 'Short videos from this profile'}
          </ThemedText>
        </View>
        {isOwnProfile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a reel"
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
            onPress={() => openComposer(false)}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <ThemedText style={styles.createButtonText}>Create</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {isOwnProfile || introReel ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.introCard, pressed && styles.pressed]}
          onPress={() => introReel ? openReel(introReel.reel_id) : openComposer(true)}
        >
          <View style={styles.introIcon}>
            <MaterialCommunityIcons
              name={introReel ? 'play-circle' : 'account-voice'}
              size={22}
              color={colors.primaryFrom}
            />
          </View>
          <View style={styles.introCopy}>
            <ThemedText style={styles.introTitle}>
              {introReel
                ? isOwnProfile
                  ? 'Your intro video'
                  : 'Profile intro'
                : 'Add an intro video'}
            </ThemedText>
            <ThemedText style={styles.introText}>
              {introReel
                ? isOwnProfile
                  ? 'Give visitors a quick sense of what you are about.'
                  : 'Play a quick introduction from this creator.'
                : 'Introduce yourself in 60 seconds or less.'}
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.subtext} />
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primaryFrom} />
          <ThemedText style={styles.stateText}>Loading reels…</ThemedText>
        </View>
      ) : null}

      {!isLoading && error ? (
        <View style={styles.state}>
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.danger} />
          <ThemedText style={styles.stateText}>{error}</ThemedText>
        </View>
      ) : null}

      {!isLoading && !error && reels.length === 0 ? (
        <Pressable
          disabled={!isOwnProfile}
          style={({ pressed }) => [styles.emptyState, pressed && isOwnProfile && styles.pressed]}
          onPress={() => openComposer(false)}
        >
          <MaterialCommunityIcons name="movie-open-outline" size={28} color={colors.subtext} />
          <ThemedText style={styles.emptyTitle}>No reels yet</ThemedText>
          <ThemedText style={styles.stateText}>
            {isOwnProfile ? 'Share the first short video from your profile.' : 'Check back soon.'}
          </ThemedText>
        </Pressable>
      ) : null}

      {!isLoading && !error && reels.length > 0 ? (
        <View style={styles.grid}>
          {reels.map((reel) => {
            const thumbnail = getReelThumbnailUrl(reel);
            return (
              <Pressable
                key={reel.reel_id}
                accessibilityRole="button"
                accessibilityLabel={`Open reel${reel.caption ? `: ${reel.caption}` : ''}`}
                onPress={() => openReel(reel.reel_id)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                {thumbnail ? (
                  <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={[colors.primaryFrom, colors.primaryTo]}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(2, 6, 23, 0.78)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.badges}>
                  {reel.is_intro ? (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>Intro</ThemedText>
                    </View>
                  ) : null}
                  {reel.is_featured ? (
                    <View style={[styles.badge, styles.featuredBadge]}>
                      <MaterialCommunityIcons name="star" size={10} color="#FDE68A" />
                      <ThemedText style={styles.badgeText}>Featured</ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.tileFooter}>
                  <MaterialCommunityIcons name="play" size={16} color="#fff" />
                  <ThemedText style={styles.tileCount}>{reel.like_count}</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
    section: {
      gap: Brand.spacing.lg,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Brand.spacing.md,
    },
    headingCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.subtext,
      fontSize: 13,
    },
    createButton: {
      minHeight: 38,
      borderRadius: Brand.radius.pill,
      paddingHorizontal: 14,
      backgroundColor: colors.primaryFrom,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    createButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    pressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.92,
    },
    introCard: {
      minHeight: 72,
      padding: Brand.spacing.md,
      borderWidth: 1,
      borderColor: hexToRgba(colors.primaryFrom, 0.3),
      backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
      borderRadius: Brand.radius.card,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Brand.spacing.md,
    },
    introIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    introCopy: {
      flex: 1,
      gap: 2,
    },
    introTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    introText: {
      color: colors.subtext,
      fontSize: 12,
      lineHeight: 17,
    },
    state: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Brand.radius.card,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Brand.spacing.xl,
      gap: Brand.spacing.sm,
      backgroundColor: colors.card,
    },
    emptyState: {
      minHeight: 150,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: Brand.radius.card,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Brand.spacing.xl,
      gap: 6,
      backgroundColor: colors.card,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    stateText: {
      color: colors.subtext,
      fontSize: 13,
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tile: {
      width: '31.9%',
      aspectRatio: 9 / 16,
      minHeight: 130,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#0F172A',
      borderWidth: 1,
      borderColor: colors.border,
    },
    badges: {
      position: 'absolute',
      top: 7,
      left: 7,
      right: 7,
      alignItems: 'flex-start',
      gap: 4,
    },
    badge: {
      minHeight: 20,
      borderRadius: Brand.radius.pill,
      paddingHorizontal: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
    },
    featuredBadge: {
      backgroundColor: 'rgba(124, 45, 18, 0.84)',
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
    tileFooter: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    tileCount: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
  });
