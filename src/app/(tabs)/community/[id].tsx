import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = Math.round(SCREEN_WIDTH * 0.48);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../../theme';
import { useCommunityDetailsQuery, useJoinCommunityMutation } from '../../../api/community';
import { useCommunityPostsQuery } from '../../../api/feed';
import PostCard from '../../../components/feed/PostCard';
import CommentSheet from '../../../components/feed/CommentSheet';
import Avatar from '../../../components/common/Avatar';
import Button from '../../../components/common/Button';
import Skeleton from '../../../components/feedback/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../../../store/toastStore';
import { FlashList as ShopifyFlashList } from '@shopify/flash-list';
const FlashList = ShopifyFlashList as any;

type TabType = 'posts' | 'rules';

export default function CommunityDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, typography, roundness, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);

  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const { data: community, isLoading: isDetailsLoading } = useCommunityDetailsQuery(id || '');
  const { data: posts = [], isLoading: isPostsLoading } = useCommunityPostsQuery(id || '');
  const joinMutation = useJoinCommunityMutation();

  const handleJoinToggle = () => {
    if (!community) return;
    joinMutation.mutate({ communityId: community.id, isJoined: community.isJoined ?? false });
    showToast(
      community.isJoined ? 'Left community successfully.' : `Joined ${community.name}!`,
      'success'
    );
  };

  const handleCommentPress = (postId: string) => {
    setSelectedPostId(postId);
    setCommentSheetVisible(true);
  };

  if (isDetailsLoading || !community) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.detailsHeader}>
      {/* Cover / Banner */}
      <View style={styles.bannerContainer}>
        <Image source={{ uri: community.bannerUrl }} style={styles.banner} />
        {/* Float Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { top: insets.top + 10, backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Avatar details */}
      <View style={[styles.infoContainer, { paddingHorizontal: spacing.lg }]}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatarBox, { borderColor: colors.background }]}>
            <Avatar url={community.avatarUrl} name={community.name} size={64} />
          </View>
          <Button
            title={community.isJoined ? 'Joined' : 'Join Community'}
            variant={community.isJoined ? 'secondary' : 'gradient'}
            size="sm"
            onPress={handleJoinToggle}
            style={styles.joinBtn}
          />
        </View>

        <Text style={[styles.name, { color: colors.text, fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold }]}>
          {community.name}
        </Text>
        
        <View style={styles.categoryBadge}>
          <Text style={[styles.categoryText, { color: colors.primary, fontSize: typography.sizes.xs }]}>
            {community.category}
          </Text>
        </View>

        <Text style={[styles.description, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
          {community.description}
        </Text>

        {/* Stats Row links to members */}
        <TouchableOpacity
          onPress={() => router.push(`/community/${community.id}/members`)}
          style={[styles.statsRow, { borderBottomColor: colors.borderSecondary }]}
        >
          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.statsText, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
            <Text style={{ fontWeight: 'bold', color: colors.text }}>
              {(community.membersCount || 0).toLocaleString()}
            </Text>{' '}
            members • View active list
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Tab filters switcher */}
        <View style={[styles.tabsBar, { borderBottomColor: colors.borderSecondary }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('posts')}
            style={[
              styles.tab,
              activeTab === 'posts' && { borderBottomColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'posts' ? colors.text : colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: activeTab === 'posts' ? '700' : '500',
                },
              ]}
            >
              Feed Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('rules')}
            style={[
              styles.tab,
              activeTab === 'rules' && { borderBottomColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'rules' ? colors.text : colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: activeTab === 'rules' ? '700' : '500',
                },
              ]}
            >
              Rules
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeTab === 'posts' ? (
        isPostsLoading ? (
          <View style={{ flex: 1 }}>
            {renderHeader()}
            <View style={{ padding: 20 }}>
              <Skeleton width="100%" height={150} borderRadius={12} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={150} borderRadius={12} />
            </View>
          </View>
        ) : (
        <FlashList
          data={posts}
          renderItem={({ item }: { item: any }) => <PostCard post={item} onCommentPress={handleCommentPress} />}
          estimatedItemSize={400}
          ListHeaderComponent={() => (
            <>
              {renderHeader()}
              {community.feedPostPrompts && community.feedPostPrompts.length > 0 && (
                <View style={{ paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feed Post Prompts</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {community.feedPostPrompts.map((prompt: string, idx: number) => (
                      <View key={idx} style={{ backgroundColor: colors.inputBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.text, fontSize: typography.sizes.sm }}>{prompt}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
        )
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <View style={[styles.rulesContainer, { paddingHorizontal: spacing.lg }]}>
            {(!community.rules || community.rules.length === 0) && (
              <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm, fontWeight: '500' }}>No rules added yet.</Text>
            )}
            {community.rules?.map((rule: any, idx: number) => {
              const title = typeof rule === 'string' ? rule : rule.title;
              const desc = typeof rule === 'object' ? rule.description : undefined;
              return (
                <View key={idx} style={[styles.ruleRow, { borderBottomColor: colors.borderSecondary }]}>
                  <View style={[styles.ruleNum, { backgroundColor: colors.inputBg }]}>
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ruleText, { color: colors.text, fontSize: typography.sizes.md }]}>{title}</Text>
                    {!!desc && (
                      <Text style={[{ color: colors.textSecondary, fontSize: typography.sizes.sm, marginTop: 2 }]}>{desc}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Comment overlay sheet */}
      <CommentSheet
        postId={selectedPostId}
        visible={commentSheetVisible}
        onClose={() => setCommentSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeader: {
    width: '100%',
  },
  bannerContainer: {
    width: '100%',
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    marginTop: -30,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  avatarBox: {
    borderWidth: 4,
    borderRadius: 36,
    overflow: 'hidden',
  },
  joinBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 38,
  },
  name: {
    marginTop: 4,
  },
  categoryBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontWeight: '700',
  },
  description: {
    marginTop: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginTop: 14,
  },
  statsText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 10,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginRight: 24,
  },
  tabText: {},
  rulesContainer: {
    paddingVertical: 20,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ruleNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  ruleText: {
    flex: 1,
    fontWeight: '500',
  },
});
