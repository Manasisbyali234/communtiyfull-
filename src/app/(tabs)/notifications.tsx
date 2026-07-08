import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useNotificationsQuery, useMarkAllReadMutation, useNotificationSocket } from '../../api/chat';
import { useAcceptConnectionMutation, useRejectConnectionMutation } from '../../api/connections';
import Avatar from '../../components/common/Avatar';
import Skeleton from '../../components/feedback/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '../../store/toastStore';

type IconCfg = { name: any; color: string; bg: string };

const ICON_MAP: Record<string, IconCfg> = {
  LIKE:                { name: 'heart',           color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  COMMENT:             { name: 'chatbubble',       color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  FOLLOW:              { name: 'person-add',       color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  MENTION:             { name: 'at',              color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  MESSAGE:             { name: 'chatbubbles',      color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  STORY_REPLY:         { name: 'arrow-undo',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  STORY_LIKE:          { name: 'heart-circle',     color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  POST_SHARE:          { name: 'share-social',     color: '#14B8A6', bg: 'rgba(20,184,166,0.1)' },
  COMMUNITY_JOIN:      { name: 'people',           color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
  COMMUNITY_INVITE:    { name: 'mail',             color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  EVENT_REMINDER:      { name: 'calendar',         color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
  CONNECTION_REQUEST:  { name: 'people',           color: '#1565C0', bg: 'rgba(21,101,192,0.1)' },
  CONNECTION_ACCEPTED: { name: 'checkmark-circle', color: '#2E7D32', bg: 'rgba(46,125,50,0.1)' },
};

const formatTime = (createdAt: string) => {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);

  const { data: notifications = [], isLoading } = useNotificationsQuery();
  const markAllRead = useMarkAllReadMutation();
  const acceptConn = useAcceptConnectionMutation();
  const rejectConn = useRejectConnectionMutation();
  useNotificationSocket();

  const renderIcon = (type: string) => {
    const cfg = ICON_MAP[type] ?? ICON_MAP['COMMUNITY_JOIN'];
    return (
      <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.name} size={12} color={cfg.color} />
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const isConnRequest = item.type === 'CONNECTION_REQUEST';
    return (
      <View
        style={[
          styles.row,
          {
            borderBottomColor: colors.borderSecondary,
            backgroundColor: item.isRead ? 'transparent' : 'rgba(99,102,241,0.05)',
          },
        ]}
      >
        <View style={styles.avatarWrap}>
          <Avatar url={item.actor?.avatarUrl} name={item.actor?.displayName ?? '?'} size={44} />
          <View style={styles.badgeWrap}>{renderIcon(item.type)}</View>
        </View>

        <View style={styles.details}>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.text, lineHeight: 18 }}>
            <Text style={{ fontWeight: 'bold' }}>{item.actor?.displayName ?? 'Someone'}</Text>
            {item.body ? ` ${item.body}` : ''}
          </Text>
          <Text style={{ marginTop: 2, color: colors.textMuted, fontSize: typography.sizes.xs }}>
            {formatTime(item.createdAt)}
          </Text>

          {isConnRequest && item.entityId && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                disabled={acceptConn.isPending || rejectConn.isPending}
                onPress={() => acceptConn.mutate(item.entityId, {
                  onSuccess: () => showToast('Connection accepted!', 'success'),
                  onError: (e: any) => showToast(e?.response?.data?.message || 'Failed', 'error'),
                })}
              >
                {acceptConn.isPending
                  ? <ActivityIndicator size={12} color="#FFF" />
                  : <Text style={styles.acceptTxt}>Accept</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, { borderColor: colors.border }]}
                disabled={acceptConn.isPending || rejectConn.isPending}
                onPress={() => rejectConn.mutate(item.entityId, {
                  onSuccess: () => showToast('Request rejected', 'info'),
                  onError: (e: any) => showToast(e?.response?.data?.message || 'Failed', 'error'),
                })}
              >
                {rejectConn.isPending
                  ? <ActivityIndicator size={12} color={colors.textMuted} />
                  : <Text style={[styles.rejectTxt, { color: colors.textSecondary }]}>Reject</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!item.isRead && !isConnRequest && (
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.navbar, { borderBottomColor: colors.borderSecondary }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text, fontSize: typography.sizes.lg }]}>
          Notifications
        </Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => markAllRead.mutate(undefined, {
            onSuccess: () => showToast('All marked as read', 'success'),
          })}
        >
          <Ionicons name="checkmark-done" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ padding: 20 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Skeleton width={44} height={44} borderRadius={22} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Skeleton width="65%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="25%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={44} color={colors.textMuted} />
              <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: typography.sizes.sm, fontWeight: '500' }}>
                No notifications yet
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  navBtn: { padding: 4 },
  navTitle: { fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: { position: 'relative' },
  badgeWrap: { position: 'absolute', bottom: -2, right: -2 },
  iconBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  details: { flex: 1, marginLeft: 14, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  acceptTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  rejectTxt: { fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 160 },
});
