/**
 * SafarGo Customer Mobile - Premium Map-First Home Screen
 * Redesigned for Peshawar, Pakistan.
 * Includes: Compact responsive header, medium-height interactive map (~41% of screen),
 * real GPS via expo-location with graceful permission & disabled recovery, custom "ME" avatar marker,
 * geofence validation, WhereToCard, and clean quick actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Header } from '../../src/components/Header';
import { Drawer } from '../../src/components/Drawer';
import { MapView } from '../../src/components/MapView';
import { WhereToCard, QuickPlace } from '../../src/components/WhereToCard';
import { useAuthStore } from '../../src/store/authStore';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';
import { GeocodingService } from '../../src/services/geospatialServices';
import {
  PESHAWAR_CENTER,
  isWithinPeshawar,
  SERVICE_AREA_NOTICE,
} from '../../src/services/peshawarGeofence';

const { height: screenHeight } = Dimensions.get('window');

type GpsState = 'idle' | 'detecting' | 'granted' | 'denied' | 'disabled' | 'error';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>('idle');
  const [canAskPermissionAgain, setCanAskPermissionAgain] = useState(true);
  const [isOutsidePeshawar, setIsOutsidePeshawar] = useState(false);

  // User location marker & pickup tracking
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');

  const pickup = useRideStore((s) => s.pickup);
  const destination = useRideStore((s) => s.destination);
  const activeRide = useRideStore((s) => s.activeRide);
  const vehicleType = useRideStore((s) => s.vehicleType);
  const setActiveRide = useRideStore((s) => s.setActiveRide);
  const setPickup = useRideStore((s) => s.setPickup);
  const setDestination = useRideStore((s) => s.setDestination);
  const setVehicleType = useRideStore((s) => s.setVehicleType);

  // 1. Acquire Real GPS Location
  const requestGpsLocation = useCallback(async () => {
    try {
      setGpsState('detecting');

      // Check device location services
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setGpsState('disabled');
        return;
      }

      // Check/request permissions
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      setCanAskPermissionAgain(canAskAgain);

      if (status !== 'granted') {
        setGpsState('denied');
        return;
      }

      // Obtain real position
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setUserLocation({ lat, lng });

      const inServiceArea = isWithinPeshawar(lat, lng);
      setIsOutsidePeshawar(!inServiceArea);

      // Reverse geocode to readable street address
      const geocoded = await GeocodingService.reverseGeocode(lat, lng);
      setCurrentAddress(geocoded.address);

      // Auto-set pickup to real location
      setPickup({
        address: geocoded.address,
        lat,
        lng,
        name: geocoded.name || 'Current Location',
        city: 'Peshawar',
      });

      setGpsState('granted');
    } catch (err) {
      console.warn('[HomeScreen] GPS acquisition error:', err);
      setGpsState('error');
    }
  }, [setPickup]);

  useEffect(() => {
    requestGpsLocation();

    // Check for active ride on mount
    api
      .getActiveRide()
      .then((res) => {
        if (res.hasActiveRide && res.ride) {
          setActiveRide(res.ride);
        }
      })
      .catch(() => {});
  }, [requestGpsLocation, setActiveRide]);

  // Handle Recentering
  const handleCenterUser = () => {
    if (!userLocation) {
      requestGpsLocation();
    }
  };

  // Open Search Flow
  const handleOpenSearch = (field: 'pickup' | 'destination' = 'destination') => {
    router.push({
      pathname: '/(main)/search',
      params: { field },
    });
  };

  // Swap Locations
  const handleSwapLocations = () => {
    if (!pickup || !destination) return;
    const oldPickup = pickup;
    const oldDest = destination;
    setPickup(oldDest);
    setDestination(oldPickup);
    setCurrentAddress(oldDest.address);
  };

  // Select Quick Peshawar Place
  const handleSelectQuickPlace = (place: QuickPlace) => {
    setDestination({
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      name: place.title,
      city: 'Peshawar',
    });
    router.push('/(main)/route-preview');
  };

  // Resume In-Flight Ride
  const handleResumeActiveRide = () => {
    if (!activeRide) return;
    if (['REQUESTED', 'DRIVERS_RESPONDING'].includes(activeRide.status)) {
      router.push('/(main)/finding-drivers');
    } else if (['DRIVER_SELECTED', 'NEGOTIATING'].includes(activeRide.status)) {
      router.push('/(main)/deal-chat');
    } else if (activeRide.status === 'FARE_AGREED') {
      router.push('/(main)/booking-confirm');
    } else if (
      ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_STARTED'].includes(
        activeRide.status
      )
    ) {
      router.push('/(main)/live-ride');
    }
  };

  // Dynamic responsive map height: ~41% of mobile screen, capped between 260 and 380
  const mapHeight = Math.min(380, Math.max(260, Math.round(screenHeight * 0.41)));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* 1. Compact Responsive Header */}
      <Header
        onOpenMenu={() => setIsDrawerOpen(true)}
        onPressProfile={() => router.push('/(main)/profile')}
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* GPS Permission & Service Area Warning Banners */}
        {gpsState === 'denied' && (
          <View style={styles.alertBannerWarning}>
            <View style={styles.alertBannerIconWrap}>
              <Text style={styles.alertBannerIcon}>📍</Text>
            </View>
            <View style={styles.alertBannerTextWrap}>
              <Text style={styles.alertBannerTitle}>Location Permission Needed</Text>
              <Text style={styles.alertBannerMessage}>
                Enable GPS to automatically detect your pickup address in Peshawar.
              </Text>
            </View>
            {canAskPermissionAgain ? (
              <TouchableOpacity
                style={styles.alertActionBtn}
                onPress={requestGpsLocation}
                activeOpacity={0.8}
              >
                <Text style={styles.alertActionBtnText}>Allow</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.alertActionBtn}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.8}
              >
                <Text style={styles.alertActionBtnText}>Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {gpsState === 'disabled' && (
          <View style={styles.alertBannerWarning}>
            <View style={styles.alertBannerIconWrap}>
              <Text style={styles.alertBannerIcon}>⚠️</Text>
            </View>
            <View style={styles.alertBannerTextWrap}>
              <Text style={styles.alertBannerTitle}>Location Services Disabled</Text>
              <Text style={styles.alertBannerMessage}>
                Please turn on device GPS to detect your pickup location.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.alertActionBtn}
              onPress={requestGpsLocation}
              activeOpacity={0.8}
            >
              <Text style={styles.alertActionBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOutsidePeshawar && (
          <View style={styles.alertBannerInfo}>
            <Text style={styles.alertBannerInfoIcon}>ℹ️</Text>
            <Text style={styles.alertBannerInfoText}>{SERVICE_AREA_NOTICE}</Text>
          </View>
        )}

        {/* 2. Medium-Height Interactive Map (Peshawar Bounded) */}
        <View style={[styles.mapWrapper, { height: mapHeight }]}>
          <MapView
            userLocation={userLocation}
            pickupLocation={pickup ? { lat: pickup.lat, lng: pickup.lng } : userLocation}
            destinationLocation={
              destination ? { lat: destination.lat, lng: destination.lng } : null
            }
            height={mapHeight}
            onCenterUser={handleCenterUser}
          />

          {/* Floating Active Ride Banner */}
          {activeRide && (
            <TouchableOpacity
              style={styles.activeRideBanner}
              onPress={handleResumeActiveRide}
              activeOpacity={0.9}
            >
              <View style={styles.pulseIndicator} />
              <View style={styles.activeRideTextWrap}>
                <Text style={styles.activeRideTitle}>Active Ride in Progress</Text>
                <Text style={styles.activeRideSubtitle}>
                  Status: {activeRide.status.replace(/_/g, ' ')} • Tap to view live updates
                </Text>
              </View>
              <Text style={styles.activeRideArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Redesigned Pickup & Destination Card */}
        <WhereToCard
          pickupAddress={pickup?.address || currentAddress}
          destinationAddress={destination?.address}
          isDetectingLocation={gpsState === 'detecting'}
          onPressSearch={handleOpenSearch}
          onSwapLocations={pickup && destination ? handleSwapLocations : undefined}
          onSelectQuickPlace={handleSelectQuickPlace}
        />

        {/* 4. Quick Actions & Ride Preferences */}
        <View style={styles.quickActionsContainer}>
          {/* Vehicle Preference Selector */}
          <View style={styles.vehicleTypeSelector}>
            <TouchableOpacity
              style={[
                styles.vehiclePill,
                vehicleType === 'BIKE' && styles.vehiclePillActive,
              ]}
              onPress={() => setVehicleType('BIKE')}
              activeOpacity={0.8}
            >
              <Text style={styles.vehicleIcon}>🏍️</Text>
              <View>
                <Text
                  style={[
                    styles.vehiclePillTitle,
                    vehicleType === 'BIKE' && styles.vehiclePillTitleActive,
                  ]}
                >
                  SafarGo Bike
                </Text>
                <Text style={styles.vehiclePillSub}>Fastest in traffic</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.vehiclePill,
                vehicleType === 'CAR' && styles.vehiclePillActive,
              ]}
              onPress={() => setVehicleType('CAR')}
              activeOpacity={0.8}
            >
              <Text style={styles.vehicleIcon}>🚗</Text>
              <View>
                <Text
                  style={[
                    styles.vehiclePillTitle,
                    vehicleType === 'CAR' && styles.vehiclePillTitleActive,
                  ]}
                >
                  SafarGo Car
                </Text>
                <Text style={styles.vehiclePillSub}>AC & Comfort</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick Utility Shortcuts */}
          <View style={styles.shortcutsRow}>
            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => router.push('/(main)/history')}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Text style={styles.shortcutIcon}>🕒</Text>
              </View>
              <Text style={styles.shortcutTitle}>Ride History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => handleOpenSearch('destination')}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Text style={styles.shortcutIcon}>⭐</Text>
              </View>
              <Text style={styles.shortcutTitle}>Saved Places</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutCard}
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Text style={styles.shortcutIcon}>💬</Text>
              </View>
              <Text style={styles.shortcutTitle}>Help & Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 5. Animated Navigation Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={(route) => router.push(route as any)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  alertBannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  alertBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBannerIcon: {
    fontSize: 16,
  },
  alertBannerTextWrap: {
    flex: 1,
  },
  alertBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  alertBannerMessage: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  alertActionBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  alertBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  alertBannerInfoIcon: {
    fontSize: 14,
  },
  alertBannerInfoText: {
    fontSize: 11.5,
    color: '#1E40AF',
    fontWeight: '600',
    flex: 1,
  },
  mapWrapper: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  activeRideBanner: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
  activeRideTextWrap: {
    flex: 1,
  },
  activeRideTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  activeRideSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
  activeRideArrow: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '800',
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  vehicleTypeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  vehiclePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  vehiclePillActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  vehicleIcon: {
    fontSize: 22,
  },
  vehiclePillTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  vehiclePillTitleActive: {
    color: '#15803D',
  },
  vehiclePillSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutIcon: {
    fontSize: 16,
  },
  shortcutTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
});
