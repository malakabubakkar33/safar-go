/**
 * SafarGo Customer Mobile - Dedicated Location Search Screen
 * Full-screen, keyboard-safe location selector for Peshawar, Pakistan.
 * Supports dual input (FROM & TO), location swapping, "Current GPS Location" shortcut,
 * saved places, real debounced OSM/Nominatim place autocomplete, and geofence validation.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRideStore, LocationPoint } from '../../src/store/rideStore';
import {
  PlaceSearchService,
  GeocodingService,
  PlaceSearchResult,
} from '../../src/services/geospatialServices';
import {
  isWithinPeshawar,
  SERVICE_AREA_NOTICE,
  PESHAWAR_LANDMARKS,
  PESHAWAR_CENTER,
} from '../../src/services/peshawarGeofence';

type ActiveField = 'from' | 'to';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pickup = useRideStore((s) => s.pickup);
  const destination = useRideStore((s) => s.destination);
  const setPickup = useRideStore((s) => s.setPickup);
  const setDestination = useRideStore((s) => s.setDestination);

  // Default active field based on route query parameter or state
  const initialField: ActiveField = params.field === 'pickup' ? 'from' : 'to';
  const [activeField, setActiveField] = useState<ActiveField>(initialField);

  const [fromQuery, setFromQuery] = useState(pickup?.address || '');
  const [toQuery, setToQuery] = useState(destination?.address || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const activeQuery = activeField === 'from' ? fromQuery : toQuery;
  const fromInputRef = useRef<TextInput>(null);
  const toInputRef = useRef<TextInput>(null);

  // Sync inputs when store changes
  useEffect(() => {
    if (pickup?.address && !fromQuery) {
      setFromQuery(pickup.address);
    }
    if (destination?.address && !toQuery) {
      setToQuery(destination.address);
    }
  }, [pickup, destination]);

  // Real Debounced Autocomplete Search
  useEffect(() => {
    const trimmed = activeQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const userCoords = pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : PESHAWAR_CENTER;
        const placeResults = await PlaceSearchService.search(trimmed, userCoords);
        if (placeResults.length > 0) {
          setResults(placeResults);
        } else {
          setResults([]);
          setSearchError('No matching places found in Peshawar. Try searching Saddar, Hayatabad, or University Road.');
        }
      } catch (err) {
        setSearchError('Failed to search locations. Please check connection.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [activeQuery, activeField]);

  // Swap FROM and TO locations
  const handleSwap = () => {
    const tempPickup = pickup;
    const tempDest = destination;
    const tempFromQuery = fromQuery;
    const tempToQuery = toQuery;

    setPickup(tempDest);
    setDestination(tempPickup);
    setFromQuery(tempToQuery);
    setToQuery(tempFromQuery);
  };

  // Acquire Current Device GPS Location
  const handleUseCurrentLocation = async () => {
    setIsDetectingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow GPS permission to detect your pickup address in Peshawar.'
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!isWithinPeshawar(lat, lng)) {
        Alert.alert('Outside Service Area', SERVICE_AREA_NOTICE);
      }

      const geocoded = await GeocodingService.reverseGeocode(lat, lng);
      const point: LocationPoint = {
        address: geocoded.address,
        lat,
        lng,
        name: geocoded.name || 'Current GPS Location',
        city: 'Peshawar',
      };

      if (activeField === 'from') {
        setPickup(point);
        setFromQuery(geocoded.address);
        // Switch focus to destination
        setActiveField('to');
        toInputRef.current?.focus();
      } else {
        setDestination(point);
        setToQuery(geocoded.address);
        if (pickup) {
          router.push('/(main)/route-preview');
        }
      }
    } catch (err) {
      Alert.alert('GPS Error', 'Unable to acquire device location. Please try searching manually.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Handle Place Selection
  const handleSelectPlace = (place: PlaceSearchResult | { title: string; address: string; lat: number; lng: number }) => {
    const lat = place.lat;
    const lng = place.lng;

    if (!isWithinPeshawar(lat, lng)) {
      Alert.alert('Outside Service Area', SERVICE_AREA_NOTICE);
      return;
    }

    const point: LocationPoint = {
      address: place.address,
      lat,
      lng,
      name: place.title,
      city: 'Peshawar',
    };

    if (activeField === 'from') {
      setPickup(point);
      setFromQuery(place.title || place.address);
      // Switch to destination
      setActiveField('to');
      toInputRef.current?.focus();
    } else {
      setDestination(point);
      setToQuery(place.title || place.address);

      // If pickup is already set, proceed directly to route preview
      if (pickup) {
        router.push('/(main)/route-preview');
      } else {
        // If pickup not set yet, prompt to set pickup
        setActiveField('from');
        fromInputRef.current?.focus();
      }
    }
  };

  // Saved / Popular Peshawar Landmarks for Instant Selection
  const popularPeshawarPlaces = PESHAWAR_LANDMARKS.slice(0, 6).map((lm) => ({
    id: lm.id,
    title: lm.title,
    address: lm.address,
    lat: lm.lat,
    lng: lm.lng,
    isWithinServiceArea: true,
  }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityLabel="Go Back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Choose your locations</Text>
            <Text style={styles.headerSubtitle}>Peshawar, Khyber Pakhtunkhwa</Text>
          </View>
        </View>

        {/* Inputs Card (FROM & TO) */}
        <View style={styles.inputsCard}>
          <View style={styles.connectorCol}>
            <View style={styles.pickupDot} />
            <View style={styles.verticalLine} />
            <View style={styles.destDot} />
          </View>

          <View style={styles.fieldsCol}>
            {/* FROM Input */}
            <TouchableOpacity
              style={[styles.inputRow, activeField === 'from' && styles.inputRowActive]}
              onPress={() => {
                setActiveField('from');
                fromInputRef.current?.focus();
              }}
              activeOpacity={1}
            >
              <View style={styles.inputFlex}>
                <Text style={styles.fieldLabel}>FROM (PICKUP)</Text>
                <TextInput
                  ref={fromInputRef}
                  style={styles.textInput}
                  placeholder="Enter pickup location in Peshawar..."
                  placeholderTextColor="#94A3B8"
                  value={fromQuery}
                  onChangeText={(val) => {
                    setFromQuery(val);
                    if (activeField !== 'from') setActiveField('from');
                  }}
                  onFocus={() => setActiveField('from')}
                  clearButtonMode="while-editing"
                />
              </View>
              {fromQuery.length > 0 && activeField === 'from' && (
                <TouchableOpacity onPress={() => setFromQuery('')} style={styles.clearBtn}>
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            {/* TO Input */}
            <TouchableOpacity
              style={[styles.inputRow, activeField === 'to' && styles.inputRowActive]}
              onPress={() => {
                setActiveField('to');
                toInputRef.current?.focus();
              }}
              activeOpacity={1}
            >
              <View style={styles.inputFlex}>
                <Text style={styles.fieldLabel}>TO (DESTINATION)</Text>
                <TextInput
                  ref={toInputRef}
                  style={styles.textInput}
                  placeholder="Where to in Peshawar?"
                  placeholderTextColor="#94A3B8"
                  value={toQuery}
                  onChangeText={(val) => {
                    setToQuery(val);
                    if (activeField !== 'to') setActiveField('to');
                  }}
                  onFocus={() => setActiveField('to')}
                  clearButtonMode="while-editing"
                />
              </View>
              {toQuery.length > 0 && activeField === 'to' && (
                <TouchableOpacity onPress={() => setToQuery('')} style={styles.clearBtn}>
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          {/* Swap Button */}
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={handleSwap}
            activeOpacity={0.75}
            accessibilityLabel="Swap pickup and destination"
          >
            <Text style={styles.swapArrow}>⇅</Text>
          </TouchableOpacity>
        </View>

        {/* Shortcuts Toolbar */}
        <View style={styles.shortcutsBar}>
          <TouchableOpacity
            style={styles.currentLocBtn}
            onPress={handleUseCurrentLocation}
            disabled={isDetectingGps}
            activeOpacity={0.75}
          >
            {isDetectingGps ? (
              <ActivityIndicator size="small" color="#16A34A" />
            ) : (
              <Text style={styles.currentLocIcon}>🎯</Text>
            )}
            <Text style={styles.currentLocText}>Use Current Location</Text>
          </TouchableOpacity>

          <View style={styles.servicePill}>
            <View style={styles.greenPulse} />
            <Text style={styles.servicePillText}>Peshawar Only</Text>
          </View>
        </View>

        {/* Results List / Suggestions */}
        <View style={styles.resultsWrap}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#16A34A" />
              <Text style={styles.loadingText}>Searching verified Peshawar places...</Text>
            </View>
          ) : searchError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySubtext}>{searchError}</Text>
            </View>
          ) : (
            <FlatList
              data={results.length > 0 ? results : popularPeshawarPlaces}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <Text style={styles.listHeaderTitle}>
                  {results.length > 0
                    ? `SEARCH RESULTS FOR "${activeQuery.trim()}"`
                    : 'POPULAR DESTINATIONS IN PESHAWAR'}
                </Text>
              }
              renderItem={({ item }) => {
                const supported = isWithinPeshawar(item.lat, item.lng);
                return (
                  <TouchableOpacity
                    style={styles.placeCard}
                    onPress={() => handleSelectPlace(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.placeIconCircle}>
                      <Text style={styles.placeIcon}>📍</Text>
                    </View>
                    <View style={styles.placeInfoWrap}>
                      <View style={styles.titleRow}>
                        <Text style={styles.placeTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!supported && (
                          <View style={styles.unsupportedBadge}>
                            <Text style={styles.unsupportedBadgeText}>OUTSIDE AREA</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.placeAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <Text style={styles.selectArrow}>↗</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardWrap: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  inputsCard: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectorCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    marginRight: 10,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#DCFCE7',
  },
  verticalLine: {
    width: 2,
    height: 36,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  destDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  fieldsCol: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
  },
  inputRowActive: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  inputFlex: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  textInput: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
    height: 24,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  swapArrow: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  shortcutsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  currentLocIcon: {
    fontSize: 14,
  },
  currentLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  servicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  resultsWrap: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 10,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  placeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIcon: {
    fontSize: 16,
  },
  placeInfoWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  unsupportedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unsupportedBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  placeAddress: {
    fontSize: 12,
    color: '#64748B',
  },
  selectArrow: {
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 8,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtext: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
});
