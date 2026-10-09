import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useAuthStore } from '../src/store/authStore';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const opacity = useSharedValue(1);
  const [videoFailed, setVideoFailed] = useState(false);

  const navigateNext = () => {
    if (isAuthenticated) {
      router.replace('/(main)/home');
    } else {
      router.replace('/(auth)/onboarding');
    }
  };

  const handleFinish = () => {
    opacity.value = withTiming(0, { duration: 600 }, (finished) => {
      if (finished) {
        runOnJS(navigateNext)();
      }
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFinish();
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {!videoFailed ? (
        <Video
          source={{ uri: '/splash-video.mp4' }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted
          isLooping={false}
          onError={() => setVideoFailed(true)}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.didJustFinish) {
              handleFinish();
            }
          }}
        />
      ) : (
        <View style={styles.fallbackContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>S</Text>
          </View>
          <Text style={styles.brandTitle}>SafarGo</Text>
          <Text style={styles.brandSubtitle}>Your ride, your way</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width,
    height,
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
});
