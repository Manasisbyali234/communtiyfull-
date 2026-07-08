import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useChatsQuery, useStartConversationMutation } from '../../api/chat';
import Avatar from '../../components/common/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../../types';
import { useSearchUsersQuery } from '../../api/user';

export default function ChatListScreen() {
  const { colors, spacing, typography, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: chats = [], isLoading } = useChatsQuery();
  const [searchText, setSearchText] = useState('');
  const startConversation = useStartConversationMutation();

  const isSearching = searchText.trim().length > 0;

  const filteredChats = chats.filter((c: Conversation) => {
    if (!isSearching) return true;
    const q = searchText.toLowerCase();
    const name = (c.participant?.displayName || c.participant?.username || '').toLowerCase();
    return name.includes(q);
  });

  const { data: searchedUsers = [] } = useSearchUsersQuery(isSearching ? searchText.trim() : '');

  const renderChatItem = ({ item }: { item: Conversation }) => {
    const isUnread = (item.unreadCount || 0) > 0;
    
    // Format the time
    let timeString = '';
    if (item.lastMessage) {
      try {
        const date = new Date(item.lastMessage.createdAt);
        timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    return (
      <TouchableOpacity
        style={[styles.chatItem, { borderBottomColor: colors.borderSecondary }]}
        activeOpacity={0.7}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <Avatar url={item.participant?.avatarUrl || ''} name={item.participant?.displayName || 'Unknown'} size={50} online={item.participant?.isOnline} />
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.displayName, { color: colors.text, fontSize: typography.sizes.md }]}>
              {item.participant?.displayName || 'Unknown'}
            </Text>
            <Text style={[styles.timeText, { color: isUnread ? colors.primary : colors.textMuted, fontSize: typography.sizes.xs }]}>
              {timeString}
            </Text>
          </View>
          
          <View style={styles.messagePreviewContainer}>
            <Text 
              style={[
                styles.messagePreview, 
                { 
                  color: isUnread ? colors.text : colors.textSecondary,
                  fontWeight: isUnread ? '600' : '400',
                  fontSize: typography.sizes.sm
                }
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'Started a new conversation'}
            </Text>
            
            {isUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderSecondary }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.lg }]}>
          Messages
        </Text>
        <TouchableOpacity style={styles.newChatBtn} onPress={() => router.push('/chat/new')}>
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderRadius: 10 }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by name or @username..."
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            style={[styles.searchInput, { color: colors.text, fontSize: typography.sizes.sm }]}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: typography.sizes.md }]}>
            No messages yet.
          </Text>
        </View>
      ) : isSearching && filteredChats.length === 0 ? (
        <FlatList
          data={searchedUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chatItem, { borderBottomColor: colors.borderSecondary }]}
              activeOpacity={0.7}
              disabled={startConversation.isPending}
              onPress={() =>
                startConversation.mutate({ participantId: item.id }, {
                  onSuccess: (conv) => router.push(`/chat/${conv.id}`),
                })
              }
            >
              <Avatar url={item.avatarUrl || ''} name={item.displayName || item.username} size={50} />
              <View style={styles.chatInfo}>
                <Text style={[styles.displayName, { color: colors.text, fontSize: typography.sizes.md }]}>
                  {item.displayName || item.username}
                </Text>
                <Text style={[{ color: colors.textSecondary, fontSize: typography.sizes.xs }]}>
                  @{item.username}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: typography.sizes.sm }]}>
                No users found.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: '700',
  },
  newChatBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  displayName: {
    fontWeight: '700',
  },
  timeText: {
    fontWeight: '500',
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
