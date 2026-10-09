/**
 * SafarGo Customer Mobile - Vehicle Selection Screen (Bike vs Car)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';

export default function VehicleSelectScreen() {
  const router = useRouter();

  const pickup = useRideStore((s) => s.pickup);
  const destination = useRideStore((s) => s.destination);
  const route = useRideStore((s) => s.route);
  const vehicleType = useRideStore((s) => s.vehicleType);
  const setVehicleType = useRideStore((s) => s.setVehicleType);
  const estimates = useRideStore((s) => s.estimates);
  const setEstimates = useRideStore((s) => s.setEstimates);
  const setActiveRide = useRideStore((s) => s.setActiveRide);
  const initSocketListeners = useRideStore((s) => s.initSocketListeners);

  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [requestingDrivers, setRequestingDrivers] = useState(false);

  useEffect(() => {
    if (!pickup || !destination) return;

    setLoadingEstimates(true);
    api.estimateFare(pickup.lat, pickup.lng, destination.lat, destination.lng)
      .then((data) => {
        setEstimates(data.estimates);
      })
      .catch((err) => {
        console.warn('Fare estimate error:', err);
      })
      .finally(() => setLoadingEstimates(false));
  }, [pickup, destination]);

  const handleCreateRideRequest = async () => {
    if (!pickup || !destination) {
      Alert.alert('Missing Location', 'Please specify pickup and destination.');
      return;
    }

    setRequestingDrivers(true);
    try {
      const res = await api.createRideRequest({
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destAddress: destination.address,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleType,
      });

      if (res.success && res.ride) {
        setActiveRide(res.ride);
        initSocketListeners(res.ride.id);
        router.push('/(main)/finding-drivers');
      } else {
        throw new Error('Failed to dispatch ride request.');
      }
    } catch (err: any) {
      Alert.alert('Request Failed', err.message || 'Unable to request ride right now.');
    } finally {
      setRequestingDrivers(false);
    }
  };

  const bikeInfo = estimates?.BIKE || {
    title: 'SafarGo Bike',
    description: 'Fastest single passenger ride through traffic',
    estimatedFare: 260,
    fareRange: 'PKR 240 - 290',
    etaMinutes: 3,
  };

  const carInfo = estimates?.CAR || {
    title: 'SafarGo Car',
    description: 'Air-conditioned comfort with generous trunk space',
    estimatedFare: 650,
    fareRange: 'PKR 600 - 720',
    etaMinutes: 5,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Ride</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionSubtitle}>
          Select your preferred vehicle type to receive nearby driver fare offers.
        </Text>

        {loadingEstimates && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#16A34A" size="small" />
            <Text style={styles.loadingText}>Fetching live route pricing...</Text>
          </View>
        )}

        {/* 1. BIKE SELECTION CARD */}
        <TouchableOpacity
          style={[styles.vehicleCard, vehicleType === 'BIKE' && styles.selectedCard]}
          onPress={() => setVehicleType('BIKE')}
          activeOpacity={0.88}
        >
          <View style={styles.vehicleIconWrap}>
            <Text style={styles.vehicleIcon}>🏍️</Text>
          </View>
          <View style={styles.vehicleDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.vehicleTitle}>{bikeInfo.title}</Text>
              <View style={styles.etaBadge}>
                <Text style={styles.etaText}>~{bikeInfo.etaMinutes} min away</Text>
              </View>
            </View>
            <Text style={styles.vehicleDesc}>{bikeInfo.description}</Text>
            <Text style={styles.fareRangeText}>Est. {bikeInfo.fareRange}</Text>
          </View>
          <View style={styles.radioOuter}>
            {vehicleType === 'BIKE' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* 2. CAR SELECTION CARD */}
        <TouchableOpacity
          style={[styles.vehicleCard, vehicleType === 'CAR' && styles.selectedCard]}
          onPress={() => setVehicleType('CAR')}
          activeOpacity={0.88}
        >
          <View style={[styles.vehicleIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.vehicleIcon}>🚗</Text>
          </View>
          <View style={styles.vehicleDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.vehicleTitle}>{carInfo.title}</Text>
              <View style={[styles.etaBadge, { backgroundColor: '#DBEAFE' }]}>
                <Text style={[styles.etaText, { color: '#1D4ED8' }]}>~{carInfo.etaMinutes} min away</Text>
              </View>
            </View>
            <Text style={styles.vehicleDesc}>{carInfo.description}</Text>
            <Text style={styles.fareRangeText}>Est. {carInfo.fareRange}</Text>
          </View>
          <View style={styles.radioOuter}>
            {vehicleType === 'CAR' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Guarantee Banner */}
        <View style={styles.guaranteeBanner}>
          <Text style={styles.guaranteeIcon}>🛡️</Text>
          <View style={styles.guaranteeTextWrap}>
            <Text style={styles.guaranteeTitle}>Driver Offer System</Text>
            <Text style={styles.guaranteeDesc}>
              Nearby drivers will submit custom fare offers. You choose the best driver & rate.
            </Text>
          </View>
        </View>
      </View>

      {/* Find Drivers Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.findDriversBtn}
          onPress={handleCreateRideRequest}
          disabled={requestingDrivers}
          activeOpacity={0.88}
        >
          {requestingDrivers ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.findDriversBtnText}>Find Drivers Now →</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  selectedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  vehicleIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIcon: {
    fontSize: 26,
  },
  vehicleDetails: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  etaBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  vehicleDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  fareRangeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  guaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 8,
    gap: 12,
  },
  guaranteeIcon: {
    fontSize: 24,
  },
  guaranteeTextWrap: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  guaranteeDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  findDriversBtn: {
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
  findDriversBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
