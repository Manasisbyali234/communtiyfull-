import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import AdminShell from '../../components/admin/AdminShell';
import { SectionCard, Skeleton, EmptyState, T, COL, TableRow, MobileCard, MobileCardRow, useIsMobile } from '../../components/admin/AdminUI';
import { apiClient } from '../../api/client';
import { fmtDateTime } from '../../utils/adminUtils';

type Tab = 'shares' | 'referrals';

export default function AdminReferrals() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('shares');
  const [shares, setShares] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sharesRes, referralsRes] = await Promise.all([
        apiClient.get('/referral/admin/all'),
        apiClient.get('/referral/admin/referrals'),
      ]);
      setShares(sharesRes.data.data ?? []);
      setReferrals(referralsRes.data.data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function renderShares() {
    if (loading) return <Skeleton rows={6} />;
    if (shares.length === 0) return <EmptyState />;
    if (isMobile) {
      return shares.map((s) => (
        <MobileCard key={s.id}>
          <Text style={T.cellPrimary}>{s.sharer?.displayName ?? '—'}</Text>
          <Text style={T.cellSub}>{s.sharer?.email ?? '—'}</Text>
          <MobileCardRow label="Shared With"><Text style={T.td}>{s.sharedWith || '—'}</Text></MobileCardRow>
          <MobileCardRow label="Shared Email"><Text style={T.td}>{s.sharedEmail || '—'}</Text></MobileCardRow>
          <MobileCardRow label="Date"><Text style={T.tdMuted}>{fmtDateTime(s.createdAt)}</Text></MobileCardRow>
        </MobileCard>
      ));
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 700 }}>
          <View style={T.header}>
            {['Sharer', 'Sharer Email', 'Shared With', 'Shared Email', 'Date'].map((h) => (
              <Text key={h} style={[T.th, { flex: 1 }]}>{h}</Text>
            ))}
          </View>
          {shares.map((s, i) => (
            <TableRow key={s.id} even={i % 2 === 0}>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{s.sharer?.displayName ?? '—'}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{s.sharer?.email ?? '—'}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{s.sharedWith || '—'}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{s.sharedEmail || '—'}</Text>
              <Text style={[T.tdMuted, { flex: 1 }]} numberOfLines={1}>{fmtDateTime(s.createdAt)}</Text>
            </TableRow>
          ))}
        </View>
      </ScrollView>
    );
  }

  function renderReferrals() {
    if (loading) return <Skeleton rows={6} />;
    if (referrals.length === 0) return <EmptyState />;
    if (isMobile) {
      return referrals.map((r) => (
        <MobileCard key={r.id}>
          <Text style={T.cellPrimary}>{r.displayName}</Text>
          <Text style={T.cellSub}>{r.email}</Text>
          <MobileCardRow label="Referred By"><Text style={T.td}>{r.referredBy?.displayName ?? '—'}</Text></MobileCardRow>
          <MobileCardRow label="Referrer Email"><Text style={T.td}>{r.referredBy?.email ?? '—'}</Text></MobileCardRow>
          <MobileCardRow label="Joined"><Text style={T.tdMuted}>{fmtDateTime(r.createdAt)}</Text></MobileCardRow>
        </MobileCard>
      ));
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 700 }}>
          <View style={T.header}>
            {['New User', 'Email', 'Referred By', 'Referrer Email', 'Joined'].map((h) => (
              <Text key={h} style={[T.th, { flex: 1 }]}>{h}</Text>
            ))}
          </View>
          {referrals.map((r, i) => (
            <TableRow key={r.id} even={i % 2 === 0}>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{r.displayName}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{r.email}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{r.referredBy?.displayName ?? '—'}</Text>
              <Text style={[T.td, { flex: 1 }]} numberOfLines={1}>{r.referredBy?.email ?? '—'}</Text>
              <Text style={[T.tdMuted, { flex: 1 }]} numberOfLines={1}>{fmtDateTime(r.createdAt)}</Text>
            </TableRow>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <AdminShell title="Referrals">
      <SectionCard>
        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          {(['shares', 'referrals'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                backgroundColor: tab === t ? '#2D6A2D' : '#F3F4F6',
              }}
            >
              <Text style={{ color: tab === t ? '#FFF' : '#374151', fontWeight: '600', fontSize: 13 }}>
                {t === 'shares'
                  ? `Shares (${shares.length})`
                  : `Registered via Referral (${referrals.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ padding: isMobile ? 12 : 0 }}>
          {tab === 'shares' ? renderShares() : renderReferrals()}
        </View>
      </SectionCard>
    </AdminShell>
  );
}
