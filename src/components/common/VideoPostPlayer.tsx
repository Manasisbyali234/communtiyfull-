import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoPostPlayerProps {
  url: string;
}

export const VideoPostPlayer: React.FC<VideoPostPlayerProps> = ({ url }) => {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* @ts-ignore */}
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000',
            borderRadius: 16,
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});

export default VideoPostPlayer;
