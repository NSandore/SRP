import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RenderHTML from 'react-native-render-html';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { createReply, fetchPosts, fetchThread, votePost } from '@/lib/api/thread';
import type { PostData, ThreadData } from '@/lib/api/thread';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc, normalizeHtml } from '@/lib/uploads';
import { timeAgo, hasMeaningfulUpdate } from '@/lib/utils/time';
import { getTagStyle } from '@/lib/utils/tags';

const REPLY_SORT_OPTIONS = [
  { key: 'mostRecent', label: 'Sort by Newest' },
  { key: 'mostUpvoted', label: 'Most Upvoted' },
  { key: 'mostPopular', label: 'Most Popular' },
] as const;

type ReplySort = (typeof REPLY_SORT_OPTIONS)[number]['key'];

type PostNode = PostData & { children: PostNode[]; hasVerified?: boolean };

function buildReplyTree(posts: PostData[]) {
  const map: Record<string, PostNode> = {};
  posts.forEach((p) => {
    map[p.post_id] = { ...p, children: [] };
  });
  const roots: PostNode[] = [];
  posts.forEach((p) => {
    if (p.reply_to && map[p.reply_to]) {
      map[p.reply_to].children.push(map[p.post_id]);
    } else {
      roots.push(map[p.post_id]);
    }
  });

  const markVerified = (node: PostNode): boolean => {
    let verified = Number(node.verified) === 1;
    node.children.forEach((child) => {
      verified = markVerified(child) || verified;
    });
    node.hasVerified = verified;
    return verified;
  };

  roots.forEach(markVerified);
  return roots;
}

function sortReplyNodes(nodes: PostNode[], criteria: ReplySort): PostNode[] {
  const verifiedNodes = nodes.filter((n) => Number(n.hasVerified));
  const nonVerifiedNodes = nodes.filter((n) => !n.hasVerified);

  const sortFn = (a: PostNode, b: PostNode) => {
    switch (criteria) {
      case 'mostUpvoted':
        return (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0);
      case 'mostPopular':
        return (Number(b.upvotes) + Number(b.downvotes) || 0) - (Number(a.upvotes) + Number(a.downvotes) || 0);
      case 'mostRecent':
      default:
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
  };

  verifiedNodes.sort(sortFn);
  nonVerifiedNodes.sort(sortFn);

  const sorted = [...verifiedNodes, ...nonVerifiedNodes];
  sorted.forEach((node) => {
    if (node.children.length > 0) {
      node.children = sortReplyNodes(node.children, criteria);
    }
  });
  return sorted;
}

function countReplies(nodes: PostNode[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countReplies(node.children), 0);
}

function applyVote(post: PostData, voteType: 'up' | 'down') {
  let upvotes = Number(post.upvotes) || 0;
  let downvotes = Number(post.downvotes) || 0;
  let userVote = post.user_vote || null;
  if (userVote === voteType) {
    if (voteType === 'up') upvotes -= 1;
    else downvotes -= 1;
    userVote = null;
  } else if (userVote && userVote !== voteType) {
    if (voteType === 'up') {
      upvotes += 1;
      downvotes -= 1;
    } else {
      downvotes += 1;
      upvotes -= 1;
    }
    userVote = voteType;
  } else {
    if (voteType === 'up') upvotes += 1;
    else downvotes += 1;
    userVote = voteType;
  }
  return { ...post, upvotes, downvotes, user_vote: userVote };
}

function getVerificationDisclaimer(communityType?: string | number | null) {
  const type = String(communityType || '').toLowerCase();
  const target = type === 'university' ? 'university' : 'community';
  const ambassadorLabel = type === 'university' ? 'school ambassador' : 'community ambassador';
  return `This post has been verified correct by a ${ambassadorLabel}. Information may have changed since the time of posting, so it is always best to check with the ${target} directly.`;
}

function getDisplayName(author: PostData, viewerId?: string | number | null) {
  const first = author?.first_name || 'User';
  const last = author?.last_name || '';
  const isSelf = viewerId && String(viewerId) === String(author?.user_id);
  const isConnection = Number(author?.is_connection) === 1;
  const showFullLast = Boolean(isSelf || isConnection);
  const lastPortion = last ? (showFullLast ? last : `${last.charAt(0)}.`) : '';
  return `${first}${lastPortion ? ` ${lastPortion}` : ''}`;
}

export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId?: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const { width, height } = useWindowDimensions();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [thread, setThread] = useState<ThreadData | null>(null);
  const [originalPost, setOriginalPost] = useState<PostData | null>(null);
  const [postTree, setPostTree] = useState<PostNode[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [replySort, setReplySort] = useState<ReplySort>('mostRecent');
  const [showReplySort, setShowReplySort] = useState(false);
  const [replySortAnchor, setReplySortAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [collapsedReplies, setCollapsedReplies] = useState<Record<string, boolean>>({});
  const [rootReplyOpen, setRootReplyOpen] = useState(false);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [postSavedMap, setPostSavedMap] = useState<Record<string, boolean>>({});
  const [menuOverlay, setMenuOverlay] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ambassadorCommunities, setAmbassadorCommunities] = useState<
    { community_id: string; name: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const totalReplies = useMemo(() => countReplies(postTree), [postTree]);

  useEffect(() => {
    if (!threadId) return;
    setIsLoadingThread(true);
    fetchThread(String(threadId), user?.user_id)
      .then((data) => setThread(data))
      .catch(() => setError('Failed to load thread details.'))
      .finally(() => setIsLoadingThread(false));
  }, [threadId, user?.user_id]);

  const loadPosts = () => {
    if (!threadId) return;
    setIsLoadingPosts(true);
    fetchPosts(String(threadId), user?.user_id)
      .then((data) => {
        const normalized = data.map((post) => ({
          ...post,
          upvotes: Number(post.upvotes) || 0,
          downvotes: Number(post.downvotes) || 0,
          verified: Number(post.verified) || 0,
          user_vote: post.user_vote || null,
        }));
        const rootCandidates = normalized.filter((p) => !p.reply_to);
        rootCandidates.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        const op = rootCandidates[0] || null;
        setOriginalPost(op);
        const repliesSource = op ? normalized.filter((p) => p.post_id !== op.post_id) : normalized;
        const tree = sortReplyNodes(buildReplyTree(repliesSource), replySort);
        setPostTree(tree);
      })
      .catch(() => setError('Failed to load posts.'))
      .finally(() => setIsLoadingPosts(false));
  };

  useEffect(() => {
    loadPosts();
  }, [threadId, user?.user_id]);

  useEffect(() => {
    setPostTree((prev) => sortReplyNodes([...prev], replySort));
  }, [replySort]);

  useEffect(() => {
    if (!user?.user_id) {
      setAmbassadorCommunities([]);
      return;
    }
    apiClient
      .get('/fetch_ambassador_communities.php', { params: { user_id: user.user_id } })
      .then((res) => {
        const list = (res.data as any)?.communities || [];
        setAmbassadorCommunities(
          Array.isArray(list)
            ? list.map((c) => ({
                community_id: String(c.community_id ?? c.id ?? ''),
                name: String(c.name ?? 'Community'),
              }))
            : []
        );
      })
      .catch(() => setAmbassadorCommunities([]));
  }, [user?.user_id]);

  useEffect(() => {
    if (!openPostMenuId || !user?.user_id) return;
    apiClient
      .get('/save_check.php', {
        params: { user_id: user.user_id, item_type: 'post', item_id: openPostMenuId },
      })
      .then((res) => {
        const saved = Boolean((res.data as any)?.saved ?? (res.data as any)?.is_saved);
        setPostSavedMap((prev) => ({ ...prev, [openPostMenuId]: saved }));
      })
      .catch(() => {
        setPostSavedMap((prev) => ({ ...prev, [openPostMenuId]: false }));
      });
  }, [openPostMenuId, user?.user_id]);

  const handleVote = async (postId: string, voteType: 'up' | 'down') => {
    if (!user?.user_id) {
      openLockedFeature('Voting');
      return;
    }
    try {
      await votePost(postId, user.user_id, voteType);
      if (originalPost && originalPost.post_id === postId) {
        setOriginalPost((prev) => (prev ? applyVote(prev, voteType) : prev));
        return;
      }
      const updateNode = (nodes: PostNode[]): PostNode[] =>
        nodes.map((node) => {
          if (node.post_id === postId) {
            return applyVote(node, voteType) as PostNode;
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      setPostTree((prev) => updateNode(prev));
    } catch {
      setError('Unable to update vote.');
    }
  };

  const handleSubmitReply = async (replyTo: string | null) => {
    if (!threadId) return;
    if (!user?.user_id) {
      openLockedFeature('Replying');
      return;
    }
    const draftKey = replyTo ?? 'root';
    const content = (replyDrafts[draftKey] || '').trim();
    if (!content) return;
    try {
      await createReply(String(threadId), user.user_id, content, replyTo ?? undefined);
      setReplyDrafts((prev) => ({ ...prev, [draftKey]: '' }));
      setActiveReplyId(null);
      if (!replyTo) setRootReplyOpen(false);
      loadPosts();
    } catch {
      setError('Unable to submit reply.');
    }
  };

  const renderPost = (post: PostNode, depth = 0) => {
    const isCollapsed = collapsedReplies[post.post_id];
    const childCount = countReplies(post.children);
    const hasUpvoted = post.user_vote === 'up';
    const hasDownvoted = post.user_vote === 'down';
    const draftKey = post.post_id;

    return (
      <View key={post.post_id} style={[styles.postCard, { marginLeft: depth * 14 }]}> 
        {Number(post.verified) === 1 ? (
          <View style={styles.verifiedBanner}>
            <MaterialCommunityIcons name="check-decagram" size={18} color="#1b5e20" />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.verifiedTitle}>Verified Correct</ThemedText>
              {post.verified_at ? (
                <ThemedText style={styles.verifiedDate}>Verified {timeAgo(post.verified_at)}</ThemedText>
              ) : null}
              <ThemedText style={styles.verifiedDisclaimer}>
                {getVerificationDisclaimer(thread?.community_type)}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.postHeader}>
          <Image source={{ uri: buildAvatarSrc(post.avatar_path) }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Pressable onPress={() => router.push(`/user/${post.user_id}`)} style={styles.authorLink}>
              <ThemedText style={styles.authorName}>{getDisplayName(post, user?.user_id)}</ThemedText>
            </Pressable>
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaText}>{timeAgo(post.created_at)}</ThemedText>
              {post.user_role ? <ThemedText style={styles.metaText}>· {post.user_role}</ThemedText> : null}
            </View>
            {hasMeaningfulUpdate(post.created_at, post.updated_at) ? (
              <ThemedText style={styles.metaText}>Edited {timeAgo(post.updated_at)}</ThemedText>
            ) : null}
          </View>
          <Pressable
            style={styles.kebabButton}
            onPress={(event) => {
              event.stopPropagation();
              const nextId = post.post_id;
              const nextOpen = openPostMenuId !== nextId;
              setOpenPostMenuId(nextOpen ? nextId : null);
              setMenuOverlay(
                nextOpen
                  ? { id: nextId, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }
                  : null
              );
            }}
            accessibilityLabel="Post menu"
          >
            <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.subtext} />
          </Pressable>
        </View>

        <RenderHTML
          contentWidth={width - 48}
          source={{ html: normalizeHtml(post.content || '') }}
          baseStyle={styles.postContent}
        />

        <View style={styles.voteRow}>
          <Pressable onPress={() => handleVote(post.post_id, 'up')} style={styles.voteButton}>
            <MaterialCommunityIcons
              name={hasUpvoted ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
              size={20}
              color={hasUpvoted ? '#16a34a' : colors.subtext}
            />
          </Pressable>
          <ThemedText style={styles.voteCount}>{Number(post.upvotes) || 0}</ThemedText>
          <Pressable onPress={() => handleVote(post.post_id, 'down')} style={styles.voteButton}>
            <MaterialCommunityIcons
              name={hasDownvoted ? 'arrow-down-bold' : 'arrow-down-bold-outline'}
              size={20}
              color={hasDownvoted ? '#dc2626' : colors.subtext}
            />
          </Pressable>
          <ThemedText style={styles.voteCount}>{Number(post.downvotes) || 0}</ThemedText>

          <Pressable
            onPress={() => setActiveReplyId(activeReplyId === post.post_id ? null : post.post_id)}
            style={styles.replyButton}
          >
            <MaterialCommunityIcons name="message-outline" size={18} color={colors.subtext} />
          </Pressable>
          <ThemedText style={styles.voteCount}>{childCount}</ThemedText>

          <Pressable
            onPress={() => setError('Reporting is not available yet on mobile.')}
            style={styles.reportButton}
          >
            <ThemedText style={styles.reportText}>Report</ThemedText>
          </Pressable>

          {post.children.length > 0 ? (
            <Pressable
              onPress={() =>
                setCollapsedReplies((prev) => ({ ...prev, [post.post_id]: !prev[post.post_id] }))
              }
              style={styles.collapseButton}
            >
              <MaterialCommunityIcons
                name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                size={18}
                color={colors.subtext}
              />
              <ThemedText style={styles.collapseText}>{isCollapsed ? 'Show Replies' : 'Hide Replies'}</ThemedText>
            </Pressable>
          ) : null}
        </View>

        {activeReplyId === post.post_id ? (
          <View style={styles.replyBox}>
            <TextInput
              style={styles.replyInput}
              placeholder="Write a reply..."
              value={replyDrafts[draftKey] || ''}
              onChangeText={(text) => setReplyDrafts((prev) => ({ ...prev, [draftKey]: text }))}
              multiline
            />
            <View style={styles.replyActions}>
              <Pressable style={styles.replyAction} onPress={() => handleSubmitReply(post.post_id)}>
                <ThemedText style={styles.replyActionText}>Submit</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.replyAction, styles.replyActionSecondary]}
                onPress={() => setActiveReplyId(null)}
              >
                <ThemedText style={styles.replySecondaryText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isCollapsed && post.children.length > 0 ? (
          <View style={styles.replyList}>
            {post.children.map((child) => renderPost(child, depth + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  const postLookup = useMemo(() => {
    const map = new Map<string, PostNode>();
    if (originalPost) {
      map.set(originalPost.post_id, { ...originalPost, children: postTree } as PostNode);
    }
    const walk = (nodes: PostNode[]) => {
      nodes.forEach((node) => {
        map.set(node.post_id, node);
        if (node.children?.length) walk(node.children);
      });
    };
    walk(postTree);
    return map;
  }, [originalPost, postTree]);

  const canVerifyPosts = useMemo(() => {
    if (!user?.user_id) return false;
    const communityId = String(thread?.community_id ?? '');
    if (!communityId) return false;
    if (isSuperAdmin(user.role_id)) return true;
    if (Array.isArray(user.admin_community_ids) && user.admin_community_ids.includes(communityId)) return true;
    return ambassadorCommunities.some((c) => String(c.community_id) === communityId);
  }, [user?.user_id, user?.role_id, user?.admin_community_ids, thread?.community_id, ambassadorCommunities]);

  if (isLoadingThread || isLoadingPosts) {
    return (
      <AppShell>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <View style={styles.breadcrumbs}>
          <Pressable onPress={() => router.push('/info')}>
            <ThemedText style={styles.breadcrumbText}>Info Board</ThemedText>
          </Pressable>
          <ThemedText style={styles.breadcrumbSep}>/</ThemedText>
          {thread?.forum_id ? (
            <Pressable onPress={() => router.push(`/info/forum/${thread.forum_id}`)}>
              <ThemedText style={styles.breadcrumbText}>{thread?.forum_name || 'Category'}</ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={styles.breadcrumbText}>{thread?.forum_name || 'Category'}</ThemedText>
          )}
        </View>

        <ThemedText type="title" style={styles.threadTitle}>
          {thread?.title || `Thread ${threadId}`}
        </ThemedText>

        {thread?.tags && thread.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {thread.tags.map((tag) => {
              const tagStyle = getTagStyle(tag);
              return (
                <View
                  key={tag}
                  style={[
                    styles.tagChip,
                    { borderColor: tagStyle.borderColor, backgroundColor: tagStyle.backgroundColor },
                  ]}
                >
                  <ThemedText style={[styles.tagText, { color: tagStyle.color }]}>{tag}</ThemedText>
                </View>
              );
            })}
          </View>
        ) : null}

        {hasMeaningfulUpdate(thread?.created_at, thread?.updated_at) ? (
          <ThemedText style={styles.metaText}>
            Last updated {timeAgo(thread?.updated_at)}
            {thread?.updated_by_first_name ? ` by ${thread.updated_by_first_name} ${thread.updated_by_last_name || ''}` : ''}
          </ThemedText>
        ) : null}

        {originalPost ? (
          <View style={styles.threadCard}>
            {Number(originalPost.verified) === 1 ? (
              <View style={styles.verifiedBanner}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#1b5e20" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.verifiedTitle}>Verified Correct</ThemedText>
                  {originalPost.verified_at ? (
                    <ThemedText style={styles.verifiedDate}>Verified {timeAgo(originalPost.verified_at)}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.verifiedDisclaimer}>
                    {getVerificationDisclaimer(thread?.community_type)}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View style={styles.postHeader}>
              <Image source={{ uri: buildAvatarSrc(originalPost.avatar_path) }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => router.push(`/user/${originalPost.user_id}`)} style={styles.authorLink}>
                  <ThemedText style={styles.authorName}>{getDisplayName(originalPost, user?.user_id)}</ThemedText>
                </Pressable>
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaText}>{timeAgo(originalPost.created_at)}</ThemedText>
                  {originalPost.user_role ? <ThemedText style={styles.metaText}>· {originalPost.user_role}</ThemedText> : null}
                </View>
                {hasMeaningfulUpdate(originalPost.created_at, originalPost.updated_at) ? (
                  <ThemedText style={styles.metaText}>Edited {timeAgo(originalPost.updated_at)}</ThemedText>
                ) : null}
              </View>
            </View>

            <RenderHTML
              contentWidth={width - 48}
              source={{ html: normalizeHtml(originalPost.content || '') }}
              baseStyle={styles.postContent}
            />

            <View style={styles.voteRow}>
              <Pressable onPress={() => handleVote(originalPost.post_id, 'up')} style={styles.voteButton}>
                <MaterialCommunityIcons
                  name={originalPost.user_vote === 'up' ? 'arrow-up-bold' : 'arrow-up-bold-outline'}
                  size={20}
                  color={originalPost.user_vote === 'up' ? '#16a34a' : colors.subtext}
                />
              </Pressable>
              <ThemedText style={styles.voteCount}>{Number(originalPost.upvotes) || 0}</ThemedText>
              <Pressable onPress={() => handleVote(originalPost.post_id, 'down')} style={styles.voteButton}>
                <MaterialCommunityIcons
                  name={originalPost.user_vote === 'down' ? 'arrow-down-bold' : 'arrow-down-bold-outline'}
                  size={20}
                  color={originalPost.user_vote === 'down' ? '#dc2626' : colors.subtext}
                />
              </Pressable>
              <ThemedText style={styles.voteCount}>{Number(originalPost.downvotes) || 0}</ThemedText>

              <Pressable onPress={() => setRootReplyOpen(true)} style={styles.replyButton}>
                <MaterialCommunityIcons name="message-outline" size={18} color={colors.subtext} />
              </Pressable>
              <ThemedText style={styles.voteCount}>{totalReplies}</ThemedText>

              <Pressable
                onPress={() => setError('Reporting is not available yet on mobile.')}
                style={styles.reportButton}
              >
                <ThemedText style={styles.reportText}>Report</ThemedText>
              </Pressable>
            </View>

            {rootReplyOpen ? (
              <View style={styles.replyForm}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Share your thoughts..."
                  value={replyDrafts.root || ''}
                  onChangeText={(text) => setReplyDrafts((prev) => ({ ...prev, root: text }))}
                  multiline
                />
                <View style={styles.replyActions}>
                  <Pressable style={styles.replyAction} onPress={() => handleSubmitReply(null)}>
                    <ThemedText style={styles.replyActionText}>Submit</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.replyAction, styles.replyActionSecondary]}
                    onPress={() => setRootReplyOpen(false)}
                  >
                    <ThemedText style={styles.replySecondaryText}>Cancel</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.threadDivider} />
          </View>
        ) : null}

        <View style={styles.sortRow}>
          <ThemedText style={styles.sortLabel}>Sort replies:</ThemedText>
          <View style={styles.dropdownAnchor}>
            <Pressable
              style={styles.sortDropdown}
              onPress={(event) => {
                setShowReplySort((prev) => !prev);
                setReplySortAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
              }}
            >
              <ThemedText style={styles.sortDropdownLabel}>
                {REPLY_SORT_OPTIONS.find((opt) => opt.key === replySort)?.label || 'Sort by Newest'}
              </ThemedText>
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.subtext} />
            </Pressable>
          </View>
        </View>

        {postTree.length === 0 ? (
          <ThemedText style={styles.helper}>No replies yet. Be the first to respond.</ThemedText>
        ) : null}

        {postTree.map((post) => renderPost(post))}
      </ScrollView>

      {menuOverlay ? (
        <View style={styles.menuOverlayRoot} pointerEvents="box-none">
          <Pressable
            style={styles.menuOverlayBackdrop}
            onPress={() => {
              setMenuOverlay(null);
              setOpenPostMenuId(null);
            }}
          />
          <View
            style={[
              styles.menuOverlayCard,
              (() => {
                const menuWidth = 220;
                const left = Math.min(
                  Math.max(12, menuOverlay.x - menuWidth + 24),
                  width - menuWidth - 12
                );
                const top = Math.min(menuOverlay.y + 8, height - 260);
                return { left, top, width: menuWidth };
              })(),
            ]}
          >
            {(() => {
              const post = postLookup.get(menuOverlay.id);
              if (!post) return null;
              const reportType = post.reply_to ? 'comment' : 'post';
              const isSaved = Boolean(postSavedMap[post.post_id]);
              const canUnverifyOwn =
                Number(post.verified) === 1 &&
                String(post.verified_by || '') === String(user?.user_id || '');
              return (
                <>
                  {user?.user_id ? (
                    <Pressable
                      style={styles.menuItem}
                      onPress={async () => {
                        try {
                          await apiClient.post(isSaved ? '/unsave_post.php' : '/save_post.php', {
                            user_id: user.user_id,
                            post_id: post.post_id,
                          });
                          setPostSavedMap((prev) => ({ ...prev, [post.post_id]: !isSaved }));
                          setMenuOverlay(null);
                          setOpenPostMenuId(null);
                        } catch {
                          setError('Unable to update saved post.');
                        }
                      }}
                    >
                      <ThemedText style={styles.menuText}>{isSaved ? 'Unsave' : 'Save'}</ThemedText>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={styles.menuItem}
                    onPress={async () => {
                      if (!user?.user_id) {
                        setMenuOverlay(null);
                        setOpenPostMenuId(null);
                        openLockedFeature('Reporting');
                        return;
                      }
                      try {
                        await apiClient.post('/submit_report.php', {
                          item_type: reportType,
                          item_id: post.post_id,
                          reason_code: 'other',
                          reason_text: 'Reported from mobile',
                        });
                        setMenuOverlay(null);
                        setOpenPostMenuId(null);
                      } catch {
                        setError('Unable to submit report.');
                      }
                    }}
                  >
                    <ThemedText style={styles.menuText}>
                      Report {reportType === 'comment' ? 'comment' : 'post'}
                    </ThemedText>
                  </Pressable>

                  {canVerifyPosts && Number(post.verified) !== 1 ? (
                    <Pressable
                      style={styles.menuItem}
                      onPress={async () => {
                        try {
                          await apiClient.post('/verify_post.php', { post_id: post.post_id });
                          setMenuOverlay(null);
                          setOpenPostMenuId(null);
                          loadPosts();
                        } catch {
                          setError('Unable to verify post.');
                        }
                      }}
                    >
                      <ThemedText style={styles.menuText}>Verify answer</ThemedText>
                    </Pressable>
                  ) : null}

                  {canUnverifyOwn ? (
                    <Pressable
                      style={styles.menuItem}
                      onPress={async () => {
                        try {
                          await apiClient.post('/unverify_post.php', { post_id: post.post_id });
                          setMenuOverlay(null);
                          setOpenPostMenuId(null);
                          loadPosts();
                        } catch {
                          setError('Unable to unverify post.');
                        }
                      }}
                    >
                      <ThemedText style={styles.menuText}>Unverify answer</ThemedText>
                    </Pressable>
                  ) : null}
                </>
              );
            })()}
          </View>
        </View>
      ) : null}
      {showReplySort ? (
        <View style={styles.menuOverlayRoot} pointerEvents="box-none">
          <Pressable style={styles.menuOverlayBackdrop} onPress={() => setShowReplySort(false)} />
          <View
            style={[
              styles.menuOverlayCard,
              (() => {
                const menuWidth = 220;
                const left = Math.min(
                  Math.max(12, (replySortAnchor?.x ?? 24) - menuWidth + 24),
                  width - menuWidth - 12
                );
                const top = Math.min((replySortAnchor?.y ?? 220) + 8, height - 260);
                return { left, top, width: menuWidth };
              })(),
            ]}
          >
            {REPLY_SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setReplySort(opt.key);
                  setShowReplySort(false);
                }}
                style={styles.menuItem}
              >
                <MaterialCommunityIcons
                  name={replySort === opt.key ? 'radiobox-marked' : 'radiobox-blank'}
                  size={16}
                  color={colors.primaryFrom}
                />
                <ThemedText style={styles.menuText}>{opt.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      </View>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: Brand.spacing.lg,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.danger,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbText: {
    fontSize: 12,
    color: colors.subtext,
  },
  breadcrumbSep: {
    color: colors.subtext,
  },
  threadTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadCard: {
    backgroundColor: colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  postHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  kebabButton: {
    padding: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: hexToRgba(colors.subtext, 0.2),
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  authorLink: {
    alignSelf: 'flex-start',
  },
  postContent: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  voteButton: {
    padding: 4,
  },
  voteCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    minWidth: 18,
  },
  replyButton: {
    marginLeft: 4,
    padding: 4,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.04),
  },
  collapseText: {
    fontSize: 12,
    color: colors.subtext,
  },
  replyList: {
    marginTop: 8,
    gap: 8,
  },
  replyBox: {
    gap: 8,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.card,
  },
  replyActions: {
    flexDirection: 'row',
    gap: 10,
  },
  replyAction: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  replyActionSecondary: {
    backgroundColor: hexToRgba(colors.text, 0.08),
  },
  replyActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  replySecondaryText: {
    color: colors.text,
    fontWeight: '600',
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  verifiedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1b5e20',
  },
  verifiedDate: {
    fontSize: 12,
    color: '#2f9e44',
  },
  verifiedDisclaimer: {
    fontSize: 12,
    color: colors.subtext,
    lineHeight: 16,
  },
  reportButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  reportText: {
    fontSize: 12,
    color: colors.subtext,
    fontWeight: '600',
  },
  replyForm: {
    gap: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sortRow: {
    gap: 8,
  },
  dropdownAnchor: {
    position: 'relative',
    zIndex: 20,
  },
  threadDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  sortLabel: {
    fontSize: 12,
    color: colors.subtext,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sortDropdownLabel: {
    fontSize: 12,
    color: colors.subtext,
  },
  helper: {
    color: colors.subtext,
  },
  menuOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  menuOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  menuOverlayCard: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  menuText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
});
