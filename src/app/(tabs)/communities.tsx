import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../../theme';
import { useCommunitiesQuery, useJoinCommunityMutation } from '../../api/community';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/feedback/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../../store/toastStore';

export default function CommunitiesDirectory() {
  const { colors, spacing, typography, roundness } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: communities = [], isLoading } = useCommunitiesQuery();
  const joinMutation = useJoinCommunityMutation();
  const showToast = useToastStore((state) => state.showToast);

  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const CATEGORIES = ['All', ...Array.from(new Set(communities.map((c) => c.category).filter(Boolean)))];

  const handleJoinPress = (communityId: string, isJoined: boolean) => {
    joinMutation.mutate({ communityId, isJoined });
    showToast(
      isJoined ? 'Left community successfully.' : 'Welcome! You have joined the community.',
      'success'
    );
  };

  const filteredCommunities = communities.filter((c) => {
    // Category Filter
    if (selectedCategory !== 'All' && c.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    // Search query filter
    if (searchText.trim() !== '') {
      const query = searchText.toLowerCase();
      return c.name.toLowerCase().includes(query) || (c.description || "").toLowerCase().includes(query);
    }

    return true;
  });

  const renderCommunityCard = ({ item }: { item: any }) => (
    <Card style={styles.communityCard}>
      <TouchableOpacity
        onPress={() => router.push(`/community/${item.id}`)}
        activeOpacity={0.9}
        style={styles.bannerContainer}
      >
        <Image source={{ uri: item.bannerUrl }} style={styles.banner} />
        <View style={styles.avatarOverlay}>
          <Avatar url={item.avatarUrl} name={item.name} size={48} />
        </View>
      </TouchableOpacity>

      <View style={styles.cardDetails}>
        <TouchableOpacity onPress={() => router.push(`/community/${item.id}`)} activeOpacity={0.8}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
        </TouchableOpacity>
        
        <Text style={[styles.stats, { color: colors.textSecondary, fontSize: typography.sizes.xs }]}>
          {item.membersCount.toLocaleString()} members • {item.postsCount.toLocaleString()} posts
        </Text>
        
        <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
          {item.description}
        </Text>

        <View style={styles.actionContainer}>
          <Button
            title={item.isJoined ? 'Joined' : 'Join'}
            variant={item.isJoined ? 'secondary' : 'gradient'}
            size="sm"
            onPress={() => handleJoinPress(item.id, item.isJoined)}
            style={styles.joinBtn}
          />
          <TouchableOpacity
            onPress={() => router.push(`/community/${item.id}`)}
            style={[styles.viewBtn, { backgroundColor: colors.inputBg, borderRadius: roundness.sm }]}
          >
            <Text style={{ color: colors.text, fontSize: typography.sizes.xs, fontWeight: '600' }}>
              View Group
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderSkeletonList = () => (
    <View style={{ paddingHorizontal: 16 }}>
      {[1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { borderColor: colors.borderSecondary }]}>
          <Skeleton width="100%" height={100} borderRadius={12} />
          <View style={{ marginTop: 12 }}>
            <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="30%" height={10} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={12} style={{ marginBottom: 4 }} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text, fontSize: typography.sizes.xl, fontWeight: '800' }]}>
          Communities
        </Text>
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.inputBg, borderRadius: roundness.sm }]} onPress={() => router.push('/create/community' as any)}>
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: typography.sizes.xs, fontWeight: '600', marginLeft: 4 }}>
            Create New
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderRadius: roundness.md }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search communities..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            style={[styles.searchInput, { color: colors.text, fontSize: typography.sizes.sm }]}
          />
        </View>
      </View>

      {/* Categories Filter Pills */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.8}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.inputBg,
                    borderRadius: roundness.xl,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontSize: typography.sizes.xs,
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Communities list */}
      {isLoading ? (
        renderSkeletonList()
      ) : (
        <FlatList
          data={filteredCommunities}
          renderItem={renderCommunityCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
                No communities found matching your search.
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    letterSpacing: 0.5,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  categoriesContainer: {
    paddingBottom: 12,
    paddingTop: 4,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  communityCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 20,
  },
  bannerContainer: {
    width: '100%',
    height: 100,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: -15,
    left: 16,
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 28,
  },
  cardDetails: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  name: {
    fontWeight: '700',
  },
  stats: {
    fontWeight: '500',
    marginTop: 2,
  },
  description: {
    marginTop: 8,
    lineHeight: 18,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  joinBtn: {
    flex: 1,
    marginRight: 10,
    borderRadius: 8,
    paddingVertical: 8,
  },
  viewBtn: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonCard: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 10,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 240,
  },
});
