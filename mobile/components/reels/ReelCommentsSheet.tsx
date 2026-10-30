import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Brand, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import {
  createReelComment,
  fetchReelComments,
  type Reel,
  type ReelComment,
} from '@/lib/api/reels';
import { buildAvatarSrc } from '@/lib/uploads';
import { timeAgo } from '@/lib/utils/time';

type ReelCommentsSheetProps = {
  reel: Reel | null;
  visible: boolean;
  canComment: boolean;
  onClose: () => void;
  onRequireAuth: () => void;
  onCommentAdded: (reelId: string) => void;
};

export default function ReelCommentsSheet({
  reel,
  visible,
  canComment,
  onClose,
  onRequireAuth,
  onCommentAdded,
}: ReelCommentsSheetProps) {
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!visible || !reel?.reel_id) return;
    let mounted = true;
    setComments([]);
    setCursor(null);
    setError(null);
    setIsLoading(true);
    fetchReelComments(reel.reel_id)
      .then((result) => {
        if (!mounted) return;
        setComments(result.comments);
        setCursor(result.nextCursor);
      })
      .catch((reason) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load comments.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [reel?.reel_id, visible]);

  const loadMore = async () => {
    if (!reel?.reel_id || !cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchReelComments(reel.reel_id, cursor);
      setComments((current) => {
        const known = new Set(current.map((comment) => comment.comment_id));
        return [...current, ...result.comments.filter((comment) => !known.has(comment.comment_id))];
      });
      setCursor(result.nextCursor);
    } catch {
      // Keep the existing discussion visible if pagination fails.
    } finally {
      setIsLoadingMore(false);
    }
  };

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || !reel?.reel_id || isSending) return;
    if (!canComment) {
      onRequireAuth();
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      const comment = await createReelComment(reel.reel_id, trimmed);
      setComments((current) => [comment, ...current]);
      setBody('');
      onCommentAdded(reel.reel_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add your comment.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <ThemedText style={styles.title}>Comments</ThemedText>
              <ThemedText style={styles.subtitle}>
                {reel ? `${reel.comment_count} ${reel.comment_count === 1 ? 'comment' : 'comments'}` : ''}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close comments"
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              onPress={onClose}
            >
              <MaterialCommunityIcons name="close" size={21} color={colors.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.primaryFrom} />
              <ThemedText style={styles.stateText}>Loading discussion…</ThemedText>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.comment_id}
              contentContainerStyle={comments.length ? styles.list : styles.emptyList}
              keyboardShouldPersistTaps="handled"
              onEndReached={loadMore}
              onEndReachedThreshold={0.35}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <MaterialCommunityIcons name="comment-text-outline" size={30} color={colors.subtext} />
                  <ThemedText style={styles.emptyTitle}>Start the conversation</ThemedText>
                  <ThemedText style={styles.stateText}>Be the first to leave a thoughtful comment.</ThemedText>
                </View>
              }
              ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primaryFrom} /> : null}
              renderItem={({ item }) => {
                const authorName =
                  item.creator_name ||
                  [item.first_name, item.last_name].filter(Boolean).join(' ') ||
                  'StudentSphere member';
                return (
                  <View style={styles.comment}>
                    <Image source={{ uri: buildAvatarSrc(item.avatar_path) }} style={styles.avatar} />
                    <View style={styles.commentBody}>
                      <View style={styles.commentMeta}>
                        <ThemedText style={styles.author}>{authorName}</ThemedText>
                        <ThemedText style={styles.timestamp}>{timeAgo(item.created_at || undefined)}</ThemedText>
                      </View>
                      <ThemedText style={styles.commentText}>{item.body}</ThemedText>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {error ? (
            <View style={styles.errorRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.danger} />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          <View style={styles.composer}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={canComment ? 'Add a comment…' : 'Sign in to comment'}
              placeholderTextColor={colors.subtext}
              style={styles.input}
              maxLength={2000}
              multiline
              onFocus={() => {
                if (!canComment) onRequireAuth();
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              disabled={!body.trim() || isSending}
              style={({ pressed }) => [
                styles.sendButton,
                (!body.trim() || isSending) && styles.sendButtonDisabled,
                pressed && body.trim() && !isSending && styles.pressed,
              ]}
              onPress={submit}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="send" size={19} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(2, 6, 23, 0.5)',
    },
    sheet: {
      height: '76%',
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 9,
    },
    header: {
      minHeight: 68,
      paddingHorizontal: Brand.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.subtext,
      fontSize: 12,
      marginTop: 2,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.hover,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    list: {
      padding: Brand.spacing.lg,
      gap: Brand.spacing.lg,
    },
    emptyList: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: Brand.spacing.xl,
    },
    centerState: {
      flex: 1,
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      padding: Brand.spacing.xl,
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
    comment: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Brand.spacing.md,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.hover,
      borderWidth: 1,
      borderColor: colors.border,
    },
    commentBody: {
      flex: 1,
      gap: 5,
    },
    commentMeta: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: Brand.spacing.sm,
    },
    author: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    timestamp: {
      color: colors.subtext,
      fontSize: 11,
    },
    commentText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    errorRow: {
      marginHorizontal: Brand.spacing.lg,
      marginBottom: Brand.spacing.sm,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.hover,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    errorText: {
      flex: 1,
      color: colors.danger,
      fontSize: 12,
    },
    composer: {
      paddingHorizontal: Brand.spacing.md,
      paddingTop: Brand.spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Brand.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 104,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.page,
      color: colors.text,
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 11,
      fontSize: 14,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryFrom,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.45,
    },
  });
