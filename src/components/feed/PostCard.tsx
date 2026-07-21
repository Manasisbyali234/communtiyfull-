import React, { useRef, useState, useMemo } from 'react';
import {
  StyleSheet, Text, View, Pressable,
  TouchableOpacity, Share, Platform, Modal, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withDelay, withTiming, FadeIn,
  interpolate, useAnimatedReaction, runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Post } from '../../types';
import Avatar from '../common/Avatar';
import VideoPostPlayer from '../common/VideoPostPlayer';
import { useLikePostMutation, useSavePostMutation } from '../../api/feed';
import { useToastStore } from '../../store/toastStore';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_H_MARGIN = 16;
const MEDIA_HEIGHT = 300;

// ── Light card constants ──────────────────────────────────────────────────────
const CARD_BG = '#FFFFFF';
const CARD_BG_LIGHT = '#F9F9F9';
const ACCENT_GREEN = '#4CAF50';
const TEXT_WHITE = '#1A1A1A';
const TEXT_GRAY = '#333333';
const TEXT_MUTED = 'rgba(0,0,0,0.45)';
const DIVIDER = 'rgba(0,0,0,0.08)';
const ICON_DEFAULT = 'rgba(0,0,0,0.6)';

interface PostCardProps {
  post: Post;
  onCommentPress: (postId: string) => void;
  onForwardPress?: (postId: string) => void;
}

// ── Skeleton shimmer for image loading ──────────────────────────────────────
const ImageSkeleton: React.FC<{ height: number }> = ({ height }) => {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withSequence(
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 900 }),
    );
    const interval = setInterval(() => {
      shimmer.value = withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 900 }),
      );
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View style={[styles.skeleton, { height, borderRadius: 18 }, shimmerStyle]} />
  );
};

// ── Action button with press animation ──────────────────────────────────────
const ActionBtn: React.FC<{
  icon: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}> = ({ icon, count, active, onPress }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.35, { duration: 80 }),
      withSpring(1, { damping: 5, stiffness: 200 }),
    );
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.actionBtn}>
      <Animated.View style={animStyle}>
        <Ionicons
          name={icon as any}
          size={22}
          color={active ? ACCENT_GREEN : ICON_DEFAULT}
        />
      </Animated.View>
      {!!count && count > 0 && (
        <Text style={[styles.actionCount, { color: active ? ACCENT_GREEN : ICON_DEFAULT }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ── Main PostCard ────────────────────────────────────────────────────────────
export const PostCard: React.FC<PostCardProps> = React.memo(({ post, onCommentPress, onForwardPress }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const likeMutation = useLikePostMutation();
  const saveMutation = useSavePostMutation();
  const showToast = useToastStore((s) => s.showToast);

  const lastTapRef = useRef<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const moreBtnRef = useRef<View>(null);

  // Animations
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const imageScale = useSharedValue(1);
  const cardOpacity = useSharedValue(0);

  // Card fade-in on mount
  React.useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 400 });
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imageScale.value }],
  }));

  const triggerDoubleTapHeart = () => {
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 6, stiffness: 120 }),
      withDelay(400, withSpring(0, { damping: 10 })),
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(400, withTiming(0, { duration: 200 })),
    );
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!post.isLiked) likeMutation.mutate(post.id);
      triggerDoubleTapHeart();
    }
    lastTapRef.current = now;
  };

  const handleImagePressIn = () => {
    imageScale.value = withTiming(1.03, { duration: 200 });
  };

  const handleImagePressOut = () => {
    imageScale.value = withSpring(1, { damping: 8 });
  };

  const handleLike = () => likeMutation.mutate(post.id);
  const handleComment = () => onCommentPress(post.id);
  const handleSave = () => {
    saveMutation.mutate(post.id);
    showToast(post.isBookmarked ? 'Removed from saved.' : 'Post saved!', 'success');
  };
  const handleShare = async () => {
    if (onForwardPress) {
      onForwardPress(post.id);
    } else {
      try {
        await Share.share({
          message: `${post.author.displayName}: "${post.content}"`,
        });
      } catch (_) {}
    }
  };

  const handleMorePress = () => {
    moreBtnRef.current?.measureInWindow((x, y, w, h) => {
      setMenuPos({ top: y + h + 4, right: 0 });
      setMenuVisible(true);
    });
  };

  const navigateToCommunity = () => {
    if (post.community) router.push(`/community/${post.community.id}`);
  };
  const navigateToAuthor = () => router.push(`/user/${post.author.id}` as any);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const parsedContent = useMemo(() => {
    return post.content.split(/([\s]+)/).map((part, i) => {
      if (part.startsWith('#'))
        return <Text key={i} style={{ color: ACCENT_GREEN, fontWeight: '700' }}>{part}</Text>;
      if (part.startsWith('@'))
        return <Text key={i} style={{ color: ACCENT_GREEN, fontWeight: '600' }}>{part}</Text>;
      return part;
    });
  }, [post.content]);

  const hasMedia = !!(post.videoUrl || post.mediaUrl || (post.images && post.images.length > 0));
  const isVideo = post.videoUrl || post.mediaType === 'video' || post.mediaType === 'VIDEO';
  const mediaUri = post.mediaUrl || (post.images && post.images[0]);
  const shouldShowReadMore = post.content.length > 120 || post.content.split('\n').length > 2;

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={post.community ? navigateToCommunity : navigateToAuthor}
          style={styles.avatarWrap}
        >
          <Avatar
            url={post.community?.avatarUrl || post.author.avatarUrl}
            name={post.community?.name || post.author.displayName}
            size={48}
            gradientBorder={post.community?.isJoined === false}
          />
          {post.community && (
            <TouchableOpacity
              onPress={navigateToAuthor}
              style={styles.authorBadge}
            >
              <Avatar url={post.author.avatarUrl} name={post.author.displayName} size={18} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <View style={styles.headerMeta}>
          <TouchableOpacity activeOpacity={0.8} onPress={post.community ? navigateToCommunity : navigateToAuthor}>
            <Text style={styles.displayName} numberOfLines={1}>
              {post.community?.name || post.author.displayName}
            </Text>
          </TouchableOpacity>
          <View style={styles.metaRow}>
            {post.community && (
              <TouchableOpacity onPress={navigateToAuthor}>
                <Text style={styles.authorName}>{post.author.displayName} · </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>

        <View ref={moreBtnRef} collapsable={false}>
          <Pressable
            style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.5 : 1 }]}
            onPress={handleMorePress}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={ICON_DEFAULT} />
          </Pressable>
        </View>

        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)}>
            <View style={[styles.dropdown, { top: menuPos.top, right: 16 }]}>
              <Pressable style={styles.dropdownItem} onPress={() => {
                setMenuVisible(false);
                showToast('Post reported. Thank you!', 'info');
              }}>
                <Ionicons name="flag-outline" size={16} color="#EF5350" />
                <Text style={[styles.dropdownText, { color: '#EF5350' }]}>Report Post</Text>
              </Pressable>
              <Pressable style={styles.dropdownItem} onPress={() => setMenuVisible(false)}>
                <Ionicons name="close-outline" size={16} color={TEXT_GRAY} />
                <Text style={[styles.dropdownText, { color: TEXT_GRAY }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      {/* ── Media ──────────────────────────────────────────────────────── */}
      {hasMedia && (
        <Pressable
          onPress={handleDoubleTap}
          onPressIn={handleImagePressIn}
          onPressOut={handleImagePressOut}
          style={styles.mediaWrapper}
        >
          <Animated.View style={[styles.mediaInner, imageAnimStyle]}>
            {!imageLoaded && !isVideo && <ImageSkeleton height={MEDIA_HEIGHT} />}
            {isVideo ? (
              <VideoPostPlayer url={post.videoUrl || post.mediaUrl!} />
            ) : post.images && post.images.length > 1 ? (
              <View style={styles.imageGrid}>
                {post.images.slice(0, 4).map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={styles.gridImg}
                    contentFit="cover"
                    transition={300}
                  />
                ))}
              </View>
            ) : (
              <Image
                source={{ uri: mediaUri }}
                style={styles.media}
                contentFit="cover"
                transition={400}
                onLoad={() => setImageLoaded(true)}
              />
            )}

            {/* Bottom gradient overlay */}
            {!isVideo && (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={styles.mediaGradient}
                pointerEvents="none"
              />
            )}
          </Animated.View>

          {/* Double-tap heart */}
          <Animated.View style={[styles.heartOverlay, heartStyle]}>
            <Ionicons name="heart" size={90} color="rgba(255,255,255,0.95)" />
          </Animated.View>
        </Pressable>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      <View style={styles.content}>
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {post.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Post text */}
        <Text
          style={styles.bodyText}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {parsedContent}
        </Text>
        {shouldShowReadMore && !isExpanded && (
          <TouchableOpacity onPress={() => setIsExpanded(true)} style={{ marginTop: 4 }}>
            <Text style={styles.readMore}>Read more</Text>
          </TouchableOpacity>
        )}

        {/* Community / location chip */}
        {post.community && (
          <TouchableOpacity onPress={navigateToCommunity} style={styles.communityChip}>
            <Ionicons name="people-outline" size={12} color={TEXT_MUTED} />
            <Text style={styles.communityChipText}>{post.community.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Divider ────────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Reaction Row ───────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <ActionBtn
          icon={post.isLiked ? 'heart' : 'heart-outline'}
          count={post.likesCount}
          active={post.isLiked}
          onPress={handleLike}
        />
        <ActionBtn
          icon="chatbubble-outline"
          count={post.commentsCount}
          onPress={handleComment}
        />
        <ActionBtn
          icon="arrow-redo-outline"
          onPress={handleShare}
        />
        <View style={{ flex: 1 }} />
        <ActionBtn
          icon={post.isBookmarked ? 'bookmark' : 'bookmark-outline'}
          active={post.isBookmarked}
          onPress={handleSave}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    marginHorizontal: CARD_H_MARGIN,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0px 2px 12px rgba(0,0,0,0.1)' } as any,
    }),
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarWrap: { position: 'relative' },
  authorBadge: {
    position: 'absolute',
    bottom: -2, right: -2,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  headerMeta: { flex: 1 },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: -0.3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  authorName: { fontSize: 13, color: TEXT_MUTED, fontWeight: '400' },
  timeText: { fontSize: 13, color: TEXT_MUTED, fontWeight: '400' },
  moreBtn: { padding: 6, borderRadius: 20 },

  // ── Dropdown ──────────────────────────────────────────────────────────────
  dropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingVertical: 4,
    minWidth: 160,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  dropdownText: { fontSize: 14, fontWeight: '600' },

  // ── Media ─────────────────────────────────────────────────────────────────
  mediaWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 14,
    position: 'relative',
  },
  mediaInner: { width: '100%' },
  media: { width: '100%', height: MEDIA_HEIGHT },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: MEDIA_HEIGHT,
    gap: 3,
  },
  gridImg: { flex: 1, minWidth: '48%', borderRadius: 10 },
  mediaGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 100,
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    backgroundColor: '#E0E0E0',
    width: '100%',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: { gap: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: 'rgba(76,175,80,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: ACCENT_GREEN },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_GRAY,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  readMore: { color: ACCENT_GREEN, fontWeight: '700', fontSize: 13 },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  communityChipText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '500' },

  // ── Footer ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default PostCard;
