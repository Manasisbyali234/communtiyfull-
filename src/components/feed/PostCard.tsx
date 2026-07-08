import React, { useRef, useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  TouchableOpacity, Share, Platform, Modal, Dimensions
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 14 * 2 + 12 * 2; // card padding + list horizontal padding
const MEDIA_HEIGHT = Math.round((SCREEN_WIDTH - CARD_PADDING) * 0.65);
const GRID_HEIGHT = Math.round((SCREEN_WIDTH - CARD_PADDING) * 0.38);
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withDelay, withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';
import { Post } from '../../types';
import Avatar from '../common/Avatar';
import VideoPostPlayer from '../common/VideoPostPlayer';
import { Ionicons } from '@expo/vector-icons';
import { useLikePostMutation, useSavePostMutation } from '../../api/feed';
import { useToastStore } from '../../store/toastStore';
import { useRouter } from 'expo-router';

interface PostCardProps {
  post: Post;
  onCommentPress: (postId: string) => void;
  onForwardPress?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = React.memo(({ post, onCommentPress, onForwardPress }) => {
  const { colors, typography, isDark } = useTheme();
  const router = useRouter();
  const likeMutation = useLikePostMutation();
  const saveMutation = useSavePostMutation();
  const showToast = useToastStore((state) => state.showToast);

  const lastTapRef = useRef<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const moreBtnRef = useRef<View>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  // Earthy green accent – community brand
  const G = colors.primary;
  const CARD = colors.surface;
  const TEXT = colors.text;
  const TEXT2 = colors.textSecondary;
  const TEXT3 = colors.textMuted;
  const BORDER = colors.border;

  const shouldShowReadMore = post.content.length > 120 || post.content.split('\n').length > 2;

  // ── Animations ────────────────────────────────────────────────────────
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const iconScale = useSharedValue(1);

  const triggerDoubleTapAnimation = () => {
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 120 }),
      withDelay(350, withSpring(0, { damping: 10 }))
    );
    heartOpacity.value = withSequence(
      withTiming(0.9, { duration: 150 }),
      withDelay(350, withTiming(0, { duration: 200 }))
    );
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLiked) likeMutation.mutate(post.id);
      triggerDoubleTapAnimation();
    }
    lastTapRef.current = now;
  };

  const handleLikePress = () => {
    iconScale.value = withSequence(
      withTiming(1.35, { duration: 90 }),
      withSpring(1, { damping: 5 })
    );
    likeMutation.mutate(post.id);
  };

  const handleSavePress = () => {
    saveMutation.mutate(post.id);
    showToast(post.isBookmarked ? 'Removed from saved.' : 'Post saved!', 'success');
  };

  const handleShare = async () => {
    if (onForwardPress) {
      onForwardPress(post.id);
    } else {
      try {
        await Share.share({
          message: `${post.author.displayName} in ${post.community?.name || 'Community'}: "${post.content}"`,
        });
      } catch (_) {}
    }
  };

  const navigateToCommunity = () => {
    if (post.community) router.push(`/community/${post.community.id}`);
  };

  const navigateToAuthor = () => {
    router.push(`/user/${post.author.id}` as any);
  };

  const handleMorePress = () => {
    moreBtnRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPos({ top: y + height + 4, right: 0 });
      setMenuVisible(true);
    });
  };

  const handleReport = () => {
    setMenuVisible(false);
    showToast('Post reported. Thank you for keeping the community safe.', 'info');
  };

  const parsedContent = useMemo(() => {
    return post.content.split(/([\s]+)/).map((part, i) => {
      if (part.startsWith('#'))
        return <Text key={i} style={{ color: G, fontWeight: '700' }}>{part}</Text>;
      if (part.startsWith('@'))
        return <Text key={i} style={{ color: G, fontWeight: '600' }}>{part}</Text>;
      return part;
    });
  }, [post.content, G]);

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <View style={[styles.card, { backgroundColor: CARD, borderColor: BORDER }]}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.8} onPress={post.community ? navigateToCommunity : navigateToAuthor} style={styles.avatarWrapper}>
          <Avatar
            url={post.community?.avatarUrl || post.author.avatarUrl}
            name={post.community?.name || post.author.displayName}
            size={44}
            gradientBorder={post.community?.isJoined === false}
          />
          {/* Author mini-avatar overlay */}
          {post.community && (
            <TouchableOpacity onPress={navigateToAuthor} style={[styles.authorAvatarBadge, { borderColor: CARD }]}>
              <Avatar url={post.author.avatarUrl} name={post.author.displayName} size={18} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.headerText}>
          <TouchableOpacity activeOpacity={0.8} onPress={post.community ? navigateToCommunity : navigateToAuthor}>
            <Text style={[styles.displayName, { color: TEXT }]}>
              {post.community?.name || post.author.displayName}
            </Text>
          </TouchableOpacity>
          <View style={styles.metaRow}>
            {post.community && (
              <TouchableOpacity onPress={navigateToAuthor}>
                <Text style={[styles.authorName, { color: TEXT3 }]}>
                  {post.author.displayName} ·{' '}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.time, { color: TEXT3 }]}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>

        {/* Community chip */}
        {post.community && (
          <TouchableOpacity
            onPress={navigateToCommunity}
            style={[styles.communityChip, {
              backgroundColor: post.community.isJoined ? colors.primaryContainer : colors.surfaceVariant,
            }]}
          >
            <Text style={[styles.communityChipText, {
              color: post.community.isJoined ? colors.primaryDark : TEXT3,
            }]}>
              {post.community.isJoined ? '● Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        )}

        <View ref={moreBtnRef} collapsable={false}>
          <Pressable 
            style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.5 : 1 }]} 
            onPress={handleMorePress}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={TEXT3} />
          </Pressable>
        </View>

        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
            <View style={[styles.dropdown, { backgroundColor: CARD, borderColor: BORDER, top: menuPos.top, right: 16 }]}>
              <Pressable style={styles.dropdownItem} onPress={handleReport}>
                <Ionicons name="flag-outline" size={16} color="#E53935" />
                <Text style={[styles.dropdownText, { color: '#E53935' }]}>Report Post</Text>
              </Pressable>
              <Pressable style={styles.dropdownItem} onPress={() => setMenuVisible(false)}>
                <Ionicons name="close-outline" size={16} color={TEXT3} />
                <Text style={[styles.dropdownText, { color: TEXT3 }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <Text
          style={[styles.bodyText, { color: TEXT2 }]}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {parsedContent}
        </Text>
        {shouldShowReadMore && !isExpanded && (
          <TouchableOpacity onPress={() => setIsExpanded(true)} style={{ marginTop: 4 }}>
            <Text style={{ color: G, fontWeight: '700', fontSize: 13 }}>Read more</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tags ─────────────────────────────────────────────────────────── */}
      {post.tags && post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.slice(0, 3).map((tag, i) => (
            <View key={i} style={[styles.tagChip, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.tagText, { color: colors.primaryDark }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Media ────────────────────────────────────────────────────────── */}
      {(post.videoUrl || post.mediaUrl || (post.images && post.images.length > 0)) && (
        <Pressable onPress={handleDoubleTap}>
          <View style={post.images && post.images.length > 0 ? styles.imageGrid : styles.mediaContainer}>
            {post.images && post.images.length > 0 ? (
              post.images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.gridImg} contentFit="cover" transition={300} />
              ))
            ) : post.videoUrl ? (
              <VideoPostPlayer url={post.videoUrl} />
            ) : post.mediaType === 'video' || post.mediaType === 'VIDEO' ? (
              <VideoPostPlayer url={post.mediaUrl!} />
            ) : (
              <Image
                source={{ uri: post.mediaUrl }}
                style={styles.media}
                contentFit="cover"
                transition={300}
              />
            )}

            {/* Double-tap heart overlay */}
            <Animated.View style={[styles.heartOverlay, animatedHeartStyle]}>
              <Ionicons name="heart" size={90} color="rgba(255,255,255,0.95)" />
            </Animated.View>
          </View>
        </Pressable>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <View style={[styles.footer, { borderTopColor: colors.borderSecondary }]}>
        {/* Like (heart) */}
        <TouchableOpacity onPress={handleLikePress} activeOpacity={0.7} style={styles.actionBtn}>
          <Animated.View style={animatedIconStyle}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.isLiked ? '#E53935' : TEXT3}
            />
          </Animated.View>
          {post.likesCount > 0 && (
            <Text style={[styles.actionText, { color: post.isLiked ? '#E53935' : TEXT3 }]}>
              {post.likesCount}
            </Text>
          )}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          onPress={() => onCommentPress(post.id)}
          activeOpacity={0.7}
          style={styles.actionBtn}
        >
          <Ionicons name="chatbubble-outline" size={19} color={TEXT3} />
          {post.commentsCount > 0 && (
            <Text style={[styles.actionText, { color: TEXT3 }]}>{post.commentsCount}</Text>
          )}
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={styles.actionBtn}>
          <Ionicons name="arrow-redo-outline" size={19} color={TEXT3} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Bookmark */}
        <TouchableOpacity onPress={handleSavePress} activeOpacity={0.7} style={styles.actionBtn}>
          <Ionicons
            name={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={post.isBookmarked ? G : TEXT3}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // M3 Elevated Card
  card: {
    marginBottom: 10,
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2D1A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 10px rgba(26, 45, 26, 0.06)' } as any,
    }),
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  avatarWrapper: { position: 'relative' },
  authorAvatarBadge: {
    position: 'absolute', bottom: -2, right: -2,
    borderRadius: 12, borderWidth: 2, overflow: 'hidden',
  },
  headerText: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  authorName: { fontSize: 12, fontWeight: '400' },
  time: { fontSize: 12, fontWeight: '400' },
  communityChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  communityChipText: { fontSize: 11, fontWeight: '700' },
  moreBtn: { padding: 6, borderRadius: 20 },
  modalOverlay: { flex: 1 },
  dropdown: {
    position: 'absolute',
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4, minWidth: 160,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 } as any,
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.15)' } as any,
    }),
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownText: { fontSize: 14, fontWeight: '600' },

  // Body
  body: { marginBottom: 10 },
  bodyText: { fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: -0.1 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '700' },

  // Media
  mediaContainer: {
    width: '100%', height: MEDIA_HEIGHT,
    borderRadius: 16, overflow: 'hidden',
    marginBottom: 12, position: 'relative',
  },
  media: { width: '100%', height: '100%' },
  imageGrid: { flexDirection: 'row', height: GRID_HEIGHT, gap: 4, marginBottom: 12 },
  gridImg: { flex: 1, borderRadius: 12 },
  heartOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  actionText: { fontSize: 13, fontWeight: '700' },
});

export default PostCard;
