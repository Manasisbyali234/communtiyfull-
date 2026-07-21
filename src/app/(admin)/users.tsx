import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import AdminShell from '../../components/admin/AdminShell';
import { SearchBar, SectionCard, Skeleton, EmptyState, Pagination, Badge, ActionBtn, TableRow, T, COL, MobileCard, MobileCardRow, useIsMobile } from '../../components/admin/AdminUI';
import { adminApiClient } from '../../api/adminClient';
import { fmtDateTime } from '../../utils/adminUtils';

const FILTERS = ['all', 'active', 'blocked', 'verified'];
const COLS: { label: string; style: object }[] = [
  { label: 'User',        style: COL.user },
  { label: 'Email',       style: COL.lg   },
  { label: 'Status',      style: COL.sm   },
  { label: 'Role',        style: COL.sm   },
  { label: 'Posts',       style: COL.xs   },
  { label: 'Communities', style: COL.xs   },
  { label: 'Events',      style: COL.xs   },
  { label: 'Joined',      style: COL.md   },
  { label: 'Actions',     style: COL.act  },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { skip, take: 20, q: q || undefined };
      if (filter === 'active') params.status = 'active';
      if (filter === 'blocked') params.status = 'blocked';
      if (filter === 'verified') params.isVerified = true;
      const res = await adminApiClient.get('/admin-panel/users', { params });
      setUsers(res.data.data.users);
      setTotal(res.data.data.total);
    } catch {}
    setLoading(false);
  }, [skip, q, filter]);

  useEffect(() => { setSkip(0); }, [q, filter]);
  useEffect(() => { load(); }, [load]);

  const ban = async (id: string) => {
    try { await adminApiClient.put(`/admin-panel/users/${id}/ban`, { reason: 'Admin action' }); load(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed to ban user'); }
  };
  const unban = async (id: string) => {
    try { await adminApiClient.put(`/admin-panel/users/${id}/unban`); load(); }
    catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed to unban user'); }
  };
  const del = (id: string) => {
    const doDelete = async () => {
      try { await adminApiClient.delete(`/admin-panel/users/${id}`); load(); }
      catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed to delete user'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this user?')) doDelete();
    } else {
      Alert.alert('Delete User', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  function renderMobile() {
    if (loading) return <Skeleton rows={6} />;
    if (users.length === 0) return <EmptyState />;
    return users.map((u) => (
      <MobileCard key={u.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={T.avatar}>
            {u.avatarUrl
              ? <Image source={{ uri: u.avatarUrl }} style={T.avatarImg} />
              : <Text style={T.avatarFallback}>{u.displayName?.[0]?.toUpperCase()}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.cellPrimary}>{u.displayName}</Text>
            <Text style={T.cellSub}>@{u.username}</Text>
          </View>
          <Badge label={u.isBanned ? 'blocked' : u.isActive ? 'active' : 'inactive'} />
        </View>
        <MobileCardRow label="Email"><Text style={T.td}>{u.email}</Text></MobileCardRow>
        <MobileCardRow label="Role"><Text style={T.td}>{u.role}</Text></MobileCardRow>
        <MobileCardRow label="Stats">
          <Text style={T.td}>{u._count?.posts ?? 0} posts · {u._count?.communityMembers ?? 0} comm · {u._count?.eventRsvps ?? 0} events</Text>
        </MobileCardRow>
        <MobileCardRow label="Joined"><Text style={T.tdMuted}>{fmtDateTime(u.createdAt)}</Text></MobileCardRow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {u.isBanned
            ? <ActionBtn label="Unban" onPress={() => unban(u.id)} variant="success" />
            : <ActionBtn label="Ban"   onPress={() => ban(u.id)}   variant="danger" />
          }
          <ActionBtn label="Delete" onPress={() => del(u.id)} variant="danger" />
        </View>
      </MobileCard>
    ));
  }

  function renderDesktop() {
    if (loading) return <Skeleton rows={8} />;
    if (users.length === 0) return <EmptyState />;
    return users.map((u, i) => (
      <TableRow key={u.id} even={i % 2 === 0}>
        <View style={[T.td, COL.user, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={T.avatar}>
            {u.avatarUrl
              ? <Image source={{ uri: u.avatarUrl }} style={T.avatarImg} />
              : <Text style={T.avatarFallback}>{u.displayName?.[0]?.toUpperCase()}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.cellPrimary} numberOfLines={1}>{u.displayName}</Text>
            <Text style={T.cellSub} numberOfLines={1}>@{u.username}</Text>
          </View>
        </View>
        <Text style={[T.td, COL.lg]} numberOfLines={1}>{u.email}</Text>
        <View style={[T.td, COL.sm]}>
          <Badge label={u.isBanned ? 'blocked' : u.isActive ? 'active' : 'inactive'} />
          {u.isVerified && <Badge label="verified" />}
        </View>
        <Text style={[T.td, COL.sm]}>{u.role}</Text>
        <Text style={[T.td, COL.xs]}>{u._count?.posts ?? 0}</Text>
        <Text style={[T.td, COL.xs]}>{u._count?.communityMembers ?? 0}</Text>
        <Text style={[T.td, COL.xs]}>{u._count?.eventRsvps ?? 0}</Text>
        <Text style={[T.tdMuted, COL.md]} numberOfLines={1}>{fmtDateTime(u.createdAt)}</Text>
        <View style={[T.td, COL.act, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {u.isBanned
            ? <ActionBtn label="Unban" onPress={() => unban(u.id)} variant="success" />
            : <ActionBtn label="Ban"   onPress={() => ban(u.id)}   variant="danger" />
          }
          <ActionBtn label="Delete" onPress={() => del(u.id)} variant="danger" />
        </View>
      </TableRow>
    ));
  }

  return (
    <AdminShell title="Users">
      <SectionCard>
        <View style={T.toolbar}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search by name, email, username…" />
          <View style={T.filters}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f} style={[T.filterBtn, filter === f && T.filterActive]} onPress={() => setFilter(f)}>
                <Text style={[T.filterText, filter === f && T.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isMobile ? (
          <View style={{ padding: 12 }}>{renderMobile()}</View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 960 }}>
              <View style={T.header}>
                {COLS.map((h) => (
                  <Text key={h.label} style={[T.th, h.style]}>{h.label}</Text>
                ))}
              </View>
      {renderDesktop()}
            </View>
          </ScrollView>
        )}
        <Pagination skip={skip} take={20} total={total} onPage={setSkip} />
      </SectionCard>
    </AdminShell>
  );
}
