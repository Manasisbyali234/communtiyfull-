import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import AdminShell from '../../components/admin/AdminShell';
import { SearchBar, SectionCard, Skeleton, EmptyState, Pagination, TableRow, T, COL, MobileCard, MobileCardRow, useIsMobile } from '../../components/admin/AdminUI';
import { adminApiClient } from '../../api/adminClient';
import { fmtDate } from '../../utils/adminUtils';

const COLS: { label: string; style: object }[] = [
  { label: 'Profile',   style: COL.user },
  { label: 'Username',  style: COL.lg   },
  { label: 'Bio',       style: COL.xl   },
  { label: 'Followers', style: COL.xs   },
  { label: 'Following', style: COL.xs   },
  { label: 'Posts',     style: COL.xs   },
  { label: 'Created',   style: COL.md   },
  { label: 'Updated',   style: COL.md   },
];

export default function AdminProfiles() {
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApiClient.get('/admin-panel/profiles', { params: { skip, take: 20, q: q || undefined } });
      setProfiles(res.data.data.profiles);
      setTotal(res.data.data.total);
    } catch {}
    setLoading(false);
  }, [skip, q]);

  useEffect(() => { setSkip(0); }, [q]);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminShell title="Profiles">
      <SectionCard>
        <View style={T.toolbar}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search profiles…" />
        </View>

        {isMobile ? (
          <View style={{ padding: 12 }}>
            {loading ? <Skeleton rows={6} /> : profiles.length === 0 ? <EmptyState /> : (
              profiles.map((p) => (
                <MobileCard key={p.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={T.avatar}>
                      {p.avatarUrl
                        ? <Image source={{ uri: p.avatarUrl }} style={T.avatarImg} />
                        : <Text style={T.avatarFallback}>{p.displayName?.[0]?.toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={T.cellPrimary}>{p.displayName}</Text>
                      <Text style={T.cellSub}>@{p.username}</Text>
                    </View>
                  </View>
                  {p.bio ? <MobileCardRow label="Bio"><Text style={T.tdMuted} numberOfLines={2}>{p.bio}</Text></MobileCardRow> : null}
                  <MobileCardRow label="Stats">
                    <Text style={T.td}>👥 {p._count?.followers ?? 0} · ➡️ {p._count?.following ?? 0} · 📝 {p._count?.posts ?? 0}</Text>
                  </MobileCardRow>
                  <MobileCardRow label="Created"><Text style={T.tdMuted}>{fmtDate(p.createdAt)}</Text></MobileCardRow>
                </MobileCard>
              ))
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 860 }}>
              <View style={T.header}>
                {COLS.map((h) => (
                  <Text key={h.label} style={[T.th, h.style]}>{h.label}</Text>
                ))}
              </View>
              {loading ? <Skeleton rows={8} /> : profiles.length === 0 ? <EmptyState /> : (
                profiles.map((p, i) => (
                  <TableRow key={p.id} even={i % 2 === 0}>
                    <View style={[T.td, COL.user, { flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={T.avatar}>
                        {p.avatarUrl
                          ? <Image source={{ uri: p.avatarUrl }} style={T.avatarImg} />
                          : <Text style={T.avatarFallback}>{p.displayName?.[0]?.toUpperCase()}</Text>
                        }
                      </View>
                      <Text style={T.cellPrimary} numberOfLines={1}>{p.displayName}</Text>
                    </View>
                    <Text style={[T.td, COL.lg]} numberOfLines={1}>@{p.username}</Text>
                    <Text style={[T.tdMuted, COL.xl]} numberOfLines={2}>{p.bio ?? '—'}</Text>
                    <Text style={[T.td, COL.xs]}>{p._count?.followers ?? 0}</Text>
                    <Text style={[T.td, COL.xs]}>{p._count?.following ?? 0}</Text>
                    <Text style={[T.td, COL.xs]}>{p._count?.posts ?? 0}</Text>
                    <Text style={[T.tdMuted, COL.md]} numberOfLines={1}>{fmtDate(p.createdAt)}</Text>
                    <Text style={[T.tdMuted, COL.md]} numberOfLines={1}>{fmtDate(p.updatedAt)}</Text>
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
