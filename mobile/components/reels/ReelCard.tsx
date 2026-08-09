import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/brand';
import {
  getReelThumbnailUrl,
  getReelVideoUrl,
  type Reel,
} from '@/lib/api/reels';
import { buildAvatarSrc } from '@/lib/uploads';

type ReelCardProps = {
  reel: Reel;
  height: number;
  isActive: boolean;
  sessionId?: string | null;
  canPin: boolean;
  onToggleLike: (reel: Reel) => void;
  onToggleSave: (reel: Reel) => void;
  onOpenComments: (reel: Reel) => void;
  onTogglePin: (reel: Reel) => void;
  onOpenCreator: (reel: Reel) => void;
  onOpenCommunity: (reel: Reel) => void;
  onOpenMenu: (reel: Reel) => void;
};

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
};

function ActionButton({
  icon,
  activeIcon,
  active,
  count,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  activeIcon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  active?: boolean;
  count?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.actionIcon, active && styles.actionIconActive]}>
        <MaterialCommunityIcons
          name={active && activeIcon ? activeIcon : icon}
          size={25}
          color={active ? '#FDE68A' : '#fff'}
        />
      </View>
      {count !== undefined ? (
        <ThemedText style={styles.actionCount}>{formatCount(count)}</ThemedText>
      ) : null}
    </Pressable>
  );
}

export default function ReelCard({
  reel,
  height,
  isActive,
  sessionId,
  canPin,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onTogglePin,
  onOpenCreator,
  onOpenCommunity,
  onOpenMenu,
}: ReelCardProps) {
  const videoUrl = getReelVideoUrl(reel);
  const thumbnailUrl = getReelThumbnailUrl(reel);
  const [muted, setMuted] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);

  const source = useMemo(
    () => ({
      uri: videoUrl,
      headers: sessionId ? { 'X-Session-Id': sessionId } : undefined,
      useCaching: true,
      contentType: 'progressive' as const,
      metadata: {
        title: reel.caption || 'StudentSphere Reel',
        artist:
          reel.creator_name ||
          [reel.creator_first_name, reel.creator_last_name].filter(Boolean).join(' ') ||
          'StudentSphere',
        artwork: thumbnailUrl || undefined,
      },
    }),
    [
      reel.caption,
      reel.creator_first_name,
      reel.creator_last_name,
      reel.creator_name,
      sessionId,
      thumbnailUrl,
      videoUrl,
    ]
  );

  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.audioMixingMode = 'duckOthers';
    instance.staysActiveInBackground = false;
    instance.keepScreenOnWhilePlaying = true;
  });
  const status = useEvent(player, 'statusChange', { status: player.status });
  const playback = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!isActive) {
      player.pause();
      setManuallyPaused(false);
      return;
    }
    if (!manuallyPaused && videoUrl) {
      player.play();
    }
  }, [isActive, manuallyPaused, player, videoUrl]);

  const togglePlayback = () => {
    if (playback.isPlaying) {
      player.pause();
      setManuallyPaused(true);
    } else {
      player.play();
      setManuallyPaused(false);
    }
  };

  const creatorName =
    reel.creator_name ||
    [reel.creator_first_name, reel.creator_last_name].filter(Boolean).join(' ') ||
    'StudentSphere creator';

  return (
    <View style={[styles.card, { height }]}>
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}

      {videoUrl ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          nativeControls={false}
          contentFit={reel.is_intro ? 'contain' : 'cover'}
          playsInline
          allowsFullscreen
          surfaceType="textureView"
        />
      ) : (
        <View style={styles.unavailable}>
          <MaterialCommunityIcons name="video-off-outline" size={34} color="#CBD5E1" />
          <ThemedText style={styles.unavailableText}>Video is still processing</ThemedText>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playback.isPlaying ? 'Pause reel' : 'Play reel'}
        style={StyleSheet.absoluteFillObject}
        onPress={togglePlayback}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(2, 6, 23, 0.24)', 'transparent', 'rgba(2, 6, 23, 0.9)']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.topRow} pointerEvents="box-none">
        <View style={styles.topBadges}>
          {reel.is_featured ? (
            <View style={[styles.badge, styles.featuredBadge]}>
              <MaterialCommunityIcons name="star" size={12} color="#FDE68A" />
              <ThemedText style={styles.badgeText}>Featured</ThemedText>
            </View>
          ) : null}
          {reel.is_intro ? (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>Intro</ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute reel' : 'Mute reel'}
          onPress={() => setMuted((value) => !value)}
          style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name={muted ? 'volume-off' : 'volume-high'}
            size={20}
            color="#fff"
          />
        </Pressable>
      </View>

      {isActive && status.status === 'loading' ? (
        <View style={styles.centerState} pointerEvents="none">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      {isActive && manuallyPaused ? (
        <View style={styles.centerState} pointerEvents="none">
          <View style={styles.playIndicator}>
            <MaterialCommunityIcons name="play" size={34} color="#fff" />
          </View>
        </View>
      ) : null}

      {isActive && status.status === 'error' ? (
        <View style={styles.errorState} pointerEvents="none">
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#fff" />
          <ThemedText style={styles.errorText}>
            {status.error?.message || 'This reel could not be played.'}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.bottomContent} pointerEvents="box-none">
        <View style={styles.copyColumn}>
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenCreator(reel)}
            style={({ pressed }) => [styles.creatorRow, pressed && styles.pressed]}
          >
            <Image
              source={{ uri: buildAvatarSrc(reel.creator_avatar_path) }}
              style={styles.avatar}
            />
            <ThemedText style={styles.creatorName}>{creatorName}</ThemedText>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#E2E8F0" />
          </Pressable>

          {reel.community_id && reel.community_name ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => onOpenCommunity(reel)}
              style={({ pressed }) => [styles.communityLink, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="account-group-outline" size={15} color="#BFDBFE" />
              <ThemedText style={styles.communityText}>{reel.community_name}</ThemedText>
            </Pressable>
          ) : null}

          {reel.caption ? (
            <ThemedText style={styles.caption} numberOfLines={3}>
              {reel.caption}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.actionRail}>
          <ActionButton
            icon="heart-outline"
            activeIcon="heart"
            active={reel.is_liked}
            count={reel.like_count}
            label={reel.is_liked ? 'Unlike reel' : 'Like reel'}
            onPress={() => onToggleLike(reel)}
          />
          <ActionButton
            icon="comment-outline"
            count={reel.comment_count}
            label="Open comments"
            onPress={() => onOpenComments(reel)}
          />
          <ActionButton
            icon="bookmark-outline"
            activeIcon="bookmark"
            active={reel.is_saved}
            label={reel.is_saved ? 'Remove saved reel' : 'Save reel'}
            onPress={() => onToggleSave(reel)}
          />
          {canPin ? (
            <ActionButton
              icon="pin-outline"
              activeIcon="pin"
              active={reel.is_pinned}
              label={reel.is_pinned ? 'Unpin from community' : 'Pin to community'}
              onPress={() => onTogglePin(reel)}
            />
          ) : null}
          <ActionButton
            icon="dots-horizontal"
            label="More reel actions"
            onPress={() => onOpenMenu(reel)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  unavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Brand.spacing.sm,
    backgroundColor: '#0F172A',
  },
  unavailableText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  topBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    minHeight: 25,
    borderRadius: Brand.radius.pill,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  featuredBadge: {
    backgroundColor: 'rgba(124, 45, 18, 0.82)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  smallButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  centerState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIndicator: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  errorState: {
    position: 'absolute',
    top: '42%',
    left: 24,
    right: 24,
    minHeight: 56,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(127, 29, 29, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#fff',
    fontSize: 12,
    lineHeight: 17,
  },
  bottomContent: {
    position: 'absolute',
    left: 14,
    right: 10,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  copyColumn: {
    flex: 1,
    gap: 8,
    paddingBottom: 2,
  },
  creatorRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#CBD5E1',
  },
  creatorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowRadius: 4,
  },
  communityLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    borderRadius: Brand.radius.pill,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(30, 64, 175, 0.56)',
  },
  communityText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '700',
  },
  caption: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 4,
  },
  actionRail: {
    width: 54,
    alignItems: 'center',
    gap: 12,
  },
  action: {
    width: 54,
    alignItems: 'center',
    gap: 3,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  actionIconActive: {
    backgroundColor: 'rgba(124, 45, 18, 0.68)',
  },
  actionCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowRadius: 3,
  },
});
