import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

const ONBOARDING_SLIDES = [
  {
    image: '/images/onboarding_bike.jpg',
    heading: 'Your Ride, Your Way',
    description: 'Choose a ride that fits your journey and travel with ease.',
    btnText: 'Continue',
  },
  {
    image: '/images/onboarding_car.jpg',
    heading: 'Comfort at Your Door',
    description: 'Find a comfortable ride from nearby service providers.',
    btnText: 'Continue',
  },
  {
    image: '/images/onboarding_location.jpg',
    heading: 'Track Every Journey',
    description: 'See your ride and follow its journey in real time.',
    btnText: 'Get Started',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  const goToNextSlide = (nextIdx: number) => {
    if (nextIdx >= 0 && nextIdx < ONBOARDING_SLIDES.length) {
      setCurrentIndex(nextIdx);
      translateX.value = withSpring(-nextIdx * width, { damping: 20, stiffness: 120 });
    }
  };

  const handleFinish = () => {
    router.replace('/(auth)/login');
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50 && currentIndex < ONBOARDING_SLIDES.length - 1) {
        runOnJS(goToNextSlide)(currentIndex + 1);
      } else if (e.translationX > 50 && currentIndex > 0) {
        runOnJS(goToNextSlide)(currentIndex - 1);
      }
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandSymbol}>
            <Text style={styles.brandSymbolText}>S</Text>
          </View>
          <Text style={styles.brandName}>SafarGo</Text>
        </View>
        {currentIndex < ONBOARDING_SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleFinish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel Body */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.carouselTrack, trackStyle]}>
          {ONBOARDING_SLIDES.map((slide, index) => (
            <View key={index} style={styles.slide}>
              <View style={styles.artworkContainer}>
                <Image
                  source={{ uri: slide.image }}
                  style={styles.slideImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.contentContainer}>
                <Text style={styles.heading}>{slide.heading}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </GestureDetector>

      {/* Bottom Footer with Expanding Pill Dots & Button */}
      <View style={styles.footer}>
        <View style={styles.pagination}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToNextSlide(i)}
              style={[
                styles.dot,
                i === currentIndex ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (currentIndex < ONBOARDING_SLIDES.length - 1) {
              goToNextSlide(currentIndex + 1);
            } else {
              handleFinish();
            }
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.actionButtonText}>
            {ONBOARDING_SLIDES[currentIndex].btnText}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandSymbol: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandSymbolText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  carouselTrack: {
    flex: 1,
    flexDirection: 'row',
    width: width * 3,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  artworkContainer: {
    width: width - 56,
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#16A34A',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#E2E8F0',
  },
  actionButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
