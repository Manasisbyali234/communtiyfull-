import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Dimensions, Platform, Animated, ActivityIndicator,
} from 'react-native';
import { shareUrl } from '../../../utils/shareUtils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { useToastStore } from '../../../store/toastStore';
import { useUserQuery, useUserPostsQuery } from '../../../api/feed';
import PostCard from '../../../components/feed/PostCard';
import CommentSheet from '../../../components/feed/CommentSheet';
import Skeleton from '../../../components/feedback/Skeleton';

const { width: SW } = Dimensions.get('window');

// ── Extended community profile data for other users ───────────────────────────
// Mapped by userId – enriches User with community-specific fields
const EXTENDED_PROFILES: Record<string, {
  village: string; district: string; state: string;
  occupation: string; memberSince: string;
  isVolunteer: boolean; isConnected: boolean;
  bannerUrl: string;
  mutualConnections: number;
  metrics: { label: string; value: string; emoji: string; color: string }[];
  badges: { label: string; icon: string; color: string }[];
  sharedCommunities: { name: string; icon: string }[];
}> = {
  user_2: {
    village: 'Mysuru Village', district: 'Mysuru', state: 'Karnataka',
    occupation: 'Software Engineer', memberSince: '2019',
    isVolunteer: true, isConnected: false,
    bannerUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80',
    mutualConnections: 12,
    metrics: [
      { label: 'Community',  value: '210', emoji: '🤝', color: '#2D6A2D' },
      { label: 'Events',     value: '22',  emoji: '🎉', color: '#F9A825' },
      { label: 'Volunteer',  value: '98h', emoji: '❤️', color: '#C62828' },
      { label: 'Since',      value: '2019',emoji: '📅', color: '#1565C0' },
    ],
    badges: [
      { label: 'Volunteer',        icon: 'shield-checkmark', color: '#2D6A2D' },
      { label: 'Event Organizer',  icon: 'calendar',          color: '#F9A825' },
    ],
    sharedCommunities: [
      { name: 'Gowda Sabha',  icon: 'people' },
      { name: 'Youth Club',   icon: 'rocket' },
    ],
  },
  user_3: {
    village: 'Hassan Village', district: 'Hassan', state: 'Karnataka',
    occupation: 'Agriculturist', memberSince: '2017',
    isVolunteer: false, isConnected: true,
    bannerUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80',
    mutualConnections: 6,
    metrics: [
      { label: 'Community',  value: '95',   emoji: '🤝', color: '#2D6A2D' },
      { label: 'Events',     value: '9',    emoji: '🎉', color: '#F9A825' },
      { label: 'Volunteer',  value: '30h',  emoji: '❤️', color: '#C62828' },
      { label: 'Since',      value: '2017', emoji: '📅', color: '#1565C0' },
    ],
    badges: [
      { label: 'Community Leader', icon: 'trophy', color: '#F9A825' },
    ],
    sharedCommunities: [
      { name: 'Gowda Sabha', icon: 'people' },
    ],
  },
  user_4: {
    village: 'Tumkur Village', district: 'Tumkur', state: 'Karnataka',
    occupation: 'Teacher', memberSince: '2020',
    isVolunteer: true, isConnected: false,
    bannerUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80',
    mutualConnections: 3,
    metrics: [
      { label: 'Community',  value: '58',   emoji: '🤝', color: '#2D6A2D' },
      { label: 'Events',     value: '5',    emoji: '🎉', color: '#F9A825' },
      { label: 'Volunteer',  value: '45h',  emoji: '❤️', color: '#C62828' },
      { label: 'Since',      value: '2020', emoji: '📅', color: '#1565C0' },
    ],
    badges: [
      { label: 'Volunteer', icon: 'shield-checkmark', color: '#2D6A2D' },
    ],
    sharedCommunities: [
      { name: 'Youth Club',   icon: 'rocket' },
      { name: 'Farmers Hub',  icon: 'leaf' },
    ],
  },
  user_5: {
    village: 'Ramanagara Village', district: 'Ramanagara', state: 'Karnataka',
    occupation: 'Farmer', memberSince: '2016',
    isVolunteer: false, isConnected: false,
    bannerUrl: 'https://images.unsplash.com/photo-1543393716-375f47996a77?w=800&auto=format&fit=crop&q=80',
    mutualConnections: 0,
    metrics: [
      { label: 'Community',  value: '145',  emoji: '🤝', color: '#2D6A2D' },
      { label: 'Events',     value: '18',   emoji: '🎉', color: '#F9A825' },
      { label: 'Volunteer',  value: '0h',   emoji: '❤️', color: '#C62828' },
      { label: 'Since',      value: '2016', emoji: '📅', color: '#1565C0' },
    ],
    badges: [],
    sharedCommunities: [],
  },
};

// Fallback for unknown users
const DEFAULT_EXTENDED = {
  village: 'Karnataka Village', district: 'Karnataka', state: 'Karnataka',
  occupation: 'Community Member', memberSince: '2020',
  isVolunteer: false, isConnected: false,
  bannerUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&auto=format&fit=crop&q=80',
  mutualConnections: 0,
  metrics: [
    { label: 'Community', value: '—', emoji: '🤝', color: '#2D6A2D' },
    { label: 'Events',    value: '—', emoji: '🎉', color: '#F9A825' },
  ],
  badges: [],
  sharedCommunities: [],
};

// ── Tab types ─────────────────────────────────────────────────────────────────
type ProfileTab = 'posts' | 'about' | 'community';
const TABS: { id: ProfileTab; label: string; icon: string }[] = [
  { id: 'posts',     label: 'Posts',     icon: 'grid-outline' },
  { id: 'about',     label: 'About',     icon: 'person-outline' },
  { id: 'community', label: 'Community', icon: 'people-outline' },
];

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const showToast = useToastStore((state) => state.showToast);
  const { data: user, isLoading: userLoading } = useUserQuery(id);
  const { data: userPosts = [], isLoading: postsLoading } = useUserPostsQuery(id);

  const extended = EXTENDED_PROFILES[id] || DEFAULT_EXTENDED;

  // Derived state: if already connected in mock data, initialise follow state
  const [connected, setConnected] = useState(extended.isConnected);

  const handleShare = useCallback(async () => {
    if (!user) return;
    const base = Platform.OS === 'web' && typeof window !== 'undefined' && window.location
      ? `${window.location.protocol}//${window.location.host}`
      : '';
    const link = `${base}/user/${user.id}`;
    const ok = await shareUrl(
      `Check out ${user.displayName}'s profile on GowdaCommunity! ${link}`,
      link
    );
    showToast(ok ? 'Link copied to clipboard!' : 'Could not share profile', ok ? 'success' : 'error');
  }, [user, showToast]);

  // Token shortcuts
  const G = colors.primary;
  const SAFFRON = colors.saffron || '#FF6F00';
  const BG = colors.background;
  const SURF = colors.surface;
  const BORDER = colors.border;
  const TEXT = colors.text;
  const TEXT2 = colors.textSecondary;
  const TEXT3 = colors.textMuted;

  // Animated nav opacity based on scroll
  const navBgOpacity = scrollY.interpolate({
    inputRange: [100, 160],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (userLoading) {
    return (
      <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top }]}>
        <View style={[styles.navbar, { borderBottomColor: BORDER }]}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.navIconBtn}>
            <Ionicons name="arrow-back" size={24} color={TEXT} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: TEXT }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Skeleton width="100%" height={180} borderRadius={0} />
          <View style={{ alignItems: 'center', marginTop: -52 }}>
            <Skeleton width={96} height={96} borderRadius={48} />
          </View>
          <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
            <Skeleton width="50%" height={24} borderRadius={6} />
            <Skeleton width="35%" height={16} borderRadius={6} />
            <Skeleton width="60%" height={14} borderRadius={6} />
            <Skeleton width="75%" height={14} borderRadius={6} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: BG, paddingTop: insets.top }]}>
        <Ionicons name="person-circle-outline" size={72} color={TEXT3} />
        <Text style={[styles.notFoundTitle, { color: TEXT }]}>Member Not Found</Text>
        <Text style={[styles.notFoundSub, { color: TEXT3 }]}>This profile may have been removed.</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={[styles.backBtn, { backgroundColor: G }]}>
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const memberSinceYear = new Date(user.joinedAt || new Date().toISOString()).getFullYear();

  return (
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top }]}>

      {/* ── Animated App Bar ─────────────────────────────────────────────── */}
      <Animated.View style={[styles.navbar, { borderBottomColor: BORDER }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SURF, opacity: navBgOpacity }]} />
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: TEXT }]} numberOfLines={1}>{user.displayName}</Text>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={22} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Cover Photo ─────────────────────────────────────────────── */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: extended.bannerUrl }} style={styles.coverImage} contentFit="cover" />
          <View style={styles.coverOverlay} />
        </View>

        {/* ── Avatar + Badges ──────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRingOuter, { borderColor: BG, backgroundColor: BG }]}>
            <View style={[styles.avatarRingInner, { borderColor: G }]}>
              <Image
                source={{ uri: user.avatarUrl || 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150' }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            </View>
          </View>

          {extended.isVolunteer && (
            <View style={[styles.volunteerBadge, { backgroundColor: G, borderColor: BG }]}>
              <Ionicons name="shield-checkmark" size={11} color="#FFF" />
              <Text style={styles.volunteerText}>Active Volunteer</Text>
            </View>
          )}
        </View>

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <View style={styles.identityBlock}>
          <Text style={[styles.profileName, { color: TEXT }]}>{user.displayName}</Text>
          <Text style={[styles.username, { color: TEXT3 }]}>@{user.username}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color={SAFFRON} />
            <Text style={[styles.locationText, { color: TEXT2 }]}>
              {extended.village}, {extended.district}, {extended.state}
            </Text>
          </View>

          {/* Occupation chip */}
          <View style={[styles.occupationChip, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="briefcase-outline" size={13} color={G} />
            <Text style={[styles.occupationText, { color: colors.primaryDark || G }]}>
              {extended.occupation}
            </Text>
          </View>

          {/* Bio */}
          {user.bio ? (
            <>
              <Text style={[styles.bio, { color: TEXT2 }]} numberOfLines={bioExpanded ? undefined : 2}>
                {user.bio}
              </Text>
              {!bioExpanded && user.bio.length > 80 && (
                <TouchableOpacity onPress={() => setBioExpanded(true)}>
                  <Text style={[styles.readMoreText, { color: G }]}>Read more</Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}

          {/* Mutual connections */}
          {extended.mutualConnections > 0 && (
            <View style={[styles.mutualRow, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="people-outline" size={14} color={G} />
              <Text style={[styles.mutualText, { color: G }]}>
                {extended.mutualConnections} mutual connections
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats Row ────────────────────────────────────────────────── */}
        <View style={[styles.statsRow, { backgroundColor: SURF, borderColor: BORDER }]}>
          <React.Fragment>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: TEXT }]}>{user.followersCount || 0}</Text>
              <Text style={[styles.statLabel, { color: TEXT2 }]}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: TEXT }]}>{user.followingCount || 0}</Text>
              <Text style={[styles.statLabel, { color: TEXT2 }]}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: TEXT }]}>{user.communitiesCount || 0}</Text>
              <Text style={[styles.statLabel, { color: TEXT2 }]}>Communities</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: TEXT }]}>{memberSinceYear}</Text>
              <Text style={[styles.statLabel, { color: TEXT2 }]}>Since</Text>
            </View>
          </React.Fragment>
        </View>

        {/* ── Recognition Badges ───────────────────────────────────────── */}
        {extended.badges.length > 0 && (
          <View style={styles.badgesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
              {extended.badges.map((badge, i) => (
                <View key={i} style={[styles.badgeCard, { backgroundColor: badge.color + '15', borderColor: badge.color + '30' }]}>
                  <Ionicons name={badge.icon as any} size={18} color={badge.color} />
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Action Buttons ───────────────────────────────────────────── */}
        <View style={styles.actionRow}>
          {/* Connect / Connected */}
          <TouchableOpacity
            style={[
              styles.btnPrimary,
              { backgroundColor: connected ? colors.primaryContainer : G },
            ]}
            onPress={() => setConnected(!connected)}
          >
            <Ionicons
              name={connected ? 'checkmark-circle-outline' : 'person-add-outline'}
              size={18}
              color={connected ? G : '#FFF'}
            />
            <Text style={[styles.btnPrimaryText, { color: connected ? G : '#FFF' }]}>
              {connected ? 'Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>

          {/* Message */}
          <TouchableOpacity
            style={[styles.btnSecondary, { backgroundColor: SURF, borderColor: BORDER }]}
            onPress={() => router.push(`/chat/${user.username}` as any)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={TEXT} />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={[styles.btnSecondary, { backgroundColor: SURF, borderColor: BORDER }]}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={18} color={TEXT} />
          </TouchableOpacity>
        </View>

        {/* ── Shared Communities Banner ─────────────────────────────── */}
        {extended.sharedCommunities.length > 0 && (
          <View style={[styles.sharedCard, { backgroundColor: colors.primaryContainer, borderColor: colors.border }]}>
            <Ionicons name="people-circle-outline" size={20} color={G} />
            <Text style={[styles.sharedText, { color: G }]}>
              You both are in{' '}
              <Text style={{ fontWeight: '800' }}>
                {extended.sharedCommunities.map((c) => c.name).join(' & ')}
              </Text>
            </Text>
          </View>
        )}

        {/* ── Tab Bar ─────────────────────────────────────────────────── */}
        <View style={[styles.tabBar, { backgroundColor: SURF, borderColor: BORDER }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tab,
                    active
                      ? { backgroundColor: colors.primaryContainer, borderColor: G }
                      : { backgroundColor: 'transparent', borderColor: 'transparent' },
                  ]}
                >
                  <Ionicons name={tab.icon as any} size={15} color={active ? G : TEXT3} />
                  <Text style={[styles.tabLabel, { color: active ? G : TEXT3, fontWeight: active ? '700' : '500' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Tab Content ──────────────────────────────────────────────── */}
        <View style={styles.contentArea}>

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            postsLoading ? (
              <View style={{ gap: 12 }}>
                {[1, 2].map((i) => (
                  <View key={i} style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                      <Skeleton width={44} height={44} borderRadius={22} />
                      <View style={{ flex: 1, gap: 8 }}>
                        <Skeleton width="45%" height={14} borderRadius={6} />
                        <Skeleton width="25%" height={10} borderRadius={6} />
                      </View>
                    </View>
                    <Skeleton width="100%" height={200} borderRadius={14} />
                  </View>
                ))}
              </View>
            ) : userPosts.length > 0 ? (
              <View style={{ gap: 10 }}>
                {userPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onCommentPress={(postId) => {
                      setSelectedPostId(postId);
                      setCommentSheetVisible(true);
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: SURF, borderColor: BORDER }]}>
                <Ionicons name="document-text-outline" size={52} color={TEXT3} />
                <Text style={[styles.emptyTitle, { color: TEXT }]}>No Posts Yet</Text>
                <Text style={[styles.emptySub, { color: TEXT3 }]}>
                  {user.displayName} hasn't shared anything yet.
                </Text>
              </View>
            )
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <View style={{ gap: 14 }}>
              {/* Community Metrics */}
              <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                <Text style={[styles.cardTitle, { color: TEXT }]}>Community Metrics</Text>
                <View style={styles.metricsGrid}>
                  {extended.metrics.map((m, i) => (
                    <View key={i} style={[styles.metricCell, { backgroundColor: m.color + '10', borderColor: m.color + '25' }]}>
                      <Text style={styles.metricEmoji}>{m.emoji}</Text>
                      <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                      <Text style={[styles.metricLabel, { color: TEXT3 }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Personal Details */}
              <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                <Text style={[styles.cardTitle, { color: TEXT }]}>Personal Details</Text>
                {[
                  { icon: 'home-outline',       label: 'Native Village', value: extended.village },
                  { icon: 'location-outline',    label: 'District',       value: `${extended.district}, ${extended.state}` },
                  { icon: 'briefcase-outline',   label: 'Occupation',     value: extended.occupation },
                  { icon: 'calendar-outline',    label: 'Member Since',   value: extended.memberSince },
                  { icon: 'people-outline',      label: 'Communities',    value: (user.communitiesCount || 0).toString() },
                ].map((row, i, arr) => (
                  <View
                    key={i}
                    style={[
                      styles.detailRow,
                      { borderBottomColor: BORDER, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0 },
                    ]}
                  >
                    <View style={[styles.detailIcon, { backgroundColor: colors.primaryContainer }]}>
                      <Ionicons name={row.icon as any} size={16} color={G} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailLabel, { color: TEXT3 }]}>{row.label}</Text>
                      <Text style={[styles.detailValue, { color: TEXT }]}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* COMMUNITY TAB */}
          {activeTab === 'community' && (
            <View style={{ gap: 14 }}>
              {/* Shared communities */}
              {extended.sharedCommunities.length > 0 ? (
                <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                  <Text style={[styles.cardTitle, { color: TEXT }]}>Shared Communities</Text>
                  {extended.sharedCommunities.map((comm, i, arr) => (
                    <View
                      key={i}
                      style={[
                        styles.commRow,
                        { borderBottomColor: BORDER, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0 },
                      ]}
                    >
                      <View style={[styles.commIcon, { backgroundColor: colors.primaryContainer }]}>
                        <Ionicons name={comm.icon as any} size={20} color={G} />
                      </View>
                      <Text style={[styles.commName, { color: TEXT }]}>{comm.name}</Text>
                      <View style={[styles.memberChip, { backgroundColor: colors.primaryContainer }]}>
                        <Text style={[styles.memberChipText, { color: G }]}>Member</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: SURF, borderColor: BORDER }]}>
                  <Ionicons name="people-outline" size={52} color={TEXT3} />
                  <Text style={[styles.emptyTitle, { color: TEXT }]}>No Shared Communities</Text>
                  <Text style={[styles.emptySub, { color: TEXT3 }]}>You don't share any communities yet.</Text>
                </View>
              )}

              {/* Recognition badges */}
              {extended.badges.length > 0 && (
                <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                  <Text style={[styles.cardTitle, { color: TEXT }]}>Recognition & Badges</Text>
                  <View style={styles.badgesGrid}>
                    {extended.badges.map((badge, i) => (
                      <View key={i} style={[styles.badgeGridCell, { backgroundColor: badge.color + '12', borderColor: badge.color + '30' }]}>
                        <View style={[styles.badgeIconRing, { backgroundColor: badge.color + '20' }]}>
                          <Ionicons name={badge.icon as any} size={24} color={badge.color} />
                        </View>
                        <Text style={[styles.badgeGridText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Comment Sheet ─────────────────────────────────────────────── */}
      <CommentSheet
        postId={selectedPostId}
        visible={commentSheetVisible}
        onClose={() => setCommentSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  // ── App Bar ─────────────────────────────────────────────────────────────────
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  navRight: { flexDirection: 'row' },
  navIconBtn: { padding: 8 },

  // ── Cover ────────────────────────────────────────────────────────────────────
  coverContainer: { height: 180, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.15)' },

  // ── Avatar ───────────────────────────────────────────────────────────────────
  avatarSection: { alignItems: 'center', marginTop: -52, marginBottom: 8 },
  avatarRingOuter: {
    padding: 4, borderRadius: 62,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  avatarRingInner: { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  volunteerBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, gap: 5, borderWidth: 2.5, marginTop: 8,
  },
  volunteerText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  // ── Identity ─────────────────────────────────────────────────────────────────
  identityBlock: { paddingHorizontal: 24, alignItems: 'center', marginBottom: 16 },
  profileName: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 2, textAlign: 'center' },
  username: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationText: { fontSize: 13, fontWeight: '500' },
  occupationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 12,
  },
  occupationText: { fontSize: 13, fontWeight: '700' },
  bio: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 6 },
  readMoreText: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  mutualRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 8,
  },
  mutualText: { fontSize: 13, fontWeight: '700' },

  // ── Stats Row ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statDivider: { width: 1, height: 28 },

  // ── Badges ────────────────────────────────────────────────────────────────────
  badgesSection: { marginBottom: 12 },
  badgesScroll: { paddingHorizontal: 16, gap: 10 },
  badgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },

  // ── Actions ───────────────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 24, gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#2D6A2D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    width: 48, height: 48, alignItems: 'center',
    justifyContent: 'center', borderRadius: 24, borderWidth: 1.5,
  },

  // ── Shared Communities Banner ─────────────────────────────────────────────────
  sharedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1,
  },
  sharedText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // ── Tab Bar ───────────────────────────────────────────────────────────────────
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  tabScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  tabLabel: { fontSize: 13 },

  // ── Content Area ──────────────────────────────────────────────────────────────
  contentArea: { paddingHorizontal: 16 },
  card: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 2,
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 16 },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCell: {
    width: '47%', borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 4,
  },
  metricEmoji: { fontSize: 22 },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Detail rows
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14 },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600' },

  // Community rows
  commRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  commIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  commName: { flex: 1, fontSize: 15, fontWeight: '600' },
  memberChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  memberChipText: { fontSize: 12, fontWeight: '700' },

  // Badge grid
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeGridCell: {
    width: '47%', padding: 16, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', gap: 10,
  },
  badgeIconRing: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badgeGridText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  // Empty state
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 48, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    gap: 10, paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Not found screen
  notFoundTitle: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  notFoundSub: { fontSize: 15, marginTop: 6, marginBottom: 24 },
  backBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
});
