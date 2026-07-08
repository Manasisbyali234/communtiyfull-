import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { apiClient } from '../../api/client';
import { useStoriesFeedQuery, useStoryByIdQuery, StoryGroup, Story } from '../../api/story';

const STORY_DURATION = 5000;

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ViewStoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: storyGroups = [], isLoading: feedLoading } = useStoriesFeedQuery();
  const group: StoryGroup | undefined = storyGroups.find((g) =>
    g.stories.some((s) => s.id === id)
  );
  const feedStory = group?.stories.find((s) => s.id === id);

  // Fallback: fetch directly if not found in feed (e.g. direct URL navigation or own story)
  const { data: directStory, isLoading: directLoading } = useStoryByIdQuery(
    feedStory ? '' : (id ?? '')
  );

  const isLoading = feedLoading || (!feedStory && directLoading);

  // Build stories array: use feed group if available, else wrap the single direct story
  const stories: Story[] = group?.stories ?? (directStory ? [directStory] : []);
  const initialIndex = stories.findIndex((s) => s.id === id);
  const [index, setIndex] = useState(Math.max(0, initialIndex));
  const story = stories[index];

  // Sync index when stories resolve after initial render
  useEffect(() => {
    const idx = stories.findIndex((s) => s.id === id);
    if (idx >= 0) setIndex(idx);
  }, [stories.length]);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!story) return;
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });

    // Record view
    apiClient.post(`/stories/${story.id}/view`).catch(() => {});

    return () => animRef.current?.stop();
  }, [story?.id]);

  const goNext = () => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
    } else {
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color="#FFF" />
      </SafeAreaView>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 16 }}>Story not found or expired.</Text>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={{ marginTop: 20 }}>
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressBarWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.storyContainer}>
        {/* Media */}
        {story.mediaType === 'VIDEO' ? (
          Platform.OS === 'web' ? (
            // @ts-ignore
            <video
              key={story.id}
              src={story.mediaUrl}
              autoPlay
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' } as any}
              onEnded={goNext}
            />
          ) : (
            <NativeStoryVideo uri={story.mediaUrl} onEnd={goNext} />
          )
        ) : (
          <Image
            source={{ uri: story.mediaUrl }}
            style={styles.backgroundImage}
            contentFit="contain"
          />
        )}

        <View style={styles.gradientTop} />

        {/* Header */}
        <View style={styles.header}>
          {/* Progress bars */}
          <View style={styles.progressBarContainer}>
            {stories.map((s, i) => (
              <View key={s.id} style={styles.progressBarBg}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: i < index ? '100%' : i === index ? progressBarWidth : '0%',
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* User info */}
          <View style={styles.userInfoRow}>
            <View style={styles.userInfoLeft}>
              {(group?.user.avatarUrl ?? story.author?.avatarUrl) ? (
                <Image source={{ uri: group?.user.avatarUrl ?? story.author?.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#333' }]} />
              )}
              <Text style={styles.userName}>{group?.user.displayName ?? story.author?.displayName ?? ''}</Text>
              <Text style={styles.timeText}>{formatTime(story.createdAt)}</Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Touch zones */}
        <View style={styles.touchZones}>
          <TouchableOpacity style={styles.touchLeft} activeOpacity={1} onPress={goPrev} />
          <TouchableOpacity style={styles.touchRight} activeOpacity={1} onPress={goNext} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function NativeStoryVideo({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const [VideoView, setVideoView] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);

  useEffect(() => {
    import('expo-video').then((mod) => {
      setVideoView(() => mod.VideoView);
      if (mod.createVideoPlayer) {
        const p = mod.createVideoPlayer(uri);
        p.loop = false;
        p.play();
        setPlayer(p);
      }
    }).catch(() => {});
    return () => { player?.release?.(); };
  }, [uri]);

  if (!VideoView || !player) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  storyContainer: {
    flex: 1,
    borderRadius: Platform.OS === 'ios' ? 12 : 0,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundImage: { ...StyleSheet.absoluteFillObject },
  gradientTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 20,
    left: 0, right: 0,
    paddingHorizontal: 10,
    zIndex: 10,
  },
  progressBarContainer: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  progressBarBg: {
    flex: 1, height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#FFF' },
  userInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 4,
  },
  userInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFF' },
  userName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  timeText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  iconBtn: { padding: 4 },
  touchZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  touchLeft: { flex: 0.3 },
  touchRight: { flex: 0.7 },
});
