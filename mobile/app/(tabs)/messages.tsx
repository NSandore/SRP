import { useEffect, useMemo, useRef, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { apiClient } from '@/lib/api/client';
import { buildAvatarSrc } from '@/lib/uploads';

type Conversation = {
  conversation_id: string;
  other_user_id: string;
  first_name?: string;
  last_name?: string;
  avatar_path?: string | null;
  last_message?: string;
  last_date?: string;
  unread_count?: number | string;
};

type MessageItem = {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

type UserResult = {
  user_id: string;
  first_name?: string;
  last_name?: string;
  avatar_path?: string | null;
  headline?: string | null;
};

type ActiveConversation = {
  conversation_id: string | null;
  other_user_id: string;
  first_name?: string;
  last_name?: string;
  avatar_path?: string | null;
  headline?: string | null;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '';
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return date
    .toLocaleString(undefined, {
      month: isToday ? undefined : 'short',
      day: isToday ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
};

const formatDaysAgo = (timestamp?: string) => {
  if (!timestamp) return '';
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / msPerDay));
  if (days === 0) return 'Today';
  return `${days} Days ago`;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const params = useLocalSearchParams<{ user?: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const isCompact = screenWidth < 900;
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oldestMessageIdRef = useRef<string | null>(null);
  const skipAutoScrollRef = useRef(false);
  const messagesScrollRef = useRef<ScrollView>(null);
  const pendingTargetRef = useRef<string | null>(null);

  const showConversationPanel = !activeConv || !isCompact;
  const showThreadPanel = Boolean(activeConv) || !isCompact;

  useEffect(() => {
    if (isLoading) return;
    if (!user?.user_id) {
      openLockedFeature('Messaging');
    }
  }, [user?.user_id, isLoading, openLockedFeature]);

  const activeName = useMemo(() => {
    if (!activeConv) return '';
    return `${activeConv.first_name || ''} ${activeConv.last_name || ''}`.trim() || 'Member';
  }, [activeConv]);

  const canSend = newMessage.trim().length > 0 && !isSending;

  const fetchConversations = async () => {
    if (!user?.user_id) return;
    setLoadingConversations(true);
    try {
      const resp = await apiClient.get('/fetch_conversations.php', {
        params: { user_id: user.user_id },
      });
      if ((resp.data as any)?.success) {
        setConversations((resp.data as any)?.conversations || []);
      }
    } catch (err) {
      setError('Unable to load conversations.');
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (
    conversationId: string,
    otherUserId: string,
    meta: Partial<ActiveConversation> = {}
  ) => {
    if (!user?.user_id) return;
    pendingTargetRef.current = null;
    setLoadingMessages(true);
    oldestMessageIdRef.current = null;
    setHasMore(true);
    try {
      const resp = await apiClient.get('/fetch_messages.php', {
        params: { conversation_id: conversationId, user_id: user.user_id },
      });
      if ((resp.data as any)?.success) {
        const list = (resp.data as any)?.messages || [];
        setMessages(list);
        if (list.length) {
          oldestMessageIdRef.current = list[0].message_id;
          setHasMore(Boolean((resp.data as any)?.has_more));
        }
        setActiveConv({
          conversation_id: conversationId,
          other_user_id: otherUserId,
          ...meta,
        });
        fetchConversations();
      }
    } catch (err) {
      setError('Unable to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchOlderMessages = async () => {
    if (!user?.user_id || !activeConv?.conversation_id || !oldestMessageIdRef.current) return;
    if (!hasMore || loadingOlder) return;
    setLoadingOlder(true);
    skipAutoScrollRef.current = true;
    try {
      const resp = await apiClient.get('/fetch_messages.php', {
        params: {
          conversation_id: activeConv.conversation_id,
          user_id: user.user_id,
          before_id: oldestMessageIdRef.current,
        },
      });
      if ((resp.data as any)?.success) {
        const older = (resp.data as any)?.messages || [];
        if (older.length) {
          oldestMessageIdRef.current = older[0].message_id;
          setMessages((prev) => [...older, ...prev]);
          setHasMore(Boolean((resp.data as any)?.has_more));
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      setError('Unable to load earlier messages.');
    } finally {
      setLoadingOlder(false);
      skipAutoScrollRef.current = false;
    }
  };

  const startConversation = (target: string | UserResult) => {
    const otherId =
      typeof target === 'string' || typeof target === 'number'
        ? String(target)
        : target?.user_id;
    if (!otherId) return;
    const existing = conversations.find((c) => String(c.other_user_id) === String(otherId));
    const meta =
      typeof target === 'object'
        ? {
            first_name: target.first_name,
            last_name: target.last_name,
            avatar_path: target.avatar_path,
            headline: target.headline,
          }
        : {};
    if (existing) {
      pendingTargetRef.current = null;
      fetchMessages(existing.conversation_id, existing.other_user_id, {
        first_name: existing.first_name,
        last_name: existing.last_name,
        avatar_path: existing.avatar_path,
        ...meta,
      });
    } else {
      pendingTargetRef.current = otherId;
      setActiveConv({
        conversation_id: null,
        other_user_id: otherId,
        ...meta,
      });
      setMessages([]);
      if (!loadingConversations && conversations.length === 0) {
        fetchConversations();
      }
    }
  };

  const handleSend = async () => {
    if (!user?.user_id || !activeConv || !newMessage.trim()) return;
    setIsSending(true);
    try {
      const resp = await apiClient.post('/send_message.php', {
        sender_id: user.user_id,
        recipient_id: activeConv.other_user_id,
        content: newMessage.trim(),
      });
      const conversationId =
        (resp.data as any)?.conversation_id || activeConv.conversation_id || '';
      setNewMessage('');
      if (conversationId) {
        await fetchMessages(conversationId, activeConv.other_user_id, {
          first_name: activeConv.first_name,
          last_name: activeConv.last_name,
          avatar_path: activeConv.avatar_path,
          headline: activeConv.headline,
        });
      }
    } catch (err) {
      setError('Unable to send message.');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (user?.user_id) {
      fetchConversations();
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (!user?.user_id) return;
    const startUser = params?.user;
    const target = Array.isArray(startUser) ? startUser[0] : startUser;
    if (target) {
      startConversation(target);
    }
  }, [params?.user, user?.user_id]);

  useEffect(() => {
    const pending = pendingTargetRef.current;
    if (!pending) return;
    const existing = conversations.find((c) => String(c.other_user_id) === String(pending));
    if (!existing) return;
    pendingTargetRef.current = null;
    fetchMessages(existing.conversation_id, existing.other_user_id, {
      first_name: existing.first_name,
      last_name: existing.last_name,
      avatar_path: existing.avatar_path,
    });
  }, [conversations]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiClient
        .get('/search_users.php', { params: { term } })
        .then((resp) => {
          if ((resp.data as any)?.success) {
            setSearchResults((resp.data as any)?.users || []);
          }
        })
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (skipAutoScrollRef.current) return;
    if (!loadingMessages && messages.length) {
      messagesScrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages, loadingMessages, activeConv?.conversation_id]);

  return (
    <AppShell>
      <View style={styles.screen}>
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          {showConversationPanel ? (
            <View
              style={[
                styles.conversationsPanel,
                !isCompact && styles.conversationsPanelSplit,
              ]}
            >
              <View style={styles.panelHeader}>
                <ThemedText style={styles.panelTitle}>Messages</ThemedText>
                <ThemedText style={styles.panelSubtitle}>
                  Stay connected with your communities and contacts.
                </ThemedText>
              </View>
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.subtext} />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search people"
                  placeholderTextColor={colors.subtext}
                  style={styles.searchInput}
                />
              </View>
              {searchResults.length > 0 ? (
                <View style={styles.searchResults}>
                  {searchResults.map((result) => (
                    <Pressable
                      key={result.user_id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        setSearchResults([]);
                        setSearchTerm('');
                        startConversation(result);
                      }}
                    >
                      <Image
                        source={{ uri: buildAvatarSrc(result.avatar_path) }}
                        style={styles.searchAvatar}
                      />
                      <ThemedText style={styles.searchName}>
                        {result.first_name} {result.last_name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <ScrollView
                style={styles.conversationScroll}
                contentContainerStyle={styles.conversationList}
              >
                {loadingConversations ? <ActivityIndicator /> : null}
                {conversations.length === 0 && !loadingConversations ? (
                  <View style={styles.emptyCopy}>
                    <ThemedText style={styles.emptyTitle}>No conversations yet</ThemedText>
                    <ThemedText style={styles.emptyText}>
                      Start connecting from a profile or use the search bar above.
                    </ThemedText>
                  </View>
                ) : (
                  conversations.map((conv) => {
                    const isActive =
                      activeConv && activeConv.conversation_id === conv.conversation_id;
                    const unread = Number(conv.unread_count) > 0;
                    return (
                      <Pressable
                        key={conv.conversation_id}
                        style={[styles.conversationItem, isActive && styles.conversationItemActive]}
                        onPress={() =>
                          fetchMessages(conv.conversation_id, conv.other_user_id, {
                            first_name: conv.first_name,
                            last_name: conv.last_name,
                            avatar_path: conv.avatar_path,
                          })
                        }
                      >
                        <Image
                          source={{ uri: buildAvatarSrc(conv.avatar_path) }}
                          style={styles.conversationAvatar}
                        />
                        <View style={styles.conversationBody}>
                          <View style={styles.conversationMeta}>
                            <ThemedText style={styles.conversationName}>
                              {conv.first_name} {conv.last_name}
                            </ThemedText>
                            <ThemedText style={styles.conversationTime}>
                              {formatDaysAgo(conv.last_date)}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.conversationPreview} numberOfLines={1}>
                            {conv.last_message || 'No messages yet'}
                          </ThemedText>
                        </View>
                        {unread ? (
                          <View style={styles.badge}>
                            <ThemedText style={styles.badgeText}>{conv.unread_count}</ThemedText>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
                {error && conversations.length === 0 ? (
                  <ThemedText style={styles.error}>{error}</ThemedText>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {showThreadPanel ? (
            <View style={styles.threadPanel}>
              {activeConv ? (
                <>
                  <View style={styles.threadHeader}>
                    <View style={styles.threadHeaderLeft}>
                      {isCompact ? (
                        <Pressable
                          style={styles.backButton}
                          onPress={() => {
                            setActiveConv(null);
                            setMessages([]);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="arrow-left"
                            size={18}
                            color={colors.text}
                          />
                          <ThemedText style={styles.backText}>Back</ThemedText>
                        </Pressable>
                      ) : null}
                      <View style={styles.threadUser}>
                        <Image
                          source={{ uri: buildAvatarSrc(activeConv.avatar_path) }}
                          style={styles.threadAvatar}
                        />
                        <View style={styles.threadUserText}>
                          <ThemedText style={styles.threadName}>{activeName}</ThemedText>
                          {activeConv.headline ? (
                            <ThemedText style={styles.threadHeadline}>
                              {activeConv.headline}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <Pressable
                      style={styles.profileLink}
                      onPress={() => router.push(`/user/${activeConv.other_user_id}`)}
                    >
                      <ThemedText style={styles.profileLinkText}>View profile</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.messagesScroll}>
                    {loadingMessages ? (
                      <View style={styles.emptyCopy}>
                        <ThemedText style={styles.emptyText}>Loading conversation...</ThemedText>
                      </View>
                    ) : (
                      <ScrollView
                        ref={messagesScrollRef}
                        contentContainerStyle={styles.messageList}
                      >
                        {hasMore ? (
                          <Pressable
                            style={styles.loadMore}
                            onPress={fetchOlderMessages}
                            disabled={loadingOlder}
                          >
                            <ThemedText style={styles.loadMoreText}>
                              {loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
                            </ThemedText>
                          </Pressable>
                        ) : null}
                        {messages.map((message) => {
                          const isOut = message.sender_id === user?.user_id;
                          if (isOut) {
                            return (
                              <View
                                key={message.message_id}
                                style={[styles.messageRow, styles.messageRowOut]}
                              >
                                <LinearGradient
                                  colors={[colors.primaryFrom, colors.primaryTo]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={[styles.messageBubble, styles.messageOut]}
                                >
                                  <ThemedText style={styles.messageTextOut}>
                                    {message.content}
                                  </ThemedText>
                                  <ThemedText style={styles.messageTimeOut}>
                                    {formatTimestamp(message.created_at)}
                                  </ThemedText>
                                </LinearGradient>
                              </View>
                            );
                          }
                          return (
                            <View key={message.message_id} style={styles.messageRow}>
                              <Image
                                source={{ uri: buildAvatarSrc(activeConv?.avatar_path) }}
                                style={styles.messageAvatar}
                              />
                              <View style={[styles.messageBubble, styles.messageIn]}>
                                <ThemedText style={styles.messageText}>{message.content}</ThemedText>
                                <ThemedText style={styles.messageTime}>
                                  {formatTimestamp(message.created_at)}
                                </ThemedText>
                              </View>
                            </View>
                          );
                        })}
                        {!loadingMessages && messages.length === 0 ? (
                          <View style={styles.emptyCopy}>
                            <ThemedText style={styles.emptyTitle}>No messages yet</ThemedText>
                            <ThemedText style={styles.emptyText}>
                              {activeConv.conversation_id
                                ? 'This conversation is all caught up.'
                                : `Say hello to ${activeName} to get things started.`}
                            </ThemedText>
                          </View>
                        ) : null}
                      </ScrollView>
                    )}
                  </View>
                  <View
                    style={[styles.composer, isCompact && styles.composerStacked]}
                  >
                    <TextInput
                      value={newMessage}
                      onChangeText={setNewMessage}
                      placeholder="Write a message"
                      placeholderTextColor={colors.subtext}
                      multiline
                      style={styles.composerInput}
                    />
                    <Pressable
                      onPress={handleSend}
                      disabled={!canSend}
                      style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                    >
                      <LinearGradient
                        colors={[colors.primaryFrom, colors.primaryTo]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.sendButtonGradient}
                      >
                        <MaterialCommunityIcons name="send" size={16} color="#fff" />
                        <ThemedText style={styles.sendButtonText}>
                          {isSending ? 'Sending...' : 'Send'}
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={[styles.emptyCopy, styles.emptyCopyCentered]}>
                  <ThemedText style={styles.emptyTitle}>Select a conversation</ThemedText>
                  <ThemedText style={styles.emptyText}>
                    Choose a thread to start chatting.
                  </ThemedText>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </AppShell>
  );
}

const createStyles = (colors: BrandColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    padding: Brand.spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 6,
  },
  cardCompact: {
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    flexDirection: 'column',
  },
  conversationsPanel: {
    flex: 1,
    padding: Brand.spacing.lg,
    gap: 12,
    backgroundColor: colors.page,
  },
  conversationsPanelSplit: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  panelHeader: {
    gap: 4,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  panelSubtitle: {
    fontSize: 13,
    color: colors.subtext,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  searchResults: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 3,
    paddingVertical: 6,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  searchName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  conversationScroll: {
    flex: 1,
  },
  conversationList: {
    gap: 12,
    paddingBottom: 12,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.card,
  },
  conversationItemActive: {
    borderColor: colors.primaryFrom,
    backgroundColor: hexToRgba(colors.primaryFrom, 0.08),
  },
  conversationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  conversationBody: {
    flex: 1,
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  conversationTime: {
    fontSize: 11,
    color: colors.subtext,
  },
  conversationPreview: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 4,
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  threadPanel: {
    flex: 1,
    padding: Brand.spacing.lg,
    backgroundColor: colors.card,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  threadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  threadUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  threadAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  threadUserText: {
    flexShrink: 1,
  },
  threadName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  threadHeadline: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
  },
  profileLink: {
    borderWidth: 1,
    borderColor: hexToRgba(colors.primaryFrom, 0.4),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryFrom,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messageList: {
    gap: 12,
    paddingVertical: 6,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowOut: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    alignSelf: 'flex-start',
  },
  messageIn: {
    backgroundColor: hexToRgba(colors.subtext, 0.14),
    borderWidth: 1,
    borderColor: hexToRgba(colors.subtext, 0.2),
  },
  messageOut: {
    alignSelf: 'flex-end',
    borderRadius: 18,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
  },
  messageTime: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 4,
  },
  messageTextOut: {
    fontSize: 14,
    color: '#fff',
  },
  messageTimeOut: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 4,
  },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  loadMoreText: {
    fontSize: 12,
    color: colors.subtext,
  },
  composer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 10,
    backgroundColor: colors.card,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  composerInput: {
    flex: 1,
    minHeight: 54,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  emptyCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  emptyCopyCentered: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: 'center',
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
  },
});
