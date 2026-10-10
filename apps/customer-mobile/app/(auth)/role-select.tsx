/**
 * SafarGo Customer Mobile - Role / Category Selection Screen
 * Enables users to choose their operational role: Customer (Traveler) vs Driver (Provider)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

export default function RoleSelectScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedRole, setSelectedRole] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmRole = async () => {
    setIsLoading(true);
    try {
      const res = await api.selectRole(selectedRole);
      if (res.success && res.user) {
        useAuthStore.setState({ user: res.user });
      }

      if (selectedRole === 'CUSTOMER') {
        router.replace('/(main)/home');
      } else {
        Alert.alert(
          'Driver Mode Activated',
          'Your profile is set as a driver. Please complete your driver document verification to start receiving ride requests.',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(main)/home'),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Role Selection', err.message || 'Unable to update role.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>S</Text>
          </View>
          <Text style={styles.title}>Choose how you'll use SafarGo</Text>
          <Text style={styles.subtitle}>
            Select your primary role. You can switch or apply as a driver anytime from your profile settings.
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsWrap}>
          {/* Option 1: Customer */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'CUSTOMER' && styles.roleCardActive,
            ]}
            onPress={() => setSelectedRole('CUSTOMER')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, selectedRole === 'CUSTOMER' && styles.iconWrapActive]}>
                <Text style={styles.roleEmoji}>🚗</Text>
              </View>
              {selectedRole === 'CUSTOMER' && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardTitle}>I want to book rides</Text>
            <Text style={styles.cardDesc}>
              Travel across Peshawar with SafarGo Bike or Car at competitive negotiated fares.
            </Text>
          </TouchableOpacity>

          {/* Option 2: Driver */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'DRIVER' && styles.roleCardActive,
            ]}
            onPress={() => setSelectedRole('DRIVER')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, selectedRole === 'DRIVER' && styles.iconWrapActive]}>
                <Text style={styles.roleEmoji}>💼</Text>
              </View>
              {selectedRole === 'DRIVER' && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardTitle}>I want to drive & earn</Text>
            <Text style={styles.cardDesc}>
              Offer rides, negotiate fares with passengers, and earn income on your own schedule.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.confirmBtn, isLoading && styles.confirmBtnDisabled]}
            onPress={handleConfirmRole}
            disabled={isLoading}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>
                Continue as {selectedRole === 'CUSTOMER' ? 'Customer' : 'Driver'} →
              </Text>
            )}
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  header: {
    marginTop: 20,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoBadgeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
  cardsWrap: {
    gap: 16,
    marginVertical: 20,
  },
  roleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 20,
  },
  roleCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  roleEmoji: {
    fontSize: 24,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  bottomBar: {
    marginBottom: 12,
  },
  confirmBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
