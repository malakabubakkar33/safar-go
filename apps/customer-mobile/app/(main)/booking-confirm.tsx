/**
 * SafarGo Customer Mobile - Ride Confirmation & Payment Screen
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';

export default function BookingConfirmScreen() {
  const router = useRouter();

  const activeRide = useRideStore((s) => s.activeRide);
  const selectedOffer = useRideStore((s) => s.selectedOffer);
  const setActiveRide = useRideStore((s) => s.setActiveRide);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'DIGITAL'>('CASH');
  const [confirming, setConfirming] = useState(false);

  const fare = activeRide?.agreedFare || activeRide?.currentOfferedFare || 250;

  const handleConfirmBooking = async () => {
    if (!activeRide?.id) return;

    setConfirming(true);
    try {
      const res = await api.confirmPayment(activeRide.id, paymentMethod);
      if (res.success && res.ride) {
        setActiveRide(res.ride);
        router.push('/(main)/live-ride');
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (err: any) {
      Alert.alert('Confirmation Error', err.message || 'Could not confirm ride.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Ride</Text>
      </View>

      <View style={styles.content}>
        {/* Confirmed Deal Badge */}
        <View style={styles.dealBadge}>
          <Text style={styles.dealIcon}>🎉</Text>
          <View style={styles.dealTextWrap}>
            <Text style={styles.dealTitle}>Fare Agreed & Locked</Text>
            <Text style={styles.dealSub}>PKR {fare} total ride price</Text>
          </View>
        </View>

        {/* Assigned Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverIconBox}>
            <Text style={styles.driverEmoji}>
              {activeRide?.vehicleType === 'BIKE' ? '🏍️' : '🚗'}
            </Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>
              {activeRide?.driverName || selectedOffer?.driverName || 'Verified Driver'}
            </Text>
            <Text style={styles.vehicleInfo}>
              {activeRide?.driverVehicle || selectedOffer?.vehicleInfo || 'Vehicle'}
            </Text>
            <Text style={styles.regNumber}>
              {selectedOffer?.registrationNumber || 'LE-2024'}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {selectedOffer?.driverRating || '4.9'}</Text>
          </View>
        </View>

        {/* Route Review Summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.greenDot} />
            <Text style={styles.routeAddress} numberOfLines={1}>
              {activeRide?.pickupAddress || 'Pickup Point'}
            </Text>
          </View>
          <View style={styles.connector} />
          <View style={styles.routeRow}>
            <View style={styles.redDot} />
            <Text style={styles.routeAddress} numberOfLines={1}>
              {activeRide?.destAddress || 'Drop-off Destination'}
            </Text>
          </View>
        </View>

        {/* Payment Method Selector */}
        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'CASH' && styles.paymentSelected]}
          onPress={() => setPaymentMethod('CASH')}
          activeOpacity={0.88}
        >
          <View style={styles.paymentIconWrap}>
            <Text style={styles.paymentEmoji}>💵</Text>
          </View>
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentTitle}>Cash to Driver</Text>
            <Text style={styles.paymentDesc}>Pay exact PKR {fare} cash upon arrival</Text>
          </View>
          <View style={styles.radioOuter}>
            {paymentMethod === 'CASH' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'DIGITAL' && styles.paymentSelected]}
          onPress={() => setPaymentMethod('DIGITAL')}
          activeOpacity={0.88}
        >
          <View style={[styles.paymentIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.paymentEmoji}>💳</Text>
          </View>
          <View style={styles.paymentDetails}>
            <Text style={styles.paymentTitle}>Digital Wallet / Card</Text>
            <Text style={styles.paymentDesc}>Instant secure transaction</Text>
          </View>
          <View style={styles.radioOuter}>
            {paymentMethod === 'DIGITAL' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Confirmation Footer */}
      <View style={styles.footer}>
        <View style={styles.fareTotalRow}>
          <Text style={styles.totalLabel}>Total Fare:</Text>
          <Text style={styles.totalValue}>PKR {fare}</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirmBooking}
          disabled={confirming}
          activeOpacity={0.88}
        >
          {confirming ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm & Dispatch Driver →</Text>
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
  dealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  dealIcon: {
    fontSize: 24,
  },
  dealTextWrap: {
    flex: 1,
  },
  dealTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  dealSub: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    marginTop: 1,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  driverIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverEmoji: {
    fontSize: 22,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  regNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  routeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginRight: 12,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 12,
  },
  connector: {
    width: 2,
    height: 14,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
    marginVertical: 2,
  },
  routeAddress: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  paymentSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  paymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  paymentEmoji: {
    fontSize: 20,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  paymentDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fareTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  confirmBtn: {
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
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
