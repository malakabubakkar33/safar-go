/**
 * SafarGo Customer Mobile - Premium Map-First Home Screen
 * Redesigned for Peshawar, Pakistan.
 * Layout Order:
 * 1. Header with logo (left), flexible empty space (center), profile & hamburger menu (right).
 * 2. Well-sized interactive map focused on Peshawar (~41% screen height).
 * 3. Floating current-location recenter control on the map.
 * 4. Attractive destination-search card below the map.
 * 5. Compact quick shortcuts and useful ride actions.
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
import { RoutingService } from '../../src/services/routingService';
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
  const route = useRideStore((s) => s.route);
  const activeRide = useRideStore((s) => s.activeRide);
  const vehicleType = useRideStore((s) => s.vehicleType);
  const setActiveRide = useRideStore((s) => s.setActiveRide);
  const setPickup = useRideStore((s) => s.setPickup);
  const setDestination = useRideStore((s) => s.setDestination);
  const setRoute = useRideStore((s) => s.setRoute);
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

  // Recalculate route if pickup and destination exist but route is missing
  useEffect(() => {
    if (pickup?.lat && destination?.lat && !route) {
      RoutingService.getRoute(pickup.lat, pickup.lng, destination.lat, destination.lng)
        .then((r) => setRoute(r))
        .catch(() => {});
    }
  }, [pickup, destination, route, setRoute]);

  // Handle Recentering
  const handleCenterUser = () => {
    if (!userLocation) {
      requestGpsLocation();
    }
  };

  // Open Full-Screen Search Flow
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

    // Recalculate route in reverse direction
    RoutingService.getRoute(oldDest.lat, oldDest.lng, oldPickup.lat, oldPickup.lng)
      .then((r) => setRoute(r))
      .catch(() => {});
  };

  // Select Quick Peshawar Place
  const handleSelectQuickPlace = async (place: QuickPlace) => {
    const destPoint = {
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      name: place.title,
      city: 'Peshawar',
    };
    setDestination(destPoint);

    const pLat = pickup?.lat || userLocation?.lat || PESHAWAR_CENTER.lat;
    const pLng = pickup?.lng || userLocation?.lng || PESHAWAR_CENTER.lng;

    try {
      const routeData = await RoutingService.getRoute(pLat, pLng, place.lat, place.lng);
      setRoute(routeData);
    } catch {}

    router.push('/(main)/route-preview');
  };

  // Clear Destination
  const handleClearDestination = () => {
    setDestination(null);
    setRoute(null);
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
      {/* 1. Header with Logo (Left), Flexible Space (Center), Profile & 2-Line Hamburger (Right) */}
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

        {/* 2. Well-Sized Interactive Map (Peshawar Bounded) with 3. Floating Recenter Control */}
        <View style={[styles.mapWrapper, { height: mapHeight }]}>
          <MapView
            userLocation={userLocation}
            pickupLocation={pickup ? { lat: pickup.lat, lng: pickup.lng } : userLocation}
            destinationLocation={
              destination ? { lat: destination.lat, lng: destination.lng } : null
            }
            routeCoordinates={route?.coordinates}
            vehicleType={vehicleType}
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

        {/* 4. Attractive Destination-Search Card Below Map */}
        <WhereToCard
          pickupAddress={pickup?.address || currentAddress}
          destinationAddress={destination?.address}
          isDetectingLocation={gpsState === 'detecting'}
          onPressSearch={handleOpenSearch}
          onSwapLocations={pickup && destination ? handleSwapLocations : undefined}
          onSelectQuickPlace={handleSelectQuickPlace}
        />

        {/* Route Active Callout Card (When Destination & Route are Chosen) */}
        {destination && (
          <View style={styles.routeActiveCard}>
            <View style={styles.routeHeaderRow}>
              <View style={styles.routeTag}>
                <Text style={styles.routeTagText}>ROUTE READY</Text>
              </View>
              <TouchableOpacity onPress={handleClearDestination} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearRouteText}>✕ Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routeMetricsRow}>
              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricLabel}>Distance</Text>
                <Text style={styles.routeMetricValue}>{route?.distanceKm ? `${route.distanceKm} km` : '...'}</Text>
              </View>
              <View style={styles.routeMetricDivider} />
              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricLabel}>Est. Travel Time</Text>
                <Text style={styles.routeMetricValue}>{route?.durationMins ? `${route.durationMins} mins` : '...'}</Text>
              </View>
              <View style={styles.routeMetricDivider} />
              <View style={styles.routeMetricItem}>
                <Text style={styles.routeMetricLabel}>City Traffic</Text>
                <Text style={styles.routeMetricValueTraffic}>Moderate</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewRouteBtn}
              onPress={() => router.push('/(main)/route-preview')}
              activeOpacity={0.88}
            >
              <Text style={styles.viewRouteBtnText}>Proceed to Vehicle Selection →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 5. Compact Quick Shortcuts & Useful Ride Actions */}
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

      {/* Smooth Navigation Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={(routePath) => router.push(routePath as any)}
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
    width: '100%',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  activeRideBanner: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
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
    marginTop: 2,
  },
  activeRideArrow: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
  routeActiveCard: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 10px rgba(22, 163, 74, 0.08)',
      },
    }),
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  routeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routeTagText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clearRouteText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  routeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  routeMetricItem: {
    alignItems: 'center',
  },
  routeMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  routeMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  routeMetricValueTraffic: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 2,
  },
  routeMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  viewRouteBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewRouteBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
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
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    fontWeight: '700',
    color: '#475569',
  },
  vehiclePillTitleActive: {
    color: '#15803D',
  },
  vehiclePillSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
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
    marginBottom: 6,
  },
  shortcutIcon: {
    fontSize: 16,
  },
  shortcutTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
});
