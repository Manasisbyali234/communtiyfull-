import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AdminShell from '../../components/admin/AdminShell';
import { StatCard, SectionCard, LoadingOverlay, EmptyState, C } from '../../components/admin/AdminUI';
import { adminApiClient } from '../../api/adminClient';
import { useAdminStore } from '../../store/adminStore';
import { formatDistanceToNow, fmtDate, fmtTime } from '../../utils/adminUtils';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const STAT_CONFIG: { key: string; label: string; icon: FeatherIconName; color: string }[] = [
  { key: 'totalUsers',          label: 'Total Users',      icon: 'users',       color: '#2563EB' },
  { key: 'totalProfiles',       label: 'Profiles',         icon: 'user',        color: '#7C3AED' },
  { key: 'totalCommunities',    label: 'Communities',      icon: 'globe',       color: '#059669' },
  { key: 'totalCommunityPosts', label: 'Community Posts',  icon: 'file-text',   color: '#D97706' },
  { key: 'totalEvents',         label: 'Events',           icon: 'calendar',    color: '#DC2626' },
  { key: 'totalFeeds',          label: 'Feeds',            icon: 'rss',         color: '#0891B2' },
  { key: 'totalStories',        label: 'Stories',          icon: 'book-open',   color: '#9333EA' },
  { key: 'totalComments',       label: 'Comments',         icon: 'message-circle', color: '#16A34A' },
  { key: 'totalLikes',          label: 'Likes',            icon: 'heart',       color: '#E11D48' },
  { key: 'activeToday',         label: 'Active Today',     icon: 'activity',    color: '#0D9488' },
];

export default function AdminDashboard() {
  const { width: screenW } = useWindowDimensions();
  const IS_SMALL = screenW < 480;
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Wait for adminStore to rehydrate so token is available
      if (!useAdminStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = useAdminStore.persist.onFinishHydration(() => { unsub(); resolve(); });
          setTimeout(resolve, 300);
        });
      }
      const token = useAdminStore.getState().token;
      if (!token) { setError('Missing admin token'); setLoading(false); return; }
      const [statsRes, activityRes] = await Promise.all([
        adminApiClient.get('/admin-panel/dashboard'),
        adminApiClient.get('/admin-panel/recent-activity'),
      ]);
      setStats(statsRes.data.data);
      setActivity(activityRes.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? 'Failed to load dashboard');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminShell title="Dashboard">
      {error ? (
        <View style={{ margin: 16, padding: 14, backgroundColor: '#FFCDD2', borderRadius: 8 }}>
          <Text style={{ color: '#B71C1C', fontWeight: '700', marginBottom: 4 }}>Failed to load dashboard</Text>
          <Text style={{ color: '#B71C1C', fontSize: 12 }}>{error}</Text>
        </View>
      ) : null}
      {loading ? <LoadingOverlay /> : (
        <>
          <View style={s.statsGrid}>
            {[0, 2, 4, 6, 8].map((start) =>
              STAT_CONFIG.slice(start, start + 2).length > 0 ? (
                <View key={start} style={s.statsRow}>
                  {STAT_CONFIG.slice(start, start + 2).map((cfg) => (
                    <StatCard key={cfg.key} label={cfg.label} value={stats[cfg.key] ?? 0} icon={cfg.icon} color={cfg.color} />
                  ))}
                </View>
              ) : null
            )}
          </View>

          <SectionCard>
            {/* Header */}
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={load} style={s.refreshBtn}>
                <Text style={s.refreshText}>↻ Refresh</Text>
              </TouchableOpacity>
            </View>

            {activity.length === 0 ? <EmptyState message="No recent activity" /> : IS_SMALL ? (
              /* Mobile card layout */
              activity.map((item, i) => (
                <View key={i} style={[s.mobileCard, i % 2 === 0 && s.rowEven]}>
                  <View style={s.mobileCardTop}>
                    <View style={s.avatar}>
                      {item.user?.avatarUrl
                        ? <Image source={{ uri: item.user.avatarUrl }} style={s.avatarImg} />
                        : <Text style={s.avatarFallback}>{item.user?.displayName?.[0]?.toUpperCase() ?? '?'}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{item.user?.displayName ?? 'Unknown'}</Text>
                      <Text style={s.email} numberOfLines={1}>{item.user?.email ?? ''}</Text>
                    </View>
                    <Text style={s.relative}>{formatDistanceToNow(item.date)}</Text>
                  </View>
                  <Text style={s.mobileAction}>{item.action}</Text>
                </View>
              ))
            ) : (
              /* Desktop table layout */
              <>
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 2 }]}>User</Text>
                  <Text style={s.th}>Action</Text>
                  <Text style={[s.th, { textAlign: 'right' }]}>Time</Text>
                </View>
                {activity.map((item, i) => (
                  <View key={i} style={[s.row, i % 2 === 0 && s.rowEven]}>
                    <View style={[s.cell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={s.avatar}>
                        {item.user?.avatarUrl
                          ? <Image source={{ uri: item.user.avatarUrl }} style={s.avatarImg} />
                          : <Text style={s.avatarFallback}>{item.user?.displayName?.[0]?.toUpperCase() ?? '?'}</Text>
                        }
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{item.user?.displayName ?? 'Unknown'}</Text>
                        <Text style={s.email} numberOfLines={1}>{item.user?.email ?? ''}</Text>
                      </View>
                    </View>
                    <Text style={[s.cell, s.action]} numberOfLines={2}>{item.action}</Text>
                    <View style={[s.cell, { alignItems: 'flex-end' }]}>
                      <Text style={s.date}>{fmtDate(item.date)} {fmtTime(item.date)}</Text>
                      <Text style={s.relative}>{formatDistanceToNow(item.date)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </SectionCard>
        </>
      )}
    </AdminShell>
  );
}

const s = StyleSheet.create({
  statsGrid: { marginBottom: 16, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },

  mobileCard: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  mobileCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  mobileAction: { fontSize: 12, color: C.textSecond, marginLeft: 46 },


  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  refreshText: { fontSize: 12, color: C.accent, fontWeight: '600' },

  tableHeader: {
    flexDirection: 'row', backgroundColor: C.headerBg,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: C.border,
  },
  th: { flex: 1, fontSize: 11, fontWeight: '700', color: C.textSecond, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rowEven: { backgroundColor: C.rowEven },
  cell: { flex: 1 },

  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: C.accentBorder,
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { color: C.accent, fontWeight: '700', fontSize: 14 },

  name: { fontSize: 13, fontWeight: '600', color: C.textPrimary },
  email: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  action: { fontSize: 13, color: C.textSecond },
  date: { fontSize: 11, color: C.textMuted },
  relative: { fontSize: 11, color: C.accent, fontWeight: '600', marginTop: 2 },
});
