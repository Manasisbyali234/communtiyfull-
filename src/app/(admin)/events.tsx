import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import AdminShell from '../../components/admin/AdminShell';
import { SearchBar, SectionCard, Skeleton, EmptyState, Pagination, ActionBtn, TableRow, T, COL, MobileCard, MobileCardRow, useIsMobile } from '../../components/admin/AdminUI';
import { adminApiClient } from '../../api/adminClient';
import { fmtDate, fmtDateTime } from '../../utils/adminUtils';
import { getApiBaseUrl } from '../../api/config';

const toAbsCover = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const base = getApiBaseUrl().replace('/api/v1', '');
  return `${base}${url}`;
};

const COLS: { label: string; style: object }[] = [
  { label: 'Banner',   style: COL.xs   },
  { label: 'Event',    style: COL.xl   },
  { label: 'Community',style: COL.lg   },
  { label: 'Location', style: COL.lg   },
  { label: 'Starts At',style: COL.md   },
  { label: 'RSVPs',    style: COL.xs   },
  { label: 'Status',   style: COL.sm   },
  { label: 'Created',  style: COL.md   },
  { label: 'Actions',  style: COL.act  },
];

const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default function AdminEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);

  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApiClient.get('/admin-panel/events', {
        params: { skip, take: 20, q: q || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter },
      });
      setEvents(res.data.data.events);
      setTotal(res.data.data.total);
    } catch {}
    setLoading(false);
  }, [skip, q, statusFilter]);

  useEffect(() => { setSkip(0); }, [q, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    await adminApiClient.put(`/admin-panel/events/${id}/approve`);
    load();
  };

  const reject = async (id: string) => {
    await adminApiClient.put(`/admin-panel/events/${id}/reject`);
    load();
  };

  const del = async (id: string) => {
    const doDelete = async () => {
      await adminApiClient.delete(`/admin-panel/events/${id}`);
      load();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this event?')) doDelete();
    } else {
      Alert.alert('Delete Event', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <AdminShell title="Events">
      <SectionCard>
        <View style={T.toolbar}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search events…" />
          <View style={T.filters}>
            {STATUS_FILTERS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={[T.filterBtn, statusFilter === s && T.filterActive]}
              >
                <Text style={[T.filterText, statusFilter === s && T.filterTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isMobile ? (
          <View style={{ padding: 12 }}>
            {loading ? <Skeleton rows={6} /> : events.length === 0 ? <EmptyState /> : (
              events.map((e) => (
                <MobileCard key={e.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    {e.coverUrl
                      ? <Image source={{ uri: toAbsCover(e.coverUrl) }} style={{ width: 60, height: 40, borderRadius: 6, marginRight: 10 }} />
                      : <View style={{ width: 60, height: 40, borderRadius: 6, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                          <Text>📅</Text>
                        </View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={T.cellPrimary}>{e.title}</Text>
                      <Text style={T.cellSub} numberOfLines={1}>{e.description}</Text>
                    </View>
                  </View>
                  <MobileCardRow label="Community"><Text style={T.td}>{e.community?.name ?? '—'}</Text></MobileCardRow>
                  <MobileCardRow label="Location"><Text style={T.td}>{e.location ?? '—'}</Text></MobileCardRow>
                  <MobileCardRow label="Starts At"><Text style={T.tdMuted}>{fmtDate(e.startsAt)}</Text></MobileCardRow>
                  <MobileCardRow label="RSVPs"><Text style={T.td}>{e.rsvpCount}</Text></MobileCardRow>
                  <MobileCardRow label="Status"><Text style={T.td}>{STATUS_LABEL[e.status] ?? e.status}</Text></MobileCardRow>
                  <MobileCardRow label="Created"><Text style={T.tdMuted}>{fmtDateTime(e.createdAt)}</Text></MobileCardRow>
                  <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {e.status === 'PENDING_APPROVAL' && <ActionBtn label="Approve" onPress={() => approve(e.id)} variant="success" />}
                    {e.status === 'PENDING_APPROVAL' && <ActionBtn label="Reject" onPress={() => reject(e.id)} variant="danger" />}
                    <ActionBtn label="Delete" onPress={() => del(e.id)} variant="danger" />
                  </View>
                </MobileCard>
              ))
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1100 }}>
              <View style={T.header}>
                {COLS.map((h) => (
                  <Text key={h.label} style={[T.th, h.style]}>{h.label}</Text>
                ))}
              </View>
              {loading ? <Skeleton rows={8} /> : events.length === 0 ? <EmptyState /> : (
                events.map((e, i) => (
                  <TableRow key={e.id} even={i % 2 === 0}>
                    <View style={[T.td, COL.xs]}>
                      {e.coverUrl
                        ? <Image source={{ uri: toAbsCover(e.coverUrl) }} style={{ width: 54, height: 36, borderRadius: 6 }} />
                        : <View style={{ width: 54, height: 36, borderRadius: 6, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                            <Text>📅</Text>
                          </View>
                      }
                    </View>
                    <View style={[T.td, COL.xl]}>
                      <Text style={T.cellPrimary} numberOfLines={1}>{e.title}</Text>
                      <Text style={T.cellSub} numberOfLines={1}>{e.description}</Text>
                    </View>
                    <Text style={[T.td, COL.lg]} numberOfLines={1}>{e.community?.name ?? '—'}</Text>
                    <Text style={[T.td, COL.lg]} numberOfLines={1}>{e.location ?? '—'}</Text>
                    <Text style={[T.tdMuted, COL.md]} numberOfLines={1}>{fmtDate(e.startsAt)}</Text>
                    <Text style={[T.td, COL.xs]}>{e.rsvpCount}</Text>
                    <Text style={[T.td, COL.sm]} numberOfLines={1}>{STATUS_LABEL[e.status] ?? e.status}</Text>
                    <Text style={[T.tdMuted, COL.md]} numberOfLines={1}>{fmtDateTime(e.createdAt)}</Text>
                    <View style={[T.td, COL.act, { flexDirection: 'row', flexWrap: 'wrap' }]}>
                      {e.status === 'PENDING_APPROVAL' && <ActionBtn label="Approve" onPress={() => approve(e.id)} variant="success" />}
                      {e.status === 'PENDING_APPROVAL' && <ActionBtn label="Reject" onPress={() => reject(e.id)} variant="danger" />}
                      <ActionBtn label="Delete" onPress={() => del(e.id)} variant="danger" />
                    </View>
                  </TableRow>
                ))
              )}
            </View>
          </ScrollView>
        )}
        <Pagination skip={skip} take={20} total={total} onPage={setSkip} />
      </SectionCard>
    </AdminShell>
  );
}
