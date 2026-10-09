/**
 * SafarGo Customer Mobile - Pickup + Destination Route Preview Screen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView } from '../../src/components/MapView';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';

export default function RoutePreviewScreen() {
  const router = useRouter();

  const pickup = useRideStore((s) => s.pickup);
  const destination = useRideStore((s) => s.destination);
  const route = useRideStore((s) => s.route);
  const setRoute = useRideStore((s) => s.setRoute);

  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!pickup || !destination) return;

    setLoadingRoute(true);
    api.calculateRoute(pickup.lat, pickup.lng, destination.lat, destination.lng)
      .then((data) => {
        setRoute({
          distanceKm: data.distanceKm,
          durationMins: data.durationMins,
          coordinates: data.coordinates,
        });
      })
      .catch((err) => {
        console.warn('Routing fallback:', err);
        // Fallback default estimation
        setRoute({
          distanceKm: 4.8,
          durationMins: 14,
          coordinates: [],
        });
      })
      .finally(() => setLoadingRoute(false));
  }, [pickup, destination]);

  const handleChooseRide = () => {
    router.push('/(main)/vehicle-select');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route Details</Text>
      </View>

      {/* Interactive Map Preview */}
      <View style={styles.mapWrap}>
        <MapView
          userLocation={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
          pickupLocation={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
          destinationLocation={destination ? { lat: destination.lat, lng: destination.lng } : null}
          routeCoordinates={route?.coordinates}
        />
      </View>

      {/* Bottom Route Summary Card */}
      <View style={styles.bottomSheet}>
        {/* Origin & Destination Cards */}
        <View style={styles.locationsCard}>
          <View style={styles.locationRow}>
            <View style={styles.greenDot} />
            <View style={styles.locTextWrap}>
              <Text style={styles.locTag}>PICKUP LOCATION</Text>
              <Text style={styles.locAddress} numberOfLines={1}>
                {pickup?.address || 'Current Location'}
              </Text>
            </View>
          </View>

          <View style={styles.connector} />

          <View style={styles.locationRow}>
            <View style={styles.redDot} />
            <View style={styles.locTextWrap}>
              <Text style={styles.locTag}>DESTINATION</Text>
              <Text style={styles.locAddress} numberOfLines={1}>
                {destination?.address || 'Selected Destination'}
              </Text>
            </View>
          </View>
        </View>

        {/* Route Metric Badges */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>🛣️</Text>
            <View>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>
                {loadingRoute ? '...' : `${route?.distanceKm || '4.8'} km`}
              </Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>⏱️</Text>
            <View>
              <Text style={styles.metricLabel}>Travel Time</Text>
              <Text style={styles.metricValue}>
                {loadingRoute ? '...' : `${route?.durationMins || '14'} mins`}
              </Text>
            </View>
          </View>
        </View>

        {/* Continue Action Button */}
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleChooseRide}
          disabled={loadingRoute}
          activeOpacity={0.88}
        >
          {loadingRoute ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueBtnText}>Choose Ride →</Text>
          )}
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapWrap: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  locationsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    marginRight: 14,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 14,
  },
  connector: {
    width: 2,
    height: 20,
    backgroundColor: '#CBD5E1',
    marginLeft: 5,
    marginVertical: 4,
  },
  locTextWrap: {
    flex: 1,
  },
  locTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  locAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
    gap: 10,
  },
  metricIcon: {
    fontSize: 20,
  },
  metricLabel: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  continueBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
