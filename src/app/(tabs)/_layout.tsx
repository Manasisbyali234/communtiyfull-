import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import BottomSheet from '../../components/common/BottomSheet';
import { useUnreadCountQuery } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';

// M3 FAB tab button for the center "Create" tab
function CreatePostTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fab,
        {
          backgroundColor: focused ? colors.secondary : colors.primary,
          shadowColor: colors.primary,
        },
      ]}
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </View>
  );
}

export default function TabsLayout() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCountQuery();
  const user = useAuthStore((s) => s.user);

  const handleCreateOptionPress = (route: string) => {
    setCreateMenuVisible(false);
    router.push(route as any);
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.borderSecondary,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 30 : 10,
            paddingTop: 8,
            // M3 elevation
            ...Platform.select({
              ios: {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: -1 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
              },
              android: { elevation: 8 },
            }),
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.iconWrapper, focused && { backgroundColor: colors.primaryContainer }]}>
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.iconWrapper, focused && { backgroundColor: colors.primaryContainer }]}>
                <Ionicons
                  name={focused ? 'search' : 'search-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="create"
          listeners={{
            tabPress: (e) => {
              // Prevent default navigation
              e.preventDefault();
              setCreateMenuVisible(true);
            },
          }}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <CreatePostTabIcon focused={createMenuVisible} color={color as string} />
            )
          }}
        />
        <Tabs.Screen
          name="communities"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.iconWrapper, focused && { backgroundColor: colors.primaryContainer }]}>
                <Ionicons
                  name={focused ? 'people' : 'people-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View style={[styles.iconWrapper, focused && { backgroundColor: colors.primaryContainer }]}>
                <Ionicons
                  name={focused ? 'person' : 'person-outline'}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />

        {/* Hidden screens that share the tab bar */}
        <Tabs.Screen name="user/[id]" options={{ href: null }} />
        <Tabs.Screen name="community/[id]" options={{ href: null }} />
        <Tabs.Screen name="community/[id]/members" options={{ href: null }} />
        <Tabs.Screen name="post/[id]" options={{ href: null }} />
        <Tabs.Screen name="media-gallery" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="settings/appearance" options={{ href: null }} />
        <Tabs.Screen name="settings/privacy" options={{ href: null }} />
        <Tabs.Screen name="settings/notifications" options={{ href: null }} />
        <Tabs.Screen name="settings/privacy-policy" options={{ href: null }} />
        <Tabs.Screen name="settings/terms" options={{ href: null }} />
        <Tabs.Screen name="settings/account" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
      </Tabs>

      {/* Create Action Menu Bottom Sheet */}
      <BottomSheet
        visible={createMenuVisible}
        onClose={() => setCreateMenuVisible(false)}
        height={Platform.OS === 'ios' ? 360 : 380}
        title="Create"
      >
        <View style={styles.sheetContent}>
          {/* Create Post */}
          <TouchableOpacity
            style={[styles.menuOption, { borderBottomColor: colors.borderSecondary }]}
            onPress={() => handleCreateOptionPress('/create/post')}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Create Post</Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                Share updates, photos, and community news.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Create Event */}
          <TouchableOpacity
            style={[styles.menuOption, { borderBottomColor: colors.borderSecondary }]}
            onPress={() => handleCreateOptionPress('/create/event')}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Create Event</Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                Organize community gatherings, meetings, and celebrations.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Create Community Page */}
          <TouchableOpacity
            style={[styles.menuOption, { borderBottomColor: 'transparent' }]}
            onPress={() => handleCreateOptionPress('/create/community')}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="home-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Create Community Page</Text>
              <Text style={[styles.menuDesc, { color: colors.textSecondary }]}>
                Create a new village, association, or interest-based community.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  // M3 Navigation Bar: pill-shaped active indicator container
  iconWrapper: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // FAB-style center button
  fab: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  // Bottom Sheet Content
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextWrap: {
    flex: 1,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});

