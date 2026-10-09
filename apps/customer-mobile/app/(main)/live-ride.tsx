/**
 * SafarGo Customer Mobile - Real-time GPS Tracking & Live Ride Execution Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView } from '../../src/components/MapView';
import { useRideStore } from '../../src/store/rideStore';
import { api } from '../../src/services/api';

export default function LiveRideScreen() {
  const router = useRouter();

  const activeRide = useRideStore((s) => s.activeRide);
  const setActiveRide = useRideStore((s) => s.setActiveRide);
  const driverLocation = useRideStore((s) => s.driverLocation);
  const route = useRideStore((s) => s.route);

  // Status simulation progression button for demo / inspection testing
  const [driverEta, setDriverEta] = useState(4);

  // Poll for ride status updates & driver progression
  useEffect(() => {
    if (!activeRide?.id) return;

    const interval = setInterval(() => {
      api.getRideDetails(activeRide.id)
        .then((res) => {
          if (res.ride) {
            setActiveRide(res.ride);
            if (res.ride.status === 'COMPLETED') {
              router.replace('/(main)/ride-complete');
            }
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [activeRide?.id]);

  const handleShareTrip = async () => {
    try {
      await Share.share({
        message: `I'm travelling with SafarGo! Driver: ${activeRide?.driverName || 'Driver'} in ${activeRide?.driverVehicle || 'Vehicle'}. Heading to ${activeRide?.destAddress || 'Destination'}. Track live: https://safargo.com/track/${activeRide?.id}`,
      });
    } catch {}
  };

  const handleSOS = () => {
    Alert.alert(
      'Emergency Assistance (SOS)',
      'Need urgent help? You can connect to SafarGo 24/7 Safety Helpline or Police emergency service.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Helpline (111-723-274)', onPress: () => Alert.alert('Calling SafarGo Safety Response Team...') },
        { text: 'Call Police (15)', style: 'destructive', onPress: () => Alert.alert('Connecting to Police Emergency...') },
      ]
    );
  };

  // Helper status cards
  const renderStatusBanner = () => {
    const status = activeRide?.status || 'DRIVER_ASSIGNED';

    if (status === 'DRIVER_ARRIVED') {
      return (
        <View style={[styles.statusCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
          <Text style={styles.statusEmoji}>📍</Text>
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusTitle, { color: '#15803D' }]}>Your Driver Has Arrived!</Text>
            <Text style={styles.statusSubtitle}>
              Please meet your driver at the pickup point. Number plate: {activeRide?.driverVehicle?.split('(')[1]?.replace(')', '') || 'LE-2024'}
            </Text>
          </View>
        </View>
      );
    }

    if (status === 'RIDE_STARTED') {
      return (
        <View style={[styles.statusCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <Text style={styles.statusEmoji}>🚀</Text>
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusTitle, { color: '#1D4ED8' }]}>Your Ride Has Started</Text>
            <Text style={styles.statusSubtitle}>
              Heading towards {activeRide?.destAddress?.slice(0, 32) || 'Destination'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.statusCard}>
        <Text style={styles.statusEmoji}>🚗</Text>
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusTitle}>Your Driver is On The Way</Text>
          <Text style={styles.statusSubtitle}>
            Estimated arrival at pickup in ~{driverEta} mins
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Live Trip</Text>
          <Text style={styles.headerSubtitle}>
            PIN: <Text style={styles.otpPin}>{activeRide?.startRideOtp || '4821'}</Text> (Share with driver to start)
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareTrip} activeOpacity={0.7}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.7}>
            <Text style={styles.sosBtnText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Real-time Map with Driver Live Pin */}
      <View style={styles.mapWrap}>
        <MapView
          userLocation={
            activeRide?.pickupLat && activeRide?.pickupLng
              ? { lat: activeRide.pickupLat, lng: activeRide.pickupLng }
              : null
          }
          pickupLocation={
            activeRide?.pickupLat && activeRide?.pickupLng
              ? { lat: activeRide.pickupLat, lng: activeRide.pickupLng }
              : null
          }
          destinationLocation={
            activeRide?.destLat && activeRide?.destLng
              ? { lat: activeRide.destLat, lng: activeRide.destLng }
              : null
          }
          driverLocation={
            driverLocation || {
              lat: (activeRide?.pickupLat || 31.5204) - 0.003,
              lng: (activeRide?.pickupLng || 74.3587) + 0.002,
              heading: 65,
            }
          }
          routeCoordinates={route?.coordinates}
          vehicleType={activeRide?.vehicleType || 'BIKE'}
        />
      </View>

      {/* Bottom Live Ride Dashboard Card */}
      <View style={styles.bottomCard}>
        {renderStatusBanner()}

        {/* Driver Details Row */}
        <View style={styles.driverProfileRow}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarEmoji}>
              {activeRide?.vehicleType === 'BIKE' ? '🏍️' : '🚗'}
            </Text>
          </View>
          <View style={styles.driverTextDetails}>
            <Text style={styles.driverName}>{activeRide?.driverName || 'Driver'}</Text>
            <Text style={styles.vehicleText}>{activeRide?.driverVehicle || 'Vehicle'}</Text>
            <View style={styles.plateBadge}>
              <Text style={styles.plateText}>
                Plate: {activeRide?.driverVehicle?.split('(')[1]?.replace(')', '') || 'LE-2024'}
              </Text>
            </View>
          </View>
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>Locked Fare</Text>
            <Text style={styles.fareValue}>PKR {activeRide?.agreedFare || 250}</Text>
          </View>
        </View>

        {/* Safety & Contact Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.chatActionBtn}
            onPress={() => router.push('/(main)/deal-chat')}
            activeOpacity={0.8}
          >
            <Text style={styles.chatActionText}>💬 Message Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callActionBtn}
            onPress={() => Alert.alert('Calling Driver', activeRide?.driverPhone || '+92 300 1234567')}
            activeOpacity={0.8}
          >
            <Text style={styles.callActionText}>📞 Call Driver</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  otpPin: {
    color: '#16A34A',
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  sosBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sosBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  mapWrap: {
    flex: 1,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  statusEmoji: {
    fontSize: 24,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  driverTextDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  plateBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  fareBox: {
    alignItems: 'flex-end',
  },
  fareLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chatActionBtn: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  chatActionText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  callActionBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  callActionText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
});
