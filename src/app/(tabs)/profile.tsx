import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions, Platform,
  Pressable,
  ScrollView,
  StyleSheet, Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PostCard from '../../components/feed/PostCard';
import ForwardSheet from '../../components/feed/ForwardSheet';
import { useTheme } from '../../theme';
import { Post } from '../../types';
import { useToastStore } from '../../store/toastStore';
import { useUserPostsQuery } from '../../api/feed';
import { useNotificationsQuery } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';
import { useEventsQuery } from '../../api/event';
import { apiClient } from '../../api/client';
import { useUnreadCountQuery } from '../../api/chat';
import { useMyConnectionCountQuery, useConnectionSocket } from '../../api/connections';
import { shareAppLink } from '../../utils/shareUtils';

const { width: SW } = Dimensions.get('window');

type ProfileTab = 'posts' | 'updates' | 'events' | 'family' | 'about';

const COVER_HEIGHT = 240;

// ── Mock Profile Data ─────────────────────────────────────────────────────────
const PROFILE = {
  name: 'Ramesh Gowda',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  bannerUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&auto=format&fit=crop&q=80',
  village: 'Kodagu Village',
  district: 'Kodagu District',
  state: 'Karnataka',
  bio: 'Proud member of the Gowda community dedicated to preserving our rich traditions and supporting local farming initiatives. Active volunteer for village development.',
  taluk: 'Kodagu',
  districtShort: 'Kodagu',
  occupation: 'Agriculturist',
  languages: 'Kannada, English',
  interests: 'Agriculture, Culture, Volunteering',
  memberSince: '2018',
  isActiveVolunteer: true,
  metrics: [
    { label: 'Native Village', value: 'Kodagu', emoji: '🏠', color: '#5D4037' },
    { label: 'Family Conn.', value: '26', emoji: '👨‍👩‍👧‍👦', color: '#E65100' },
    { label: 'Community', value: '183', emoji: '🤝', color: '#2D6A2D' },
    { label: 'Events', value: '15', emoji: '🎉', color: '#F9A825' },
    { label: 'Contributions', value: '32', emoji: '👥', color: '#1565C0' },
    { label: 'Recognition', value: 'Leader', emoji: '🏆', color: '#F9A825' },
    { label: 'Member Since', value: '2018', emoji: '📅', color: '#6A1B9A' },
    { label: 'Volunteering', value: '145h', emoji: '❤️', color: '#C62828' },
  ],
  upcomingEvent: {
    title: 'Gowda Sangha Sammelana 2025',
    venue: 'Kodagu Convention Hall, Kodagu',
    date: '15 June 2025  •  10:00 AM',
  },
  contributionSummary: [
    { emoji: '❤️', value: '145', label: 'Volunteer\nHours', color: '#C62828', bg: '#FFEBEE' },
    { emoji: '👥', value: '18', label: 'Community\nService', color: '#2E7D32', bg: '#E8F5E9' },
    { emoji: '🎉', value: '12', label: 'Events\nAttended', color: '#E65100', bg: '#FBE9E7' },
    { emoji: '🏆', value: '3', label: 'Awards\nReceived', color: '#6A1B9A', bg: '#F3E5F5' },
  ],
  recentPost: {
    content: 'Participated in the village tree plantation drive 🌳\nTogether we can make our village greener and better for future generations. #GowdaCommunity #GreenKodagu',
    images: [
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=200&auto=format&fit=crop&q=80',
    ],
    appreciated: 23,
    comments: 8,
    time: '2026-06-27T10:00:00Z',
  },
};

const TABS: { id: ProfileTab; label: string; icon: string }[] = [
  { id: 'posts', label: 'Posts', icon: 'grid-outline' },
  { id: 'about', label: 'About', icon: 'person-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
  { id: 'family', label: 'Family', icon: 'people-outline' },
  { id: 'updates', label: 'Updates', icon: 'megaphone-outline' },
];

function UpdatesTab() {
  const { colors } = useTheme();
  const { data: notifications = [], isLoading } = useNotificationsQuery();
  const SURF = colors.surface;
  const BORDER = colors.border;
  const TEXT = colors.text;
  const TEXT3 = colors.textMuted;
  const G = colors.primary;

  const getIcon = (type: string): { icon: string; color: string } => {
    switch (type) {
      case 'LIKE': return { icon: 'heart-outline', color: '#C62828' };
      case 'COMMENT': return { icon: 'chatbubble-outline', color: colors.info };
      case 'FOLLOW': return { icon: 'people-outline', color: G };
      case 'COMMUNITY_JOIN': return { icon: 'people-outline', color: G };
      case 'EVENT_REMINDER': return { icon: 'calendar-outline', color: colors.templeGold || '#F9A825' };
      case 'MENTION': return { icon: 'at-outline', color: colors.info };
      default: return { icon: 'notifications-outline', color: G };
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
      <Text style={[styles.cardTitle, { color: TEXT }]}>Community Updates</Text>
      {isLoading && (
        <Text style={{ color: TEXT3, textAlign: 'center', paddingVertical: 20 }}>Loading...</Text>
      )}
      {!isLoading && notifications.length === 0 && (
        <Text style={{ color: TEXT3, textAlign: 'center', paddingVertical: 20 }}>No updates yet.</Text>
      )}
      {notifications.map((n, i) => {
        const { icon, color } = getIcon(n.type);
        return (
          <View key={n.id} style={[
            styles.updateRow,
            { borderBottomColor: BORDER, borderBottomWidth: i < notifications.length - 1 ? StyleSheet.hairlineWidth : 0 },
          ]}>
            <View style={[styles.updateIconBox, { backgroundColor: color + '15' }]}>
              <Ionicons name={icon as any} size={20} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.updateText, { color: TEXT }]}>{n.body || n.type}</Text>
              <Text style={[styles.updateTime, { color: TEXT3 }]}>{formatTime(n.createdAt)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: SW } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [bioExpanded, setBioExpanded] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { user, updateProfile } = useAuthStore();
  const { data: posts = [], isLoading: postsLoading } = useUserPostsQuery(user?.id || '');
  const { data: unreadCount = 0 } = useUnreadCountQuery();
  const { data: connectionCount } = useMyConnectionCountQuery(user?.id || '');
  useConnectionSocket(user?.id);

  // Sync latest profile data from the server on every mount so images
  // are always up-to-date after an edit or a page refresh.
  useEffect(() => {
    apiClient.get('/users/me').then((res) => {
      const fresh = res.data?.data ?? res.data;
      if (fresh) updateProfile(fresh);
    }).catch(() => {});
  }, []);

  const { data: allEvents = [] } = useEventsQuery();
  const myEvents = allEvents.filter(
    (e: any) => e.creatorId === user?.id || e.creatorId === 'local'
  );

  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);
  const [selectedForwardPostId, setSelectedForwardPostId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const handleForwardPress = (postId: string) => {
    setSelectedForwardPostId(postId);
    setForwardSheetVisible(true);
  };

  const handleShare = useCallback(async () => {
    const ok = await shareAppLink(user?.displayName || 'A friend', user?.id);
    showToast(
      ok ? 'App link copied! Share it to invite friends.' : 'Could not share',
      ok ? 'success' : 'error'
    );
  }, [user, showToast]);

  const handleMessage = () => {
    router.push('/chat/new' as any);
  };

  const handleConnect = () => {
    if (isConnected) {
      setIsConnected(false);
      showToast('Connection removed', 'info');
    } else {
      setIsConnected(true);
      showToast('Connection request sent!', 'success');
    }
  };

  const handleInviteFamily = useCallback(async () => {
    const ok = await shareAppLink(user?.displayName || 'A friend', user?.id);
    showToast(
      ok ? 'Invite link shared!' : 'Could not send invite',
      ok ? 'success' : 'error'
    );
  }, [user, showToast]);

  const G = colors.primary;
  const SAFFRON = colors.saffron || '#FF6F00';
  const BG = colors.background;
  const SURF = colors.surface;
  const BORDER = colors.border;
  const TEXT = colors.text;
  const TEXT2 = colors.textSecondary;
  const TEXT3 = colors.textMuted;

  // Header fades in as user scrolls up
  const navBgOpacity = scrollY.interpolate({
    inputRange: [120, 180],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.root, { backgroundColor: BG, paddingTop: insets.top }]}>

      {/* ── Animated App Bar ────────────────────────────────────────────── */}
      <Animated.View style={[styles.navbar, { borderBottomColor: BORDER }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SURF, opacity: navBgOpacity }]} />
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: TEXT }]}>{user?.displayName || 'Profile'}</Text>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => router.push('/notifications' as any)}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={TEXT} />
              {unreadCount > 0 && (
                <View style={[styles.bellBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navIconBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={22} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navIconBtn} 
            onPress={() => router.push('/settings' as any)}
          >
            <Ionicons name="settings-outline" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >

        {/* ── Cover Photo ─────────────────────────────────────────────── */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: user?.coverImage || user?.bannerUrl || 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&auto=format&fit=crop&q=80' }} style={styles.coverImage} contentFit="cover" />
          {/* Gradient overlay */}
          <View style={styles.coverGradient} />
        </View>

        {/* ── Premium Profile Card ─────────────────────────────────── */}
        <View style={[styles.profileCard, { backgroundColor: isDark ? SURF : '#FAFAF7' }]}>

          {/* Avatar Row */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatarRingOuter, { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' }]}>
                {user?.avatarUrl && user.avatarUrl.startsWith('http') ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder, { backgroundColor: colors.primaryContainer }]}>
                    <Ionicons name="person" size={52} color={G} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Identity */}
          <View style={styles.identityBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: TEXT }]}>{user?.displayName || 'User'}</Text>
              <View style={[styles.verifiedBadge, { backgroundColor: G }]}>
                <Ionicons name="checkmark" size={10} color="#FFF" />
              </View>
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={TEXT3} />
              <Text style={[styles.locationText, { color: TEXT3 }]}>
                {user?.village || 'Unknown Location'}
              </Text>
            </View>

            {/* Gradient Member Badge */}
            <LinearGradient
              colors={[G, colors.primaryLight || '#4CAF50']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.memberBadge}
            >
              <Ionicons name="leaf" size={11} color="#FFF" />
              <Text style={styles.memberBadgeText}>{user?.occupation || 'Member'}</Text>
            </LinearGradient>

            {/* Bio */}
            <Text style={[styles.bio, { color: TEXT2 }]} numberOfLines={bioExpanded ? undefined : 2}>
              {user?.bio || 'No bio provided.'}
            </Text>
            {!bioExpanded && (
              <TouchableOpacity onPress={() => setBioExpanded(true)}>
                <Text style={[styles.readMoreText, { color: G }]}>Read more</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Cards */}
          <View style={[styles.statsRow, { backgroundColor: isDark ? colors.elevation1 : '#F2F5F0', borderColor: BORDER }]}>
            {[
              { label: 'Connections', value: (connectionCount ?? user?.followersCount ?? 0).toString(), icon: 'people-outline' },
              { label: 'Following', value: (user?.followingCount || 0).toString(), icon: 'person-add-outline' },
              { label: 'Since', value: (user?.joinedAt || user?.createdAt) ? new Date(user.joinedAt || user.createdAt!).getFullYear().toString() : new Date().getFullYear().toString(), icon: 'calendar-outline' },
            ].map((stat, i, arr) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Ionicons name={stat.icon as any} size={16} color={G} style={{ marginBottom: 4 }} />
                  <Text style={[styles.statValue, { color: TEXT }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: TEXT3 }]}>{stat.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: BORDER }]} />}
              </React.Fragment>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, { backgroundColor: G, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Ionicons name="create-outline" size={15} color="#FFF" />
              <Text style={styles.btnPrimaryText}>Edit Profile</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, { backgroundColor: pressed ? colors.elevation1 : SURF, borderColor: BORDER }]}
              onPress={handleShare}
            >
              <Ionicons name="share-social-outline" size={18} color={TEXT} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, { backgroundColor: pressed ? colors.elevation1 : SURF, borderColor: BORDER }]}
              onPress={handleMessage}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={TEXT} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, {
                backgroundColor: isConnected ? colors.primaryContainer : (pressed ? colors.elevation1 : SURF),
                borderColor: isConnected ? G : BORDER,
              }]}
              onPress={handleConnect}
            >
              <Ionicons name={isConnected ? 'person-remove-outline' : 'person-add-outline'} size={18} color={isConnected ? G : TEXT} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnSecondary, { backgroundColor: pressed ? colors.elevation1 : SURF, borderColor: BORDER }]}
              onPress={() => router.push('/(tabs)/media-gallery' as any)}
            >
              <Ionicons name="images-outline" size={18} color={TEXT} />
            </Pressable>
          </View>

        </View>

        {/* ── Tab Bar ─────────────────────────────────────────────── */}
        <View style={styles.tabBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    active
                      ? { backgroundColor: colors.primaryContainer, borderColor: G }
                      : { backgroundColor: pressed ? colors.elevation1 : 'transparent', borderColor: 'transparent' },
                  ]}
                >
                  <Ionicons name={tab.icon as any} size={14} color={active ? G : TEXT3} />
                  <Text style={[styles.tabLabel, { color: active ? G : TEXT3, fontWeight: active ? '700' : '500' }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Tab Content ─────────────────────────────────────────── */}
        <View style={styles.contentArea}>

          {/* POSTS TAB */}
          {activeTab === 'posts' && (
            <View style={{ gap: 12 }}>
              {posts.map(post => (
                <PostCard key={post.id} post={post as any} onCommentPress={() => { }} onForwardPress={handleForwardPress} />
              ))}
              {posts.length === 0 && !postsLoading && (
                <View style={{ padding: 20 }}>
                  <Text style={{ textAlign: 'center', color: TEXT3 }}>No posts yet.</Text>
                </View>
              )}

            </View>
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <View style={{ gap: 14 }}>


              {/* Personal Details */}
              <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
                <Text style={[styles.cardTitle, { color: TEXT }]}>Personal Details</Text>
                {[
                  { icon: 'home-outline', label: 'Native Village', value: user?.village || 'Not specified' },
                  { icon: 'briefcase-outline', label: 'Occupation', value: user?.occupation || 'Not specified' },
                  { icon: 'calendar-outline', label: 'Member Since', value: user?.joinedAt ? new Date(user.joinedAt).getFullYear().toString() : 'Not specified' },
                ].map((row, i, arr) => (
                  <View key={i} style={[
                    styles.detailRow,
                    { borderBottomColor: BORDER, borderBottomWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0 },
                  ]}>
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

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER }]}>
              <Text style={[styles.cardTitle, { color: TEXT }]}>My Events</Text>
              {myEvents.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                  <Ionicons name="calendar-outline" size={40} color={TEXT3} />
                  <Text style={{ color: TEXT3, fontSize: 15, fontWeight: '600' }}>No events created yet</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/create/event' as any)}
                    style={[styles.btnPrimary, { backgroundColor: G, paddingHorizontal: 24, flex: 0, minWidth: 140 }]}
                  >
                    <Ionicons name="add" size={16} color="#FFF" />
                    <Text style={styles.btnPrimaryText}>Create Event</Text>
                  </TouchableOpacity>
                </View>
              )}
              {myEvents.map((event: any, i: number) => {
                const isPast = new Date(event.startsAt) < new Date();
                const dateStr = new Date(event.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = new Date(event.startsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return (
                  <View key={event.id} style={[
                    styles.eventRow,
                    { borderBottomColor: BORDER, borderBottomWidth: i < myEvents.length - 1 ? StyleSheet.hairlineWidth : 0 },
                  ]}>
                    <View style={[styles.eventIconBox, { backgroundColor: isPast ? colors.elevation1 : colors.primaryContainer }]}>
                      <Ionicons name="calendar-outline" size={18} color={isPast ? TEXT3 : G} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventRowTitle, { color: TEXT }]}>{event.title}</Text>
                      <Text style={[styles.eventRowMeta, { color: TEXT3 }]}>
                        {dateStr} · {timeStr}
                      </Text>
                      {event.location ? (
                        <Text style={[styles.eventRowMeta, { color: TEXT3 }]} numberOfLines={1}>
                          📍 {event.location}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.eventStatusChip, { backgroundColor: isPast ? colors.elevation1 : colors.primaryContainer }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isPast ? TEXT3 : G }}>
                        {isPast ? 'Past' : 'Upcoming'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* FAMILY TAB */}
          {activeTab === 'family' && (
            <View style={[styles.card, { backgroundColor: SURF, borderColor: BORDER, alignItems: 'center', paddingVertical: 40 }]}>
              <View style={[styles.familyIconBg, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="people-circle-outline" size={48} color={G} />
              </View>
              <Text style={[styles.cardTitle, { color: TEXT, marginTop: 16 }]}>Family Network</Text>
              <Text style={[styles.familySubtext, { color: TEXT2 }]}>
                Connected with 26 family members across the Gowda community network.
              </Text>
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: G, marginTop: 20, paddingHorizontal: 32 }]}
                onPress={handleInviteFamily}
              >
                <Ionicons name="person-add-outline" size={16} color="#FFF" />
                <Text style={styles.btnPrimaryText}>Invite Family Member</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* UPDATES TAB */}
          {activeTab === 'updates' && <UpdatesTab />}


        </View>
      </ScrollView>

      <ForwardSheet
        postId={selectedForwardPostId}
        visible={forwardSheetVisible}
        onClose={() => setForwardSheetVisible(false)}
        onNativeShare={async () => {
          try {
            await Share.share({
              message: `Check out this post on Community!`,
            });
          } catch (_) {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Navigation Bar ──────────────────────────────────────────────────────────
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  navRight: { flexDirection: 'row' },
  navIconBtn: { padding: 8 },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Cover Photo ─────────────────────────────────────────────────────────────
  coverContainer: { position: 'relative', height: COVER_HEIGHT },
  coverImage: { width: '100%', height: '100%' },
  coverGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  // ── Premium Profile Card ────────────────────────────────────────────────────
  profileCard: {
    marginHorizontal: 14,
    marginTop: -50,
    borderRadius: 20,
    paddingBottom: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16 },
      android: { elevation: 5 },
    }),
  },

  // ── Avatar Section ──────────────────────────────────────────────────────────
  avatarSection: { alignItems: 'center', marginTop: -46, marginBottom: 10 },
  avatarWrapper: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  avatarRingOuter: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 3.5, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  // ── Identity ────────────────────────────────────────────────────────────────
  identityBlock: { paddingHorizontal: 20, alignItems: 'center', marginBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  profileName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  verifiedBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  locationText: { fontSize: 12, fontWeight: '500' },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    marginBottom: 10,
  },
  memberBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  bio: { fontSize: 13.5, lineHeight: 21, textAlign: 'center', marginBottom: 4 },
  readMoreText: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },

  // ── Stats Row ────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, paddingVertical: 12, marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 36 },

  // ── Contribution Cards ───────────────────────────────────────────────────────
  contribScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4, marginBottom: 16 },
  contribCard: {
    width: 90, padding: 14, borderRadius: 20,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  contribEmoji: { fontSize: 22 },
  contribValue: { fontSize: 20, fontWeight: '800' },
  contribLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 14 },

  // ── Action Row ─────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 16, flexWrap: 'nowrap',
  },
  btnPrimary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 50, gap: 5,
    ...Platform.select({
      ios: { shadowColor: '#2D6A2D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  btnPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  btnSecondary: {
    width: 42, height: 42, alignItems: 'center',
    justifyContent: 'center', borderRadius: 21, borderWidth: 1.5,
    flexShrink: 0,
  },

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
  tabBarWrapper: {
    marginHorizontal: 14,
    marginBottom: 10,
  },
  tabScroll: { paddingVertical: 4, gap: 6 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 50, borderWidth: 1.5,
  },
  tabLabel: { fontSize: 12 },

  // ── Content Area ─────────────────────────────────────────────────────────────
  contentArea: { paddingHorizontal: 16 },
  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 2,
    ...Platform.select({
      ios: { shadowColor: '#1A2D1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 12 },

  // Event card inside posts tab
  eventHeader: { padding: 16, marginBottom: 12 },
  eventHeaderLeft: {},
  eventHeaderLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  eventTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  eventMeta: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  eventVenue: { fontSize: 13 },
  rsvpBtn: { paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  rsvpText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCell: {
    width: '47%', borderRadius: 16, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 4,
  },
  metricEmoji: { fontSize: 24 },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Details rows (About tab)
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14 },
  detailIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600' },

  // Events tab
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  eventIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  eventRowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  eventRowMeta: { fontSize: 13 },
  eventStatusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },

  // Family tab
  familyIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  familySubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8, paddingHorizontal: 20 },

  // Updates tab
  updateRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  updateIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  updateText: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 4, flex: 1 },
  updateTime: { fontSize: 12 },
});