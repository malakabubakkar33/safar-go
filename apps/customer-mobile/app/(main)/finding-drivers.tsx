/**
 * SafarGo Customer Mobile - Drivers Are Responding & Live Bidding Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRideStore, DriverOffer } from '../../src/store/rideStore';
import { api } from '../../src/services/api';

export default function FindingDriversScreen() {
  const router = useRouter();

  const activeRide = useRideStore((s) => s.activeRide);
  const offers = useRideStore((s) => s.offers);
  const setSelectedOffer = useRideStore((s) => s.setSelectedOffer);
  const setActiveRide = useRideStore((s) => s.setActiveRide);

  const [selectingOfferId, setSelectingOfferId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Poll offers as backup in case of intermittent socket disconnect
  useEffect(() => {
    if (!activeRide?.id) return;

    const interval = setInterval(() => {
      api.getRideDetails(activeRide.id)
        .then((res) => {
          if (res.offers && res.offers.length > 0) {
            useRideStore.getState().setOffers(res.offers);
          }
          if (res.ride) {
            setActiveRide(res.ride);
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearInterval(interval);
  }, [activeRide?.id]);

  const handleSelectOffer = async (offer: DriverOffer) => {
    if (!activeRide?.id) return;

    setSelectingOfferId(offer.id);
    try {
      const res = await api.selectDriverOffer(activeRide.id, offer.id);
      if (res.success) {
        setSelectedOffer(offer);
        setActiveRide(res.ride);
        router.push('/(main)/deal-chat');
      } else {
        throw new Error('Offer selection failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to select this offer.');
    } finally {
      setSelectingOfferId(null);
    }
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Request?',
      'Are you sure you want to cancel this ride request?',
      [
        { text: 'Keep Waiting', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (!activeRide?.id) return;
            setCancelling(true);
            try {
              await api.cancelRide(activeRide.id, 'Customer changed plans');
              useRideStore.getState().resetBooking();
              router.replace('/(main)/home');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Drivers Are Responding</Text>
          <Text style={styles.headerSubtitle}>
            {offers.length === 0
              ? 'Broadcasting to nearby verified drivers...'
              : `${offers.length} nearby driver(s) sent live fare offers`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cancelTopBtn}
          onPress={handleCancelRide}
          disabled={cancelling}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelTopText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Radar Search Animation Section */}
      <View style={styles.radarCard}>
        <View style={styles.radarOuterRing}>
          <View style={styles.radarMiddleRing}>
            <View style={styles.radarCenter}>
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          </View>
        </View>
        <View style={styles.radarTextWrap}>
          <Text style={styles.radarTitle}>Finding the best fare for you</Text>
          <Text style={styles.radarSub}>
            Pickup: {activeRide?.pickupAddress ? activeRide.pickupAddress.slice(0, 36) + '...' : 'Your Location'}
          </Text>
        </View>
      </View>

      {/* Real-time Driver Offers List */}
      <View style={styles.offersContainer}>
        {offers.length === 0 ? (
          <View style={styles.waitingWrap}>
            <Text style={styles.waitingEmoji}>📡</Text>
            <Text style={styles.waitingTitle}>Waiting for Driver Offers</Text>
            <Text style={styles.waitingDesc}>
              Drivers are reviewing your pickup route. First offers typically arrive in 3-5 seconds.
            </Text>
          </View>
        ) : (
          <FlatList
            data={offers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.offerCard}>
                {/* Top Row: Driver Profile & Vehicle */}
                <View style={styles.driverInfoRow}>
                  <View style={styles.driverAvatarWrap}>
                    <Text style={styles.avatarEmoji}>
                      {item.vehicleType === 'BIKE' ? '🏍️' : '🚗'}
                    </Text>
                  </View>
                  <View style={styles.driverTextDetails}>
                    <Text style={styles.driverName}>{item.driverName}</Text>
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingText}>⭐ {item.driverRating}</Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.ridesText}>{item.driverRides} rides</Text>
                    </View>
                    <Text style={styles.vehicleInfoText}>
                      {item.vehicleInfo} • {item.registrationNumber}
                    </Text>
                  </View>

                  {/* Fare & ETA Badge */}
                  <View style={styles.fareBox}>
                    <Text style={styles.fareAmount}>PKR {item.offeredFare}</Text>
                    <Text style={styles.etaText}>~{item.etaMinutes} min away</Text>
                  </View>
                </View>

                {/* Bottom Row: Distance & Select Button */}
                <View style={styles.cardActionRow}>
                  <Text style={styles.distanceText}>📍 {item.distanceKm} km from pickup</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    onPress={() => handleSelectOffer(item)}
                    disabled={selectingOfferId === item.id}
                    activeOpacity={0.88}
                  >
                    {selectingOfferId === item.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.selectBtnText}>Select & Negotiate →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  cancelTopBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cancelTopText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    margin: 16,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    gap: 14,
  },
  radarOuterRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarMiddleRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTextWrap: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  radarSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  offersContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  waitingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  waitingEmoji: {
    fontSize: 44,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  waitingDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  driverTextDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  dotSeparator: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  ridesText: {
    fontSize: 12,
    color: '#64748B',
  },
  vehicleInfoText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  fareBox: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  etaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  distanceText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  selectBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  selectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
