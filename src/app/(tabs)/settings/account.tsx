import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../store/authStore';
import { useToastStore } from '../../../store/toastStore';
import { apiClient } from '../../../api/client';

export default function AccountScreen() {
  const { colors: C, typography: T, roundness } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          showToast('Signed out successfully', 'info');
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently deactivate your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.delete('/users/me');
              await logout();
              showToast('Account deleted', 'info');
            } catch {
              showToast('Failed to delete account. Try again.', 'error');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <View style={[styles.navbar, { borderBottomColor: C.borderSecondary }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/settings/account')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text, fontSize: T.sizes.lg }]}>Account</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        {/* User info */}
        {user && (
          <View style={[styles.userCard, { backgroundColor: C.cardBg, borderColor: C.border, borderRadius: roundness.lg }]}>
            <View style={[styles.avatarCircle, { backgroundColor: C.primaryContainer }]}>
              <Ionicons name="person" size={28} color={C.primary} />
            </View>
            <View>
              <Text style={[styles.userName, { color: C.text, fontSize: T.sizes.md }]}>{user.displayName}</Text>
              <Text style={[styles.userEmail, { color: C.textMuted, fontSize: T.sizes.xs }]}>{user.email ?? `@${user.username}`}</Text>
            </View>
          </View>
        )}

        {/* Sign out */}
        <Text style={[styles.sectionLabel, { color: C.textMuted, fontSize: T.sizes.xs }]}>SESSION</Text>
        <View style={[styles.card, { backgroundColor: C.cardBg, borderColor: C.border, borderRadius: roundness.md }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: C.errorContainer }]}>
              <Ionicons name="log-out-outline" size={18} color={C.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.error, fontSize: T.sizes.md }]}>Sign Out</Text>
              <Text style={[styles.rowSub, { color: C.textMuted, fontSize: T.sizes.xs }]}>Sign out of your account on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <Text style={[styles.sectionLabel, { color: C.error, fontSize: T.sizes.xs }]}>DANGER ZONE</Text>
        <View style={[styles.card, { backgroundColor: C.cardBg, borderColor: C.error + '40', borderRadius: roundness.md }]}>
          <TouchableOpacity style={styles.row} onPress={handleDelete} activeOpacity={0.7} disabled={deleting}>
            <View style={[styles.iconBox, { backgroundColor: C.errorContainer }]}>
              {deleting
                ? <ActivityIndicator size="small" color={C.error} />
                : <Ionicons name="trash-outline" size={18} color={C.error} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: C.error, fontSize: T.sizes.md }]}>Delete Account</Text>
              <Text style={[styles.rowSub, { color: C.textMuted, fontSize: T.sizes.xs }]}>Permanently remove your account and all data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.warningBox, { backgroundColor: C.errorContainer, borderRadius: roundness.md }]}>
          <Ionicons name="warning-outline" size={18} color={C.error} />
          <Text style={[styles.warningText, { color: C.error, fontSize: T.sizes.xs }]}>
            Deleting your account is permanent and cannot be undone. All your posts, connections, and data will be removed.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  navTitle: { fontWeight: '700' },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  userName: { fontWeight: '700' },
  userEmail: { marginTop: 2 },
  sectionLabel: { fontWeight: '700', marginTop: 22, marginBottom: 8, marginLeft: 4, letterSpacing: 0.8 },
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontWeight: '600' },
  rowSub: { marginTop: 2 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginTop: 16 },
  warningText: { flex: 1, lineHeight: 18 },
});
