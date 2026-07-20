import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import Toast from '../components/common/Toast';
import { initSocket, disconnectSocket } from '../api/socket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

// Capture the intended URL on web before any redirect happens
const intendedPath = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.pathname + window.location.search
  : null;

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isOnboarded, isLoading, token, user } = useAuthStore();
  const isLoggedIn = isAuthenticated || !!user;
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const [tokensInitialized, setTokensInitialized] = useState(false);
  const redirectedToIntended = useRef(false);
  const isNavigating = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // hasHydrated() may already be true synchronously — check first
      // then fall back to the listener. A timeout ensures we never hang.
      if (useAuthStore.persist.hasHydrated()) {
        setTokensInitialized(true);
        return;
      }
      let done = false;
      const finish = () => { if (!done) { done = true; setTokensInitialized(true); } };
      const unsub = useAuthStore.persist.onFinishHydration(finish);
      // Safety timeout: if hydration never fires (e.g. empty storage), unblock after 50ms
      const timer = setTimeout(finish, 50);
      return () => { unsub(); clearTimeout(timer); };
    } else {
      useAuthStore.getState().initSecureTokens().finally(() => setTokensInitialized(true));
    }
  }, []);

// Initialize socket once when authenticated and token is in memory
  useEffect(() => {
    if (isLoggedIn && tokensInitialized && token) {
      void initSocket();
    }
    return () => {
      if (!isLoggedIn) disconnectSocket();
    };
  }, [isLoggedIn, tokensInitialized, token]);

  useEffect(() => {
    if (isLoading || !tokensInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inAppGroup = segments[0] === '(tabs)' || segments[0] === 'create' || segments[0] === 'chat' || segments[0] === 'story' || segments[0] === 'community' || segments[0] === 'krushi-mitra' || segments[0] === 'market-rates';

    // Admin routes: only skip guard if user is actually an admin
    if (inAdminGroup && isAdmin) return;

    if (!isLoggedIn) {
      if (!inAuthGroup && !isNavigating.current) {
        isNavigating.current = true;
        router.replace(!isOnboarded ? '/(auth)/onboarding' : '/(auth)/login');
      }
    } else {
      isNavigating.current = false;
      if (isAdmin) {
        // Always keep admin in the admin group
        if (!inAdminGroup) {
          router.replace('/(admin)/dashboard' as any);
        }
      } else if (inAuthGroup || !inAppGroup) {
        if (!redirectedToIntended.current && intendedPath && !intendedPath.startsWith('/(auth)') && intendedPath !== '/' && intendedPath !== '/index') {
          redirectedToIntended.current = true;
          router.replace(intendedPath as any);
        } else {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isLoggedIn, isOnboarded, isLoading, tokensInitialized, segments]);

  if (!tokensInitialized) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootLayoutContent />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
