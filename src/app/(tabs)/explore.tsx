import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Dimensions, Platform, Animated,
  RefreshControl, ActivityIndicator, FlatList,
} from 'react-native';
import { FlashList as ShopifyFlashList } from '@shopify/flash-list';
const FlashList = ShopifyFlashList as any;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../theme';
import { usePostsQuery } from '../../api/feed';
import { useCommunitiesQuery, useJoinCommunityMutation } from '../../api/community';
import { useToastStore } from '../../store/toastStore';
import PostCard from '../../components/feed/PostCard';
import CommentSheet from '../../components/feed/CommentSheet';
import Skeleton from '../../components/feedback/Skeleton';
import { useSuggestedUsersQuery, useSearchUsersQuery } from '../../api/user';
import { useEventsQuery, useToggleInterestMutation, useToggleLikeMutation, useShareEventMutation } from '../../api/event';
import { useSendConnectionRequestMutation, useConnectionStatusQuery, ConnectionStatus } from '../../api/connections';
import { useAuthStore } from '../../store/authStore';
import EventCommentSheet from '../../components/feed/EventCommentSheet';
import EventShareSheet from '../../components/feed/EventShareSheet';
import { API_BASE_URL } from '../../api/client';

const { width: SW } = Dimensions.get('window');
const COMM_BANNER_H = Math.round(SW * 0.28);
const EVENT_BANNER_H = Math.round(SW * 0.4);

// ── Tab types ─────────────────────────────────────────────────────────────────
type ExploreTab = 'members' | 'communities' | 'feed' | 'events';
const TABS: { id: ExploreTab; label: string; icon: string }[] = [
  { id: 'members',     label: 'Members',      icon: 'people-outline' },
  { id: 'communities', label: 'Communities',  icon: 'globe-outline' },
  { id: 'feed',        label: 'Feed',         icon: 'newspaper-outline' },
  { id: 'events',      label: 'Events',       icon: 'calendar-outline' },
];

const TRENDING_SEARCHES: string[] = [];

const EVENT_FILTERS = ['All', 'Upcoming', 'Today', 'This Week', 'Past', 'My Events'];

const COMMUNITY_TYPES = ['All', 'Village', 'Youth', 'Women', 'Farmers', 'Temple', 'Sports', 'Education'];

// ── Skeleton components ───────────────────────────────────────────────────────
function MemberSkeleton() {
  return (
    <View style={styles.memberCardSkeleton}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={14} borderRadius={6} />
        <Skeleton width="40%" height={11} borderRadius={6} />
        <Skeleton width="35%" height={11} borderRadius={6} />
      </View>
      <Skeleton width={72} height={32} borderRadius={20} />
    </View>
  );
}

function CommunitySkeleton() {
  return (
    <View style={styles.communityCardSkeleton}>
      <Skeleton width="100%" height={100} borderRadius={16} style={{ marginBottom: 10 }} />
      <View style={{ gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
        <Skeleton width="60%" height={16} borderRadius={6} />
        <Skeleton width="80%" height={12} borderRadius={6} />
        <Skeleton width="40%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

function EventSkeleton() {
  return (
    <View style={styles.eventCardSkeleton}>
      <Skeleton width="100%" height={140} borderRadius={0} style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />
      <View style={{ gap: 8, padding: 14 }}>
        <Skeleton width="70%" height={16} borderRadius={6} />
        <Skeleton width="50%" height={12} borderRadius={6} />
        <Skeleton width="45%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

// ── Connect Button (per-member, own hook scope) ───────────────────────────────
function ConnectButton({ item, currentUserId }: { item: any; currentUserId?: string }) {
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const G = colors.primary;
  const { data: status = 'NONE', isLoading: statusLoading } = useConnectionStatusQuery(item.id, currentUserId);
  const sendRequest = useSendConnectionRequestMutation();

  const handleConnect = () => {
    if (status !== 'NONE') return;
    sendRequest.mutate(item.id, {
      onSuccess: () => showToast(`Request sent to ${item.displayName || item.username}`, 'success'),
      onError: (e: any) => showToast(e?.response?.data?.message || 'Failed to send request', 'error'),
    });
  };

  const iconName = status === 'ACCEPTED' ? 'checkmark-circle' : status === 'PENDING_SENT' ? 'time-outline' : 'person-add-outline';
  const bgColor = status === 'ACCEPTED' ? colors.primaryContainer : status === 'PENDING_SENT' ? colors.elevation1 : colors.primaryContainer;
  const iconColor = status === 'PENDING_SENT' ? colors.textMuted : G;

  return (
    <TouchableOpacity
      style={[styles.msgBtn, { backgroundColor: bgColor }]}
      onPress={handleConnect}
      disabled={status !== 'NONE' || sendRequest.isPending || statusLoading}
    >
      {sendRequest.isPending ? (
        <ActivityIndicator size={14} color={G} />
      ) : (
        <Ionicons name={iconName as any} size={16} color={iconColor} />
      )}
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const showToast = useToastStore((s) => s.showToast);
  const currentUser = useAuthStore((s) => s.user);

  const initialTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const [activeTab, setActiveTab] = useState<ExploreTab>(
    initialTab && ['members', 'communities', 'feed', 'events'].includes(initialTab)
      ? initialTab as ExploreTab
      : 'members'
  );

  useEffect(() => {
    const t = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (t && ['members', 'communities', 'feed', 'events'].includes(t)) {
      setActiveTab(t as ExploreTab);
    }
  }, [params.tab]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState('All');
  const [selectedCommType, setSelectedCommType] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const searchRef = useRef<TextInput>(null);

  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts } = usePostsQuery();
  const { data: communities = [], isLoading: commsLoading, refetch: refetchComms } = useCommunitiesQuery();
  const joinMutation = useJoinCommunityMutation();
  
  const { data: suggestedMembers = [], isLoading: suggestedLoading, refetch: refetchMembers } = useSuggestedUsersQuery();
  const { data: searchedMembers = [], isLoading: searchLoading } = useSearchUsersQuery(debouncedSearch);
  const members = debouncedSearch ? searchedMembers : suggestedMembers;
  const membersLoading = debouncedSearch ? searchLoading : suggestedLoading;
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useEventsQuery();
  const toggleInterest = useToggleInterestMutation();
  const toggleLike = useToggleLikeMutation();
  const shareEvent = useShareEventMutation();
  const [eventCommentSheetVisible, setEventCommentSheetVisible] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string | undefined>();
  const [shareSheetEvent, setShareSheetEvent] = useState<{ id: string; title: string } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'feed') await refetchPosts();
    else if (activeTab === 'communities') await refetchComms();
    else if (activeTab === 'members') await refetchMembers();
    else if (activeTab === 'events') await refetchEvents();
    setRefreshing(false);
  };

  const G = colors.primary;
  const SAFFRON = colors.saffron || '#FF6F00';
  const BG = colors.background;
  const SURF = colors.surface;
  const BORDER = colors.border;
  const TEXT = colors.text;
  const TEXT2 = colors.textSecondary;
  const TEXT3 = colors.textMuted;

  // Debounce
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(h);
  }, [searchText]);

  const commitSearch = (text: string) => {
    if (!text.trim()) return;
    setRecentSearches((prev) => [text, ...prev.filter((s) => s !== text)].slice(0, 6));
    setDebouncedSearch(text);
    setSearchText(text);
    setIsFocused(false);
    searchRef.current?.blur();
  };

  const clearSearch = () => {
    setSearchText('');
    setDebouncedSearch('');
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredMembers = members;

  const filteredCommunities = communities.filter((c: any) => {
    const typeMatch = selectedCommType === 'All' ||
      c.category?.toLowerCase().includes(selectedCommType.toLowerCase());
    if (!typeMatch) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
  });

  const filteredPosts = posts.filter((p: any) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.author.displayName.toLowerCase().includes(q) ||
      p.community?.name.toLowerCase().includes(q) ||
      p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  });

  const filteredEvents = events.filter((e: any) => {
    const now = new Date();
    const start = new Date(e.startsAt);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
    const filterMatch = selectedEventFilter === 'All' ||
      (selectedEventFilter === 'Upcoming' && start >= now) ||
      (selectedEventFilter === 'Past' && start < now) ||
      (selectedEventFilter === 'Today' && start >= now && start <= todayEnd) ||
      (selectedEventFilter === 'This Week' && start >= now && start <= weekEnd) ||
      (selectedEventFilter === 'My Events' && (e.userRsvpStatus === 'GOING' || e.isInterested));
    if (!filterMatch) return false;
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q)
    );
  });

  // ── Search overlay (shows when focused + no text typed yet) ───────────────
  const renderSearchOverlay = () => (
    <ScrollView style={[styles.searchOverlay, { backgroundColor: BG }]} showsVerticalScrollIndicator={false}>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.searchSection}>
          <View style={styles.searchSectionHeader}>
            <Text style={[styles.searchSectionTitle, { color: TEXT }]}>Recent</Text>
            <TouchableOpacity onPress={() => setRecentSearches([])}>
              <Text style={[styles.clearAllText, { color: G }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((s, i) => (
            <TouchableOpacity key={i} style={styles.recentItem} onPress={() => commitSearch(s)}>
              <View style={[styles.recentIcon, { backgroundColor: colors.elevation1 }]}>
                <Ionicons name="time-outline" size={16} color={TEXT3} />
              </View>
              <Text style={[styles.recentText, { color: TEXT2 }]}>{s}</Text>
              <TouchableOpacity onPress={() => setRecentSearches((p) => p.filter((_, j) => j !== i))}>
                <Ionicons name="close" size={16} color={TEXT3} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trending Searches */}
      <View style={styles.searchSection}>
        <Text style={[styles.searchSectionTitle, { color: TEXT, marginBottom: 12 }]}>🔥 Trending</Text>
        <View style={styles.trendingWrap}>
          {TRENDING_SEARCHES.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.trendingChip, { backgroundColor: colors.primaryContainer, borderColor: BORDER }]}
              onPress={() => commitSearch(s.replace(/^[^\w]+/, ''))}
            >
              <Text style={[styles.trendingText, { color: G }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search tips */}
      <View style={[styles.tipsCard, { backgroundColor: colors.elevation1, borderColor: BORDER }]}>
        <Ionicons name="bulb-outline" size={18} color={SAFFRON} />
        <Text style={[styles.tipsText, { color: TEXT2 }]}>
          Try searching by name, village, district, or occupation
        </Text>
      </View>
    </ScrollView>
  );

  // ── Member Card ────────────────────────────────────────────────────────────
  const renderMemberCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.memberCard, { backgroundColor: SURF, borderColor: BORDER }]}
      onPress={() => router.push(`/user/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.memberCardLeft}>
        <View style={[styles.memberAvatarRing, { borderColor: G }]}>
          <ExpoImage
            source={item.avatarUrl
              ? { uri: item.avatarUrl }
              : { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.displayName || item.username || 'U')}&background=e8f5e9&color=4caf50` }
            }
            style={styles.memberAvatar}
            contentFit="cover"
          />
        </View>
        {item.role === 'MODERATOR' && (
          <View style={[styles.memberBadgeDot, { backgroundColor: G, borderColor: SURF }]}>
            <Ionicons name="shield-checkmark" size={8} color="#FFF" />
          </View>
        )}
      </View>

      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={[styles.memberName, { color: TEXT }]}>{item.displayName || item.username}</Text>
          {item.role ? (
            <View style={[styles.memberBadge, { backgroundColor: 'rgba(21, 101, 192, 0.15)', borderColor: 'rgba(21, 101, 192, 0.3)' }]}>
              <Text style={[styles.memberBadgeText, { color: '#1565C0' }]}>{item.role}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.memberMeta}>
          <Ionicons name="location-outline" size={12} color={SAFFRON} />
          <Text style={[styles.memberMetaText, { color: TEXT3 }]}>Member</Text>
        </View>
        <View style={styles.memberMeta}>
          <Ionicons name="briefcase-outline" size={12} color={TEXT3} />
          <Text style={[styles.memberMetaText, { color: TEXT3 }]} numberOfLines={1}>{item.bio || 'No bio provided'}</Text>
        </View>
        {(item.followersCount || 0) > 0 && (
          <View style={styles.memberMeta}>
            <Ionicons name="people-outline" size={12} color={G} />
            <Text style={[styles.memberMetaText, { color: G }]}>{item.followersCount} followers</Text>
          </View>
        )}
      </View>

      <View style={styles.memberActions}>
        <ConnectButton item={item} currentUserId={currentUser?.id} />
        <TouchableOpacity 
          style={[styles.msgBtn, { backgroundColor: colors.elevation1 }]}
          onPress={() => router.push(`/chat/${item.username}` as any)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={TEXT2} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // ── Community Card ─────────────────────────────────────────────────────────
  const renderCommunityCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.communityCard, { backgroundColor: SURF, borderColor: BORDER }]}
      onPress={() => router.push(`/community/${item.id}` as any)}
      activeOpacity={0.9}
    >
      {/* Banner */}
      <View style={styles.communityBannerWrap}>
        <ExpoImage
          source={{ uri: item.bannerUrl || 'https://placehold.co/600x200/e8f5e9/4caf50?text=Community' }}
          style={styles.communityBanner}
          contentFit="cover"
        />
        <View style={styles.communityBannerOverlay} />
        {/* Category chip on banner */}
        <View style={[styles.categoryChip, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Text style={styles.categoryChipText}>{item.category}</Text>
        </View>
      </View>

      {/* Avatar overlapping banner */}
      <View style={[styles.communityAvatarWrap, { borderColor: SURF }]}>
        <ExpoImage
          source={{ uri: item.avatarUrl || 'https://ui-avatars.com/api/?name=C&background=e8f5e9&color=4caf50' }}
          style={styles.communityAvatar}
          contentFit="cover"
        />
      </View>

      <View style={styles.communityBody}>
        <View style={styles.communityNameRow}>
          <Text style={[styles.communityName, { color: TEXT }]} numberOfLines={1}>{item.name}</Text>
          {item.isJoined && (
            <View style={[styles.joinedChip, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="checkmark-circle" size={12} color={G} />
              <Text style={[styles.joinedChipText, { color: G }]}>Following</Text>
            </View>
          )}
        </View>
        <Text style={[styles.communityDesc, { color: TEXT3 }]} numberOfLines={2}>{item.description}</Text>

        <View style={styles.communityStats}>
          <View style={styles.commStat}>
            <Ionicons name="people-outline" size={13} color={TEXT3} />
            <Text style={[styles.commStatText, { color: TEXT2 }]}>
              {((item.membersCount ?? 0) >= 1000 ? ((item.membersCount ?? 0) / 1000).toFixed(1) + 'k' : (item.membersCount ?? 0))} members
            </Text>
          </View>
          <View style={styles.commStat}>
            <Ionicons name="document-text-outline" size={13} color={TEXT3} />
            <Text style={[styles.commStatText, { color: TEXT2 }]}>{item.postsCount} posts</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.joinBtn,
            { backgroundColor: item.isJoined ? colors.primaryContainer : G },
          ]}
          onPress={() => {
            joinMutation.mutate(item.id);
            showToast(item.isJoined ? 'Left community.' : 'Joined community!', 'success');
          }}
        >
          <Text style={[styles.joinBtnText, { color: item.isJoined ? G : '#FFF' }]}>
            {item.isJoined ? 'Following' : 'Join Community'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEventCard = ({ item }: { item: any }) => {
    const isPast = new Date(item.startsAt) < new Date();
    const dateStr = new Date(item.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date(item.startsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isInterested = item.isInterested ?? false;
    const interestedCount = item.interestedCount ?? 0;
    const isLiked = item.isLiked ?? false;
    const likesCount = item.likesCount ?? 0;
    const commentsCount = item.commentsCount ?? 0;
    const sharesCount = item.sharesCount ?? 0;

    const handleInterest = () => {
      if (!currentUser) { showToast('Please log in to mark interest', 'error'); return; }
      if (toggleInterest.isPending) return;
      toggleInterest.mutate(item.id, {
        onError: (e: any) => showToast(e?.response?.data?.message || 'Failed to update interest', 'error'),
      });
    };

    const handleLike = () => {
      if (!currentUser) { showToast('Please log in to like', 'error'); return; }
      if (toggleLike.isPending) return;
      toggleLike.mutate(item.id, {
        onError: (e: any) => showToast(e?.response?.data?.message || 'Failed to update like', 'error'),
      });
    };

    const handleComment = () => {
      if (!currentUser) { showToast('Please log in to comment', 'error'); return; }
      setSelectedEventId(item.id);
      setSelectedEventTitle(item.title);
      setEventCommentSheetVisible(true);
    };

    const handleShare = () => {
      if (!currentUser) { showToast('Please log in to share', 'error'); return; }
      shareEvent.mutate(item.id, {
        onError: (e: any) => showToast(e?.response?.data?.message || 'Failed to track share', 'error'),
      });
      setShareSheetEvent({ id: item.id, title: item.title });
    };

    return (
      <View style={[styles.eventCard, { backgroundColor: SURF, borderColor: BORDER }]}>
        {/* Banner */}
        <View style={styles.eventBannerWrap}>
          {item.coverUrl && !item.coverUrl.startsWith('blob:') ? (
            <ExpoImage
              source={{ uri: item.coverUrl }}
              style={styles.eventBanner}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.eventBanner, { backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="calendar-outline" size={48} color={colors.primary} />
            </View>
          )}
          <View style={styles.eventBannerOverlay} />
          {/* Date badge */}
          <View style={[styles.dateBadge, { backgroundColor: G }]}>
            <Text style={styles.dateBadgeDay}>{dateStr.split(' ')[1]?.replace(',', '') || '--'}</Text>
            <Text style={styles.dateBadgeMonth}>{dateStr.split(' ')[0] || '--'}</Text>
          </View>
          {/* Type badge */}
          <View style={[
            styles.eventTypeBadge,
            { backgroundColor: isPast ? 'rgba(0,0,0,0.55)' : 'rgba(255,111,0,0.85)' },
          ]}>
            <Text style={styles.eventTypeBadgeText}>
              {isPast ? 'Past Event' : 'Upcoming'}
            </Text>
          </View>
        </View>

        <View style={styles.eventBody}>
          <View style={[styles.eventCategoryChip, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[styles.eventCategoryText, { color: colors.primary }]}>Event</Text>
          </View>
          <Text style={[styles.eventTitle, { color: TEXT }]} numberOfLines={2}>{item.title}</Text>
          
          <View style={styles.eventMetaRow}>
            <Ionicons name="calendar-outline" size={14} color={TEXT3} />
            <Text style={[styles.eventMetaText, { color: TEXT2 }]}>{dateStr} • {timeStr}</Text>
          </View>
          <View style={styles.eventMetaRow}>
            <Ionicons name="location-outline" size={14} color={TEXT3} />
            <Text style={[styles.eventMetaText, { color: TEXT2 }]} numberOfLines={1}>
              {item.location || 'Location TBA'}
            </Text>
          </View>

          {/* Interested button */}
          <TouchableOpacity
            style={[styles.rsvpBtn, { backgroundColor: isInterested ? colors.primaryContainer : G }]}
            onPress={handleInterest}
            disabled={toggleInterest.isPending}
          >
            <Text style={[styles.rsvpBtnText, { color: isInterested ? G : '#FFF' }]}>
              {isInterested ? '✓ Joined' : 'Join Event'}
            </Text>
          </TouchableOpacity>

          {/* Social actions: Like | Comment | Share */}
          <View style={[styles.eventActionsRow, { borderTopColor: BORDER }]}>
            {/* ❤️ Like */}
            <TouchableOpacity
              style={styles.eventActionBtn}
              onPress={handleLike}
              disabled={toggleLike.isPending && toggleLike.variables === item.id}
              activeOpacity={0.7}
            >
              {toggleLike.isPending && toggleLike.variables === item.id ? (
                <ActivityIndicator size={14} color="#EF4444" />
              ) : (
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isLiked ? '#EF4444' : TEXT3}
                />
              )}
              <Text style={[styles.eventActionText, { color: isLiked ? '#EF4444' : TEXT3, fontWeight: isLiked ? '700' : '500' }]}>
                {likesCount > 0 ? likesCount : ''}
              </Text>
            </TouchableOpacity>

            <View style={[styles.actionDivider, { backgroundColor: BORDER }]} />

            {/* 💬 Comment */}
            <TouchableOpacity style={styles.eventActionBtn} onPress={handleComment} activeOpacity={0.7}>
              <Ionicons name="chatbubble-outline" size={19} color={TEXT3} />
              <Text style={[styles.eventActionText, { color: TEXT3 }]}>
                {commentsCount > 0 ? commentsCount : ''}
              </Text>
            </TouchableOpacity>

            <View style={[styles.actionDivider, { backgroundColor: BORDER }]} />

            {/* ↗ Share */}
            <TouchableOpacity style={styles.eventActionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-social-outline" size={20} color={TEXT3} />
              <Text style={[styles.eventActionText, { color: TEXT3 }]}>
                {sharesCount > 0 ? sharesCount : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  const renderEmpty = (icon: string, title: string, sub: string) => (
    <View style={[styles.emptyState, { backgroundColor: SURF, borderColor: BORDER }]}>
      <View style={[styles.emptyIconBg, { backgroundColor: colors.primaryContainer }]}>
        <Ionicons name={icon as any} size={36} color={G} />
      </View>
      <Text style={[styles.emptyTitle, { color: TEXT }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: TEXT3 }]}>{sub}</Text>
    </View>
  );

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'members':
        if (membersLoading && members.length === 0) return (
          <ScrollView contentContainerStyle={styles.listContent}>
            {Array.from({ length: 6 }).map((_, i) => <MemberSkeleton key={i} />)}
          </ScrollView>
        );
        return (
          <FlashList
            data={filteredMembers}
            renderItem={renderMemberCard}
            keyExtractor={(item: any) => item.id}
            estimatedItemSize={120}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderSearchHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={G} colors={[G]} />}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={() => renderEmpty('people-outline', 'No Members Found', 'Try adjusting your search or filters.')}
          />
        );

      case 'communities':
        if (commsLoading && communities.length === 0) return (
          <ScrollView contentContainerStyle={styles.listContent}>
            {Array.from({ length: 4 }).map((_, i) => <CommunitySkeleton key={i} />)}
          </ScrollView>
        );
        return (
          <FlatList
            data={filteredCommunities}
            renderItem={({ item }: { item: any }) => renderCommunityCard({ item })}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderSearchHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={G} colors={[G]} />}
            ListEmptyComponent={() => renderEmpty('globe-outline', 'No Communities Found', 'Try a different search or community type.')}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        );

      case 'feed':
        return (
          <FlatList
            data={filteredPosts}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onCommentPress={(id) => {
                  setSelectedPostId(id);
                  setCommentSheetVisible(true);
                }}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderSearchHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={G} colors={[G]} />}
            ListEmptyComponent={() => renderEmpty('newspaper-outline', 'No Posts Found', 'Try searching for different keywords.')}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          />
        );

      case 'events':
        if (eventsLoading && events.length === 0) return (
          <ScrollView contentContainerStyle={styles.listContent}>
            {Array.from({ length: 3 }).map((_, i) => <EventSkeleton key={i} />)}
          </ScrollView>
        );
        return (
          <FlatList
            data={filteredEvents}
            renderItem={({ item }: { item: any }) => renderEventCard({ item })}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderSearchHeader}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={G} colors={[G]} />}
            ListEmptyComponent={() => renderEmpty('calendar-outline', 'No Events Found', 'Try changing the filter or search term.')}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        );
    }
  };

  // ── Sub-filter row (below tabs, specific per tab) ──────────────────────────
  const renderSubFilters = () => {
    if (activeTab === 'events') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersScroll}>
          {EVENT_FILTERS.map((f) => {
            const active = selectedEventFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setSelectedEventFilter(f)}
                style={[styles.subFilterChip, {
                  backgroundColor: active ? G : SURF,
                  borderColor: active ? G : BORDER,
                }]}
              >
                <Text style={[styles.subFilterText, { color: active ? '#FFF' : TEXT3 }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }
    if (activeTab === 'communities') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersScroll}>
          {COMMUNITY_TYPES.map((t) => {
            const active = selectedCommType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedCommType(t)}
                style={[styles.subFilterChip, {
                  backgroundColor: active ? G : SURF,
                  borderColor: active ? G : BORDER,
                }]}
              >
                <Text style={[styles.subFilterText, { color: active ? '#FFF' : TEXT3 }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }
    return null;
  };

  // ── Search header (injected as ListHeader) ─────────────────────────────────
  const renderSearchHeader = () => (
    <View>
      {renderSubFilters()}
      <View style={styles.resultCountRow}>
        <Text style={[styles.resultCount, { color: TEXT3 }]}>
          {activeTab === 'members' && `${filteredMembers.length} members`}
          {activeTab === 'communities' && `${filteredCommunities.length} communities`}
          {activeTab === 'feed' && `${filteredPosts.length} posts`}
          {activeTab === 'events' && `${filteredEvents.length} events`}
        </Text>
        {debouncedSearch ? (
          <Text style={[styles.searchingFor, { color: G }]}>for "{debouncedSearch}"</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top }]}>

      {/* ── App Bar ─────────────────────────────────────────────────────── */}
      <View style={[styles.appBar, { backgroundColor: SURF, borderBottomColor: BORDER }]}>
        <View style={styles.appBarBrand}>
          <View style={[styles.logoMark, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="search" size={16} color={G} />
          </View>
          <Text style={[styles.appBarTitle, { color: TEXT }]}>Discover</Text>
        </View>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.elevation1 }]}>
          <Ionicons name="options-outline" size={20} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <View style={[styles.searchBarWrap, { backgroundColor: SURF, borderBottomColor: BORDER }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: isFocused ? G : 'transparent' }]}>
          <Ionicons name="search" size={18} color={isFocused ? G : TEXT3} style={{ marginRight: 8 }} />
          <TextInput
            ref={searchRef}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor={TEXT3}
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => { if (!searchText) setIsFocused(false); }}
            onSubmitEditing={() => commitSearch(searchText)}
            returnKeyType="search"
            style={[styles.searchInput, { color: TEXT }]}
          />
          {searchText.length > 0 ? (
            <TouchableOpacity onPress={clearSearch} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={TEXT3} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.micBtn, { backgroundColor: colors.elevation2 }]}>
              <Ionicons name="mic-outline" size={14} color={TEXT3} />
            </View>
          )}
        </View>
        {isFocused && searchText.length === 0 && (
          <TouchableOpacity onPress={() => { setIsFocused(false); searchRef.current?.blur(); }} style={{ paddingLeft: 10 }}>
            <Text style={[styles.cancelText, { color: G }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category Tab Bar ────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: SURF, borderBottomColor: BORDER }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => { setActiveTab(tab.id); setSelectedEventFilter('All'); setSelectedCommType('All'); }}
                style={[styles.tab, active && { borderBottomColor: G, borderBottomWidth: 2.5 }]}
              >
                <Ionicons name={tab.icon as any} size={16} color={active ? G : TEXT3} />
                <Text style={[styles.tabLabel, { color: active ? G : TEXT3, fontWeight: active ? '700' : '500' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Search overlay ──────────────────────────────────────────────── */}
      {isFocused && searchText.length === 0 && renderSearchOverlay()}

      {/* ── Main content ────────────────────────────────────────────────── */}
      {!(isFocused && searchText.length === 0) && renderTabContent()}

      {/* ── Comment Sheet ────────────────────────────────────────────────── */}
      <CommentSheet
        postId={selectedPostId}
        visible={commentSheetVisible}
        onClose={() => setCommentSheetVisible(false)}
      />

      {/* ── Event Comment Sheet ──────────────────────────────────────────── */}
      <EventCommentSheet
        eventId={selectedEventId}
        eventTitle={selectedEventTitle}
        visible={eventCommentSheetVisible}
        onClose={() => { setEventCommentSheetVisible(false); setSelectedEventId(null); }}
      />

      <EventShareSheet
        visible={!!shareSheetEvent}
        onClose={() => setShareSheetEvent(null)}
        eventTitle={shareSheetEvent?.title ?? ''}
        eventId={shareSheetEvent?.id ?? ''}
        shareUrl={`${API_BASE_URL.replace('/api/v1', '')}/explore?tab=events&event=${shareSheetEvent?.id ?? ''}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // App Bar
  appBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appBarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  appBarTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  filterBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Search Bar
  searchBarWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, height: 44, borderRadius: 14,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400', padding: 0 },
  micBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },

  // Tab Bar (underline style)
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabBarScroll: { paddingHorizontal: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 14 },

  // Sub-filters
  subFiltersScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  subFilterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  subFilterText: { fontSize: 13, fontWeight: '600' },

  // Result count
  resultCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  resultCount: { fontSize: 13, fontWeight: '500' },
  searchingFor: { fontSize: 13, fontWeight: '700' },

  // List content padding
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },

  // ── Search Overlay ─────────────────────────────────────────────────────────
  searchOverlay: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  searchSection: { marginBottom: 24 },
  searchSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  searchSectionTitle: { fontSize: 16, fontWeight: '700' },
  clearAllText: { fontSize: 13, fontWeight: '600' },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  recentIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  recentText: { flex: 1, fontSize: 15 },
  trendingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trendingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  trendingText: { fontSize: 13, fontWeight: '700' },
  tipsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  tipsText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // ── Member Card ────────────────────────────────────────────────────────────
  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  memberCardLeft: { position: 'relative' },
  memberAvatarRing: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2, overflow: 'hidden',
  },
  memberAvatar: { width: '100%', height: '100%' },
  memberBadgeDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  memberInfo: { flex: 1, gap: 4 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1 },
  memberBadgeText: { fontSize: 10, fontWeight: '700' },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberMetaText: { fontSize: 12, fontWeight: '400' },
  memberActions: { gap: 8, alignItems: 'center' },
  viewProfileBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  viewProfileText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  msgBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Skeleton for member
  memberCardSkeleton: { flexDirection: 'row', gap: 12, padding: 14 },

  // ── Community Card ─────────────────────────────────────────────────────────
  communityCard: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  communityBannerWrap: { height: COMM_BANNER_H, position: 'relative' },
  communityBanner: { width: '100%', height: COMM_BANNER_H },
  communityBannerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  categoryChip: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  categoryChipText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  communityAvatarWrap: {
    width: 52, height: 52, borderRadius: 14, borderWidth: 3,
    marginLeft: 16, marginTop: -26, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  communityAvatar: { width: '100%', height: '100%' },
  communityBody: { padding: 14, paddingTop: 10 },
  communityNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  communityName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
  joinedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  joinedChipText: { fontSize: 11, fontWeight: '700' },
  communityDesc: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  communityStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  commStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commStatText: { fontSize: 13, fontWeight: '500' },
  joinBtn: { paddingVertical: 11, borderRadius: 24, alignItems: 'center' },
  joinBtnText: { fontSize: 14, fontWeight: '700' },

  // Skeleton for community
  communityCardSkeleton: { borderRadius: 20, overflow: 'hidden' },

  // ── Event Card ─────────────────────────────────────────────────────────────
  eventCard: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  eventBannerWrap: { height: EVENT_BANNER_H, position: 'relative', overflow: 'hidden' },
  eventBanner: { width: '100%', height: EVENT_BANNER_H },
  eventBannerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)' },
  dateBadge: {
    position: 'absolute', top: 12, left: 12, zIndex: 10,
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  dateBadgeDay: { color: '#FFF', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  dateBadgeMonth: { color: '#FFF', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  eventTypeBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  eventTypeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  eventBody: { padding: 16, paddingTop: 16 },
  eventCategoryChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  eventCategoryText: { fontSize: 11, fontWeight: '700' },
  eventTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10, lineHeight: 22 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  eventMetaText: { fontSize: 13, fontWeight: '400' },
  eventActionsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  eventActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8,
  },
  actionDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  eventActionText: { fontSize: 13 },
  rsvpBtn: { paddingVertical: 11, borderRadius: 24, alignItems: 'center', marginTop: 12 },
  rsvpBtnText: { fontSize: 14, fontWeight: '700' },

  // Skeleton for event
  eventCardSkeleton: { borderRadius: 20, overflow: 'hidden' },

  // ── Empty State ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center', paddingVertical: 52,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    gap: 12, marginTop: 12,
  },
  emptyIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
});
