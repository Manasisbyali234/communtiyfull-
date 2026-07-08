import { Ionicons } from '@expo/vector-icons';
import { FlashList as ShopifyFlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet, Text,
  TouchableOpacity,
  View,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunitiesQuery } from '../../api/community';
import { usePostsQuery } from '../../api/feed';
import { useEventsQuery } from '../../api/event';
import { useUnreadCountQuery } from '../../api/chat';
import { useStoriesFeedQuery, StoryGroup } from '../../api/story';
import CommentSheet from '../../components/feed/CommentSheet';
import ForwardSheet from '../../components/feed/ForwardSheet';
import PostCard from '../../components/feed/PostCard';
import Skeleton from '../../components/feedback/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme';
const FlashList = ShopifyFlashList as any;


// Quick action shortcut definition
const QUICK_ACTIONS = [
  { id: 'post', icon: 'create-outline', label: 'New Post', color: '#2D6A2D', route: '/(tabs)/create' },
  { id: 'members', icon: 'people-outline', label: 'Members', color: '#E65100', route: '/(tabs)/explore' },
  { id: 'events', icon: 'calendar-outline', label: 'Events', color: '#F9A825', route: '/(tabs)/explore?tab=events' },
  { id: 'village', icon: 'home-outline', label: 'My Village', color: '#5D4037', route: '/(tabs)/profile' },
];


export default function HomeFeed() {
  const { colors, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { width: screenWidth } = useWindowDimensions();
  const eventCardWidth = Math.min(220, screenWidth * 0.58);
  const isSmallScreen = screenWidth < 360;

  const { data: posts = [], isLoading, refetch } = usePostsQuery();
  const { data: communities = [] } = useCommunitiesQuery();
  const { data: events = [] } = useEventsQuery();
  const { data: unreadCount = 0 } = useUnreadCountQuery();
  const { data: storyGroups = [] } = useStoriesFeedQuery();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);
  const [selectedForwardPostId, setSelectedForwardPostId] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleCommentPress = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setCommentSheetVisible(true);
  }, []);

  const handleForwardPress = useCallback((postId: string) => {
    setSelectedForwardPostId(postId);
    setForwardSheetVisible(true);
  }, []);

  const renderPostItem = useCallback(({ item }: { item: any }) => (
    <PostCard post={item} onCommentPress={handleCommentPress} onForwardPress={handleForwardPress} />
  ), [handleCommentPress, handleForwardPress]);

  const joinedCommunities = useMemo(() => communities.filter((c) => c.isJoined), [communities]);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  const renderSkeletonLoader = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {[1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.skeletonHeader}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Skeleton width="45%" height={14} style={{ marginBottom: 8 }} />
              <Skeleton width="25%" height={10} />
            </View>
          </View>
          <Skeleton width="100%" height={15} style={{ marginBottom: 8 }} />
          <Skeleton width="75%" height={15} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={220} borderRadius={16} />
        </View>
      ))}
    </ScrollView>
  );

  // ── Stories Row ─────────────────────────────────────────────────────────
  const renderStoriesRow = () => (
    <View style={[styles.storiesContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
        {/* My Story / Add */}
        <TouchableOpacity style={styles.storyItem} onPress={() => router.push('/story/add')}>
          <View style={[styles.storyRingAdd, { borderColor: colors.primary, backgroundColor: colors.elevation1 }]}>
            <Image
              source={{ uri: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80' }}
              style={styles.storyAvatar}
              contentFit="cover"
            />
            <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={12} color="#FFF" />
            </View>
          </View>
          <Text style={[styles.storyLabel, { color: colors.textMuted }]}>Your Story</Text>
        </TouchableOpacity>

        {storyGroups.map((group: StoryGroup) => (
          <TouchableOpacity key={group.user.id} style={styles.storyItem} onPress={() => router.push(`/story/${group.stories[0].id}` as any)}>
            <View style={[
              styles.storyRing,
              { borderColor: group.hasUnseen ? colors.primary : colors.border }
            ]}>
              <Image source={group.user.avatarUrl ? { uri: group.user.avatarUrl } : require('../../../assets/images/favicon.png')} style={styles.storyAvatar} contentFit="cover" />
            </View>
            <Text style={[styles.storyLabel, { color: colors.textMuted }]} numberOfLines={1}>{group.user.displayName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Welcome Banner ───────────────────────────────────────────────────────
  const renderWelcomeBanner = () => (
    <View style={[styles.welcomeBanner, { backgroundColor: colors.primaryContainer }]}>
      <View style={styles.welcomeLeaf1}>
        <Ionicons name="leaf" size={40} color={colors.primary + '30'} />
      </View>
      <View style={styles.welcomeLeaf2}>
        <Ionicons name="leaf" size={60} color={colors.primary + '20'} />
      </View>
      <View style={styles.welcomeContent}>
        <Text style={[styles.welcomeGreeting, { color: colors.primaryDark, fontSize: isSmallScreen ? 16 : 20 }]}>
          {getGreeting()}, {user?.displayName?.split(' ')[0] || 'Member'} 🙏
        </Text>
        <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
          {joinedCommunities.length} communities • Kodagu District
        </Text>
      </View>
      <View style={[styles.welcomeTag, { backgroundColor: colors.primary }]}>
        <Ionicons name="shield-checkmark" size={14} color="#FFF" />
        <Text style={styles.welcomeTagText}>Verified Member</Text>
      </View>
    </View>
  );

  // ── Upcoming Events ──────────────────────────────────────────────────────
  const upcomingEvents = useMemo(() =>
    events.filter((e: any) => new Date(e.startsAt) >= new Date()).slice(0, 5),
  [events]);

  const renderUpcomingEvents = () => {
    if (upcomingEvents.length === 0) return null;
    return (
      <View style={styles.eventsSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Events</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore?tab=events' as any)}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsScroll}>
          {upcomingEvents.map((event: any) => {
            const dateStr = new Date(event.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = new Date(event.startsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border, width: eventCardWidth }]}
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/explore?tab=events' as any)}
              >
                {/* Banner */}
                <View style={styles.eventBannerWrap}>
                  {event.coverUrl && !event.coverUrl.startsWith('blob:') ? (
                    <Image
                      source={{ uri: event.coverUrl }}
                      style={styles.eventBanner}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.eventBanner, { backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="calendar-outline" size={40} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.eventBannerOverlay} />
                  {/* Date badge */}
                  <View style={[styles.eventDateBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.eventDateDay}>{dateStr.split(' ')[1]}</Text>
                    <Text style={styles.eventDateMonth}>{dateStr.split(' ')[0]}</Text>
                  </View>
                  {/* RSVP chip */}
                  {event.userRsvpStatus === 'GOING' && (
                    <View style={[styles.rsvpChip, { backgroundColor: colors.success }]}>
                      <Ionicons name="checkmark-circle" size={11} color="#FFF" />
                      <Text style={styles.rsvpChipText}>Going</Text>
                    </View>
                  )}
                </View>

                {/* Body */}
                <View style={styles.eventBody}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={[styles.eventMetaText, { color: colors.textSecondary }]}>{dateStr} • {timeStr}</Text>
                  </View>
                  {event.location ? (
                    <View style={styles.eventMeta}>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.eventMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{event.location}</Text>
                    </View>
                  ) : null}
                  <View style={styles.eventFooter}>
                    <View style={styles.eventRsvpRow}>
                      <Ionicons name="people-outline" size={14} color={colors.primary} />
                      <Text style={[styles.eventRsvpCount, { color: colors.primary }]}>{event.rsvpCount}</Text>
                    </View>
                    <View style={[styles.eventTag, { backgroundColor: colors.primaryContainer }]}>
                      <Text style={[styles.eventTagText, { color: colors.primary }]}>Upcoming</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ── Quick Actions ────────────────────────────────────────────────────────
  const renderQuickActions = () => (
    <View style={styles.quickActionsSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsRow}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.id}
            onPress={() => router.push(action.route as any)}
            activeOpacity={0.75}
            style={styles.quickActionItem}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15', width: isSmallScreen ? 46 : 56, height: isSmallScreen ? 46 : 56 }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ── Header ──────────────────────────────────────────────────────────────
  const FeedHeader = (
    <View>
      {renderStoriesRow()}
      {renderWelcomeBanner()}
      {renderQuickActions()}
      {renderUpcomingEvents()}
      <View style={styles.feedDivider}>
        <Text style={[styles.feedTitle, { color: colors.text }]}>Community Feed</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* ── M3 Top App Bar ────────────────────────────────────────────── */}
      <Animated.View style={[styles.appBarShadow, { opacity: headerOpacity, backgroundColor: colors.surface }]} />
      <View style={[styles.appBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Logo + Brand */}
        <View style={styles.appBarBrand}>
          <View style={[styles.logoMark, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="leaf" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.appBarTitle, { color: colors.text, fontSize: isSmallScreen ? 15 : 18 }]}>
              Gowda<Text style={{ color: colors.primary }}> Community</Text>
            </Text>
            <Text style={[styles.appBarSub, { color: colors.textMuted }]}>Kodagu District</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.appBarActions}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.appBarBtn, { backgroundColor: colors.elevation1 }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: colors.secondary }]}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/chat')}
            style={[styles.appBarBtn, { backgroundColor: colors.elevation1 }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Feed Content ─────────────────────────────────────────────── */}
      {isLoading ? (
        renderSkeletonLoader()
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPostItem}
          estimatedItemSize={480}
          ListHeaderComponent={FeedHeader}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>No posts yet. Join a community to see posts!</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* ── Comments Drawer ─────────────────────────────────────────── */}
      <CommentSheet
        postId={selectedPostId}
        visible={commentSheetVisible}
        onClose={() => setCommentSheetVisible(false)}
      />

      <ForwardSheet
        postId={selectedForwardPostId}
        visible={forwardSheetVisible}
        onClose={() => setForwardSheetVisible(false)}
        onNativeShare={async () => {
          const post = posts.find((p: any) => p.id === selectedForwardPostId);
          if (post) {
            try {
              await Share.share({
                message: `${post.author.displayName} in ${post.community?.name || 'Community'}: "${post.content}"`,
              });
            } catch (_) {}
          }
        }}
      />
    </View>
  );
}

// Utility: contextual greeting
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── App Bar ──────────────────────────────────────────────────────────────
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  appBarShadow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    zIndex: 9,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  appBarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  appBarTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  appBarSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appBarBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  notifBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Stories ──────────────────────────────────────────────────────────────
  storiesContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -12,
    marginTop: -8,
    marginBottom: 12,
  },
  storiesScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  storyItem: { alignItems: 'center', width: 62 },
  storyRing: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2.5, padding: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  storyRingAdd: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2.5, borderStyle: 'dashed', padding: 2,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  storyAvatar: { width: 48, height: 48, borderRadius: 24 },
  addBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  storyLabel: { fontSize: 11, fontWeight: '500', marginTop: 5, textAlign: 'center', width: '100%' },

  // ── Welcome Banner ─────────────────────────────────────────────────────
  welcomeBanner: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  welcomeLeaf1: { position: 'absolute', top: -8, right: 20 },
  welcomeLeaf2: { position: 'absolute', bottom: -16, left: -10 },
  welcomeContent: { position: 'relative', zIndex: 1 },
  welcomeGreeting: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  welcomeSub: { fontSize: 13, fontWeight: '500' },
  welcomeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginTop: 12,
  },
  welcomeTagText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // ── Quick Actions ────────────────────────────────────────────────────────
  quickActionsSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 12 },
  quickActionsRow: { flexDirection: 'row', gap: 10 },
  quickActionItem: { flex: 1, alignItems: 'center', gap: 8 },
  quickActionIcon: {
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // ── Feed Divider ─────────────────────────────────────────────────────────
  feedDivider: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feedTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },

  // ── Upcoming Events ────────────────────────────────────────────────────────
  eventsSection: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
  eventsScroll: { gap: 12, paddingRight: 4 },
  eventCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  eventBannerWrap: { height: 130, position: 'relative', backgroundColor: '#E0E0E0' },
  eventBanner: { width: '100%', height: '100%' },
  eventBannerOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  eventDateBadge: {
    position: 'absolute', left: 10, bottom: -14,
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
      android: { elevation: 4 },
    }),
  },
  eventDateDay: { color: '#FFF', fontSize: 16, fontWeight: '900', lineHeight: 18 },
  eventDateMonth: { color: '#FFF', fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  rsvpChip: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  rsvpChipText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  eventBody: { padding: 12, paddingTop: 20 },
  eventTitle: { fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 6 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  eventMetaText: { fontSize: 12, flex: 1 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  eventRsvpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventRsvpCount: { fontSize: 12, fontWeight: '600' },
  eventTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  eventTagText: { fontSize: 11, fontWeight: '700' },

  // ── Skeleton ─────────────────────────────────────────────────────────────
  skeletonCard: {
    padding: 16, borderWidth: 1, borderRadius: 20,
    marginBottom: 12, overflow: 'hidden',
  },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
});
