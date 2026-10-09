/**
 * SafarGo Customer Mobile - Profile & Saved Places Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');

  useEffect(() => {
    api.getSavedPlaces()
      .then((res) => {
        if (res.places) setSavedPlaces(res.places);
      })
      .catch(() => {});
  }, []);

  const handleSavePlace = async () => {
    if (!newAddress.trim()) {
      Alert.alert('Required', 'Please enter place address.');
      return;
    }

    try {
      const res = await api.savePlace({
        label: newLabel,
        address: newAddress.trim(),
        lat: 31.5204 + (Math.random() - 0.5) * 0.04,
        lng: 74.3587 + (Math.random() - 0.5) * 0.04,
      });

      if (res.success && res.place) {
        setSavedPlaces([...savedPlaces, res.place]);
        setShowAddPlace(false);
        setNewAddress('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save place.');
    }
  };

  const handleDeletePlace = async (id: string) => {
    try {
      await api.deleteSavedPlace(id);
      setSavedPlaces(savedPlaces.filter((p) => p.id !== id));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>
                {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </Text>
            )}
          </View>
          <Text style={styles.userName}>{user?.fullName || 'SafarGo Traveler'}</Text>
          <Text style={styles.userHandle}>@{user?.username || 'user'}</Text>
          <Text style={styles.userContact}>{user?.email} • {user?.phone}</Text>
        </View>

        {/* Saved Places Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Saved Places</Text>
          <TouchableOpacity
            style={styles.addPlaceBtn}
            onPress={() => setShowAddPlace(!showAddPlace)}
            activeOpacity={0.7}
          >
            <Text style={styles.addPlaceText}>{showAddPlace ? 'Cancel' : '+ Add Place'}</Text>
          </TouchableOpacity>
        </View>

        {showAddPlace && (
          <View style={styles.addPlaceForm}>
            <View style={styles.labelPickerRow}>
              {['Home', 'Work', 'Gym', 'Other'].map((lbl) => (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.labelPill, newLabel === lbl && styles.labelPillActive]}
                  onPress={() => setNewLabel(lbl)}
                >
                  <Text style={[styles.labelText, newLabel === lbl && styles.labelTextActive]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.addressInput}
              placeholder="Enter location address..."
              placeholderTextColor="#94A3B8"
              value={newAddress}
              onChangeText={setNewAddress}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlace} activeOpacity={0.88}>
              <Text style={styles.saveBtnText}>Save Location</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.placesList}>
          {savedPlaces.length === 0 ? (
            <Text style={styles.emptyPlacesText}>No saved places yet. Add Home or Work for 1-tap booking.</Text>
          ) : (
            savedPlaces.map((place) => (
              <View key={place.id} style={styles.placeItem}>
                <View style={styles.placeIconBox}>
                  <Text style={styles.placeIcon}>
                    {place.label.toLowerCase() === 'home' ? '🏠' : place.label.toLowerCase() === 'work' ? '💼' : '📍'}
                  </Text>
                </View>
                <View style={styles.placeTextWrap}>
                  <Text style={styles.placeLabel}>{place.label}</Text>
                  <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeletePlace(place.id)} activeOpacity={0.7}>
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Settings & Support Links */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Preferences & Safety</Text>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <Text style={styles.menuRowIcon}>🔒</Text>
          <Text style={styles.menuRowLabel}>Privacy & Permissions</Text>
          <Text style={styles.menuRowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <Text style={styles.menuRowIcon}>🛡️</Text>
          <Text style={styles.menuRowLabel}>Emergency Contacts (SOS)</Text>
          <Text style={styles.menuRowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <Text style={styles.menuRowIcon}>💬</Text>
          <Text style={styles.menuRowLabel}>SafarGo 24/7 Helpline</Text>
          <Text style={styles.menuRowArrow}>›</Text>
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
  container: {
    padding: 20,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 22,
    marginBottom: 24,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  userHandle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  userContact: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  addPlaceBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  addPlaceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  addPlaceForm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  labelPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  labelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  labelPillActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  labelTextActive: {
    color: '#FFFFFF',
  },
  addressInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  placesList: {
    gap: 8,
  },
  emptyPlacesText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  placeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIcon: {
    fontSize: 16,
  },
  placeTextWrap: {
    flex: 1,
  },
  placeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  placeAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  deleteText: {
    fontSize: 16,
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuRowIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuRowArrow: {
    fontSize: 18,
    color: '#94A3B8',
  },
  logoutBtn: {
    marginTop: 28,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
