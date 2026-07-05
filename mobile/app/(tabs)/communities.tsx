import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import AppShell from '@/components/navigation/AppShell';
import { ThemedText } from '@/components/themed-text';
import { Brand, hexToRgba, useBrandColors } from '@/constants/brand';
import type { BrandColors } from '@/constants/brand';
import { useBrandStyles } from '@/hooks/use-brand-styles';
import { isSuperAdmin } from '@/constants/roles';
import { useSession } from '@/hooks/use-session';
import { useLockedFeature } from '@/providers/LockedFeatureProvider';
import { fetchCommunities } from '@/lib/api/communities';
import type { CommunityItem } from '@/lib/api/communities';
import { buildUploadSrc } from '@/lib/uploads';

const TYPE_TABS = [
  { key: 'university', label: 'Universities' },
  { key: 'group', label: 'Groups' },
] as const;

const FILTER_TABS = [
  { key: 'All', label: 'All' },
  { key: 'Followed', label: 'Followed' },
  { key: 'Unfollowed', label: 'Unfollowed' },
] as const;

const SORT_OPTIONS = [
  { key: 'popularity', label: 'Most Followers' },
  { key: 'alpha', label: 'A-Z' },
] as const;

type CommunityType = (typeof TYPE_TABS)[number]['key'];
type FilterKey = (typeof FILTER_TABS)[number]['key'];
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export default function CommunitiesScreen() {
  const { user } = useSession();
  const { openLockedFeature } = useLockedFeature();
  const router = useRouter();
  const colors = useBrandColors();
  const styles = useBrandStyles(createStyles);

  const [selectedType, setSelectedType] = useState<CommunityType>('university');
  const [communityFilter, setCommunityFilter] = useState<FilterKey>('All');
  const [communitySort, setCommunitySort] = useState<SortKey>('popularity');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeSegWidthSV = useSharedValue(0);
  const filterSegWidthSV = useSharedValue(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const typeSegAnim = useSharedValue(0);
  const filterSegAnim = useSharedValue(0);

  const isLoggedIn = Boolean(user?.user_id);

  const requestLabel = isSuperAdmin(user?.role_id) ? '+ Create Group' : '+ Request Group';

  const universityFallback = useMemo(
    () => buildUploadSrc('/uploads/logos/School Image.png'),
    []
  );
  const groupFallback = useMemo(
    () => buildUploadSrc('/uploads/logos/default-logo.png'),
    []
  );

  useEffect(() => {
    typeSegAnim.value = withSpring(selectedType === 'university' ? 0 : 1, {
      damping: 22,
      stiffness: 220,
      mass: 0.7,
    });
  }, [selectedType]);

  useEffect(() => {
    const index = communityFilter === 'All' ? 0 : communityFilter === 'Followed' ? 1 : 2;
    filterSegAnim.value = withSpring(index, {
      damping: 22,
      stiffness: 220,
      mass: 0.7,
    });
  }, [communityFilter]);

  const typeIndicatorStyle = useAnimatedStyle(() => {
    const w = typeSegWidthSV.value;
    return {
      width: w ? w / 2 - 6 : 0,
      transform: [{
        translateX: interpolate(typeSegAnim.value, [0, 1], [3, w ? w / 2 + 3 : 0]),
      }],
    };
  });

  const filterIndicatorStyle = useAnimatedStyle(() => {
    const w = filterSegWidthSV.value;
    return {
      width: w ? w / 3 - 6 : 0,
      transform: [{
        translateX: interpolate(
          filterSegAnim.value,
          [0, 1, 2],
          [3, w ? w / 3 + 3 : 0, w ? (w / 3) * 2 + 3 : 0]
        ),
      }],
    };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchValue.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, communityFilter, communitySort, searchTerm]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
    fetchCommunities({
      type: selectedType,
      page: currentPage,
      search: searchTerm,
      scope: communityFilter.toLowerCase() as 'all' | 'followed' | 'unfollowed',
      sort: communitySort,
      userId: user?.user_id,
    })
      .then((resp) => {
        if (!mounted) return;
        setCommunities(resp.communities || []);
        setTotalPages(resp.totalPages || 1);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Unable to load communities.');
        setCommunities([]);
        setTotalPages(1);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedType, communityFilter, communitySort, searchTerm, currentPage, user?.user_id]);

  return (
    <AppShell>
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.pageTitle}>
              Communities
            </ThemedText>
          </View>

          <View style={styles.controls}>
            <View style={styles.controlGroup}>
              <ThemedText style={styles.controlLabel}>Type</ThemedText>
              <View style={styles.typeRow}>
                <View
                  style={styles.segmentControl}
                  onLayout={(event) => { typeSegWidthSV.value = event.nativeEvent.layout.width; }}
                >
                  <Animated.View style={[styles.segmentIndicator, typeIndicatorStyle]} />
                  <View style={styles.segmentPillBackground} />
                  {TYPE_TABS.map((tab, index) => (
                    <Pressable
                      key={tab.key}
                      style={[
                        styles.segmentButton,
                        index === 0 ? styles.segmentButtonLeft : styles.segmentButtonRight,
                      ]}
                      onPress={() => setSelectedType(tab.key)}
                    >
                      <ThemedText
                        style={[
                          styles.segmentButtonText,
                          selectedType === tab.key && styles.segmentButtonTextActive,
                        ]}
                      >
                        {tab.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {selectedType === 'group' ? (
                  <Pressable
                    style={[styles.requestButton, !isLoggedIn && styles.requestButtonDisabled]}
                    onPress={() => {
                      if (!isLoggedIn) {
                        openLockedFeature('Community requests');
                        return;
                      }
                      Alert.alert('Coming soon', 'Community requests are not yet available on mobile.');
                    }}
                  >
                    <LinearGradient
                      colors={[colors.primaryFrom, colors.primaryTo]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.requestButtonGradient}
                    >
                      <ThemedText style={styles.requestButtonText}>{requestLabel}</ThemedText>
                    </LinearGradient>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.subtext} />
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder="Search universities, groups…"
                placeholderTextColor={colors.subtext}
                style={styles.searchInput}
              />
            </View>
            <Pressable
              style={styles.filterButtonInline}
              onPress={() => setShowFilters((prev) => !prev)}
              accessibilityLabel="Toggle filters"
            >
              <MaterialCommunityIcons
                name="filter-variant"
                size={16}
                color={colors.primaryFrom}
              />
            </Pressable>
          </View>

          {showFilters ? (
            <View style={styles.filterPanel}>
              <View style={styles.controlGroup}>
                <ThemedText style={styles.controlLabel}>Filter</ThemedText>
                <View
                  style={styles.segmentControlSmall}
                  onLayout={(event) => { filterSegWidthSV.value = event.nativeEvent.layout.width; }}
                >
                  <Animated.View style={[styles.segmentIndicatorSmall, filterIndicatorStyle]} />
                  {FILTER_TABS.map((tab) => {
                    const disabled = !isLoggedIn && tab.key !== 'All';
                    return (
                      <Pressable
                        key={tab.key}
                        style={[styles.segmentButtonSmall, disabled && styles.segmentButtonDisabled]}
                        onPress={() => {
                          if (disabled) return;
                          setCommunityFilter(tab.key);
                        }}
                        disabled={disabled}
                      >
                        <ThemedText
                          style={[
                            styles.segmentButtonTextSmall,
                            communityFilter === tab.key && styles.segmentTextActive,
                            disabled && styles.segmentTextDisabled,
                          ]}
                        >
                          {tab.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.controlGroup}>
                <View style={styles.sortRow}>
                  <ThemedText style={styles.controlLabel}>Sort</ThemedText>
                  <Pressable
                    style={styles.sortDropdown}
                    onPress={() => setShowSortMenu((prev) => !prev)}
                  >
                    <ThemedText style={styles.sortDropdownLabel}>
                      {SORT_OPTIONS.find((opt) => opt.key === communitySort)?.label || 'Most Followers'}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={16}
                      color={colors.subtext}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {isLoading ? <ActivityIndicator /> : null}
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          {communities.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>No communities match your filters.</ThemedText>
            </View>
          ) : (
            communities.map((community) => {
              const isFollowed = Number(community.is_followed) > 0;
              const fallbackLogo =
                selectedType === 'university' ? universityFallback : groupFallback;
              const normalizedLogo = community.logo_path ? buildUploadSrc(community.logo_path) : fallbackLogo;
              return (
                <Pressable
                  key={community.community_id}
                  style={[styles.communityCard, isFollowed && styles.communityCardFollowed]}
                  onPress={() => {
                    if (selectedType === 'university') {
                      router.push(`/university/${community.community_id}`);
                    } else {
                      router.push(`/group/${community.community_id}`);
                    }
                  }}
                >
                  <Image source={{ uri: normalizedLogo || fallbackLogo }} style={styles.communityLogo} />
                  <View style={styles.communityContent}>
                    <ThemedText style={styles.communityName} numberOfLines={1}>
                      {community.name || 'Community'}
                    </ThemedText>
                    {community.tagline ? (
                      <ThemedText style={styles.communityTagline}>{community.tagline}</ThemedText>
                    ) : null}
                    <View style={styles.communityMeta}>
                      {community.location ? (
                        <ThemedText style={styles.communityMetaText}>
                          {community.location}
                        </ThemedText>
                      ) : null}
                      <ThemedText style={styles.communityMetaText}>
                        Followers: {community.followers_count || 0}
                      </ThemedText>
                      {typeof community.following_count !== 'undefined' ? (
                        <ThemedText style={styles.communityMetaText}>
                          Following: {community.following_count}
                        </ThemedText>
                      ) : null}
                      {typeof community.admin_count !== 'undefined' ? (
                        <ThemedText style={styles.communityMetaText}>
                          Admins: {community.admin_count}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          <View style={styles.pagination}>
            <Pressable
              style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={() => {
                setCurrentPage((prev) => Math.max(1, prev - 1));
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              disabled={currentPage === 1}
            >
              <ThemedText style={styles.paginationText}>Last</ThemedText>
            </Pressable>
            <ThemedText style={styles.paginationInfo}>
              Page {currentPage} of {totalPages}
            </ThemedText>
            <Pressable
              style={[
                styles.paginationButton,
                currentPage === totalPages && styles.paginationButtonDisabled,
              ]}
              onPress={() => {
                setCurrentPage((prev) => Math.min(totalPages, prev + 1));
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              disabled={currentPage === totalPages}
            >
              <ThemedText style={styles.paginationText}>Next</ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        {showSortMenu ? (
          <View style={styles.overlayRoot} pointerEvents="box-none">
            <Pressable style={styles.overlayBackdrop} onPress={() => setShowSortMenu(false)} />
            <View style={styles.overlayCard}>
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={styles.sortMenuItem}
                  onPress={() => {
                    setCommunitySort(opt.key);
                    setShowSortMenu(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name={communitySort === opt.key ? 'radiobox-marked' : 'radiobox-blank'}
                    size={16}
                    color={colors.primaryFrom}
                  />
                  <ThemedText style={styles.sortMenuText}>{opt.label}</ThemedText>
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
    backgroundColor: colors.page,
  },
  container: {
    padding: Brand.spacing.lg,
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    gap: 6,
  },
  pageTitle: {
    fontWeight: '700',
  },
  controls: {
    gap: 12,
  },
  controlGroup: {
    gap: 6,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
    padding: 3,
    alignSelf: 'flex-start',
    minWidth: 220,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  segmentPillBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 999,
  },
  segmentButtonLeft: {
    marginRight: 4,
  },
  segmentButtonRight: {
    marginLeft: 4,
  },
  segmentButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  segmentControlSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: hexToRgba(colors.text, 0.08),
    padding: 2,
    alignSelf: 'flex-start',
    minWidth: 220,
  },
  segmentIndicatorSmall: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: 999,
    backgroundColor: colors.primaryFrom,
  },
  segmentButtonSmall: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    borderRadius: 999,
  },
  segmentButtonDisabled: {
    opacity: 0.5,
  },
  segmentButtonTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  segmentTextActive: {
    color: '#fff',
  },
  segmentTextDisabled: {
    color: colors.subtext,
  },
  requestButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
  },
  requestButtonGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterButtonInline: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  filterPanel: {
    gap: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  communityCardFollowed: {
    borderColor: colors.border,
    backgroundColor: hexToRgba(colors.text, 0.06),
  },
  communityLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  communityContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  communityName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  communityTagline: {
    fontSize: 12,
    color: colors.subtext,
  },
  communityMeta: {
    gap: 2,
  },
  communityMetaText: {
    fontSize: 12,
    color: colors.subtext,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.subtext,
  },
  pagination: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  paginationInfo: {
    fontSize: 12,
    color: colors.subtext,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'flex-start',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  overlayCard: {
    marginHorizontal: Brand.spacing.lg,
    marginTop: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  sortMenuText: {
    fontSize: 13,
    color: colors.text,
  },
});
