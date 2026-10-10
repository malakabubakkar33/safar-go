/**
 * SafarGo Customer Mobile - Dedicated Location Search Screen
 * Full-screen, keyboard-safe location selector for Peshawar, Pakistan.
 * Supports dual input (FROM & TO), location swapping, "Current GPS Location" shortcut,
 * category filtering pills, fast debounce with request cancellation, local cache,
 * saved places, recent searches, and instant road routing upon destination selection.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRideStore, LocationPoint } from '../../src/store/rideStore';
import {
  PlaceSearchService,
  GeocodingService,
  LocationService,
  PlaceSearchResult,
  ServiceAreaService,
  RoutingService,
  PESHAWAR_CENTER,
  SERVICE_AREA_NOTICE,
} from '../../src/services';
import { api } from '../../src/services/api';

type ActiveField = 'from' | 'to';

interface RecentPlace {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Places', icon: '📍' },
  { id: 'hospital', label: 'Hospitals', icon: '🏥' },
  { id: 'education', label: 'Universities', icon: '🎓' },
  { id: 'market', label: 'Markets', icon: '🏬' },
  { id: 'neighborhood', label: 'Areas', icon: '🏡' },
  { id: 'transport', label: 'Transit', icon: '✈️' },
  { id: 'restaurant', label: 'Dining', icon: '🍽️' },
  { id: 'park', label: 'Parks', icon: '🌳' },
];

const RECENT_STORAGE_KEY = 'safargo_recent_places';

function getStoredRecentPlaces(): RecentPlace[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, 5);
      }
    }
  } catch {}
  return [];
}

function saveRecentPlaceToStorage(place: RecentPlace) {
  try {
    if (typeof localStorage !== 'undefined') {
      const current = getStoredRecentPlaces();
      const filtered = current.filter((p) => p.address !== place.address && p.title !== place.title);
      const updated = [place, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pickup = useRideStore((s) => s.pickup);
  const destination = useRideStore((s) => s.destination);
  const setPickup = useRideStore((s) => s.setPickup);
  const setDestination = useRideStore((s) => s.setDestination);
  const setRoute = useRideStore((s) => s.setRoute);

  const initialField: ActiveField = params.field === 'pickup' ? 'from' : 'to';
  const [activeField, setActiveField] = useState<ActiveField>(initialField);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [fromQuery, setFromQuery] = useState(pickup?.address || '');
  const [toQuery, setToQuery] = useState(destination?.address || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  // Saved & Recent Places
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);

  const fromInputRef = useRef<TextInput>(null);
  const toInputRef = useRef<TextInput>(null);
  const searchRequestId = useRef<number>(0);

  const activeQuery = activeField === 'from' ? fromQuery : toQuery;

  // 1. Initial Load: Fetch saved places & recent searches, auto-focus active input
  useEffect(() => {
    setRecentPlaces(getStoredRecentPlaces());

    api
      .getSavedPlaces()
      .then((res) => {
        if (Array.isArray(res?.places)) {
          setSavedPlaces(res.places);
        }
      })
      .catch(() => {});

    // Smooth auto-focus after screen transition
    const focusTimer = setTimeout(() => {
      if (initialField === 'from') {
        fromInputRef.current?.focus();
      } else {
        toInputRef.current?.focus();
      }
    }, 180);

    return () => clearTimeout(focusTimer);
  }, [initialField]);

  // Sync inputs with global rideStore
  useEffect(() => {
    if (pickup?.address && !fromQuery) {
      setFromQuery(pickup.address);
    }
    if (destination?.address && !toQuery) {
      setToQuery(destination.address);
    }
  }, [pickup, destination]);

  // 2. Debounced Place Search with Outdated Request Cancellation
  const executeSearch = useCallback(
    async (query: string, category: string) => {
      const trimmed = query.trim();
      const userCoords = pickup?.lat ? { lat: pickup.lat, lng: pickup.lng } : null;

      // When query is too short, show verified landmarks and clear errors
      if (trimmed.length < 2) {
        setLoading(false);
        const defaults = PlaceSearchService.getDefaultLandmarks(userCoords, category);
        setResults(defaults);
        setSearchError(null);
        return;
      }

      setLoading(true);
      setSearchError(null);

      // Unique token for request cancellation: prevents stale responses from overwriting newer queries
      const currentRequestId = ++searchRequestId.current;

      try {
        const placeResults = await PlaceSearchService.search(trimmed, userCoords, category);

        // Cancel if user has continued typing
        if (currentRequestId !== searchRequestId.current) return;

        if (placeResults.length > 0) {
          setResults(placeResults);
          setSearchError(null);
        } else {
          setResults([]);
          setSearchError(
            `No places matching "${trimmed}" in Peshawar. Try searching Saddar, Hayatabad, or University Road.`
          );
        }
      } catch {
        if (currentRequestId !== searchRequestId.current) return;
        setSearchError('Connection slow. Showing verified local Peshawar landmarks.');
        const localMatches = PlaceSearchService.searchLocalDirectory(trimmed, userCoords, category);
        setResults(localMatches);
      } finally {
        if (currentRequestId === searchRequestId.current) {
          setLoading(false);
        }
      }
    },
    [pickup]
  );

  // 280ms Debounce (within 250-350ms requirement)
  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(activeQuery, selectedCategory);
    }, 280);

    return () => clearTimeout(timer);
  }, [activeQuery, selectedCategory, executeSearch]);

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
    setPromptMessage(null);
    try {
      const { status, position, errorMessage } = await LocationService.getCurrentPosition();

      if (status !== 'granted' || !position) {
        Alert.alert('GPS Location', errorMessage || 'Please enable GPS permissions.');
        return;
      }

      const { lat, lng } = position;
      const inServiceArea = ServiceAreaService.isWithinServiceArea(lat, lng);

      if (!inServiceArea) {
        Alert.alert('Outside Service Area', SERVICE_AREA_NOTICE);
        return;
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

        if (destination) {
          // If destination already set, calculate route and navigate
          calculateAndProceed(point, destination);
        } else {
          setActiveField('to');
          toInputRef.current?.focus();
        }
      } else {
        setDestination(point);
        setToQuery(geocoded.address);

        if (pickup) {
          calculateAndProceed(pickup, point);
        } else {
          setPromptMessage('Destination set! Please enter or confirm your pickup location.');
          setActiveField('from');
          fromInputRef.current?.focus();
        }
      }
    } catch (err: any) {
      Alert.alert('GPS Error', err.message || 'Unable to retrieve your current location.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Calculate Road Route and Proceed to Route Preview Screen
  const calculateAndProceed = async (p: LocationPoint, d: LocationPoint) => {
    try {
      // Calculate real road route using OSRM / calibrated road network
      const routeData = await RoutingService.getRoute(p.lat, p.lng, d.lat, d.lng);
      setRoute(routeData);
    } catch (err) {
      console.warn('[Search] Route calculation error, using fallback:', err);
    } finally {
      router.push('/(main)/route-preview');
    }
  };

  // 3. Handle Place Selection (Single Tap, Immediate Application)
  const handleSelectPlace = async (place: {
    id?: string;
    title?: string;
    name?: string;
    address: string;
    lat: number;
    lng: number;
    category?: string;
  }) => {
    if (isSubmitting) return;

    const lat = Number(place.lat);
    const lng = Number(place.lng);

    // Geofence check: Never silently alter outside coordinates
    if (!ServiceAreaService.isWithinServiceArea(lat, lng)) {
      Alert.alert('Outside Service Area', SERVICE_AREA_NOTICE);
      return;
    }

    setIsSubmitting(true);
    setPromptMessage(null);

    const displayName = place.title || place.name || 'Peshawar Place';
    const point: LocationPoint = {
      address: place.address,
      lat,
      lng,
      name: displayName,
      city: 'Peshawar',
    };

    // Save into recent searches cache
    saveRecentPlaceToStorage({
      id: place.id || `rec_${Date.now()}`,
      title: displayName,
      address: place.address,
      lat,
      lng,
      category: place.category,
    });
    setRecentPlaces(getStoredRecentPlaces());

    if (activeField === 'to') {
      // Destination selected
      setDestination(point);
      setToQuery(displayName || place.address);

      if (pickup && ServiceAreaService.isWithinServiceArea(pickup.lat, pickup.lng)) {
        // Valid pickup exists -> calculate real road route and proceed
        await calculateAndProceed(pickup, point);
      } else {
        // Pickup missing -> retain destination and prompt user to complete pickup
        setIsSubmitting(false);
        setPromptMessage('Destination saved! Please confirm your pickup location.');
        setActiveField('from');
        fromInputRef.current?.focus();
      }
    } else {
      // Pickup selected
      setPickup(point);
      setFromQuery(displayName || place.address);

      if (destination && ServiceAreaService.isWithinServiceArea(destination.lat, destination.lng)) {
        // Valid destination exists -> calculate real road route and proceed
        await calculateAndProceed(point, destination);
      } else {
        // Destination missing -> switch focus to destination
        setIsSubmitting(false);
        setActiveField('to');
        toInputRef.current?.focus();
      }
    }
  };

  // Clear Recent Places History
  const handleClearRecents = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(RECENT_STORAGE_KEY);
      }
      setRecentPlaces([]);
    } catch {}
  };

  // Category Icon Resolver
  const getCategoryIcon = (category?: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('hospital') || cat.includes('health') || cat.includes('clinic')) return '🏥';
    if (cat.includes('education') || cat.includes('university') || cat.includes('college') || cat.includes('school')) return '🎓';
    if (cat.includes('market') || cat.includes('mall') || cat.includes('bazaar') || cat.includes('shop')) return '🏬';
    if (cat.includes('neighborhood') || cat.includes('residential') || cat.includes('area')) return '🏡';
    if (cat.includes('transport') || cat.includes('airport') || cat.includes('station') || cat.includes('terminal')) return '✈️';
    if (cat.includes('restaurant') || cat.includes('food') || cat.includes('dining')) return '🍽️';
    if (cat.includes('park') || cat.includes('garden')) return '🌳';
    if (cat.includes('road') || cat.includes('street') || cat.includes('highway')) return '🛣️';
    return '📍';
  };

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
            accessibilityLabel="Go Back to Map"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Where are you going?</Text>
            <Text style={styles.headerSubtitle}>Peshawar, Khyber Pakhtunkhwa</Text>
          </View>
        </View>

        {/* Informational Prompt Banner */}
        {promptMessage && (
          <View style={styles.promptBanner}>
            <Text style={styles.promptIcon}>ℹ️</Text>
            <Text style={styles.promptText}>{promptMessage}</Text>
          </View>
        )}

        {/* Dual Input Selector (FROM & TO) */}
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
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>FROM (PICKUP)</Text>
                  {pickup?.lat && (
                    <View style={styles.selectedPill}>
                      <Text style={styles.selectedPillText}>✓ Verified</Text>
                    </View>
                  )}
                </View>
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
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>TO (DESTINATION)</Text>
                  {destination?.lat && (
                    <View style={styles.selectedPill}>
                      <Text style={styles.selectedPillText}>✓ Verified</Text>
                    </View>
                  )}
                </View>
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
            <Text style={styles.servicePillText}>Peshawar Operating Area</Text>
          </View>
        </View>

        {/* Category Filter Chips */}
        <View style={styles.categoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results List / Saved & Recent Places */}
        <View style={styles.resultsWrap}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#16A34A" />
              <Text style={styles.loadingText}>Searching verified Peshawar places...</Text>
            </View>
          ) : searchError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>No Matching Places</Text>
              <Text style={styles.emptySubtext}>{searchError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => executeSearch(activeQuery, selectedCategory)}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>Retry Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View>
                  {/* Saved Places (When Query is Empty) */}
                  {activeQuery.trim().length < 2 && savedPlaces.length > 0 && (
                    <View style={styles.sectionBlock}>
                      <Text style={styles.sectionHeaderTitle}>SAVED PLACES</Text>
                      {savedPlaces.map((sp) => (
                        <TouchableOpacity
                          key={sp.id}
                          style={styles.savedPlaceRow}
                          onPress={() =>
                            handleSelectPlace({
                              id: sp.id,
                              title: sp.label,
                              address: sp.address,
                              lat: sp.lat,
                              lng: sp.lng,
                              category: sp.label,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <View style={styles.savedIconCircle}>
                            <Text style={styles.savedIcon}>
                              {sp.label.toLowerCase().includes('home')
                                ? '🏠'
                                : sp.label.toLowerCase().includes('work')
                                ? '💼'
                                : '⭐'}
                            </Text>
                          </View>
                          <View style={styles.placeInfoWrap}>
                            <Text style={styles.placeTitle}>{sp.label}</Text>
                            <Text style={styles.placeAddress} numberOfLines={1}>
                              {sp.address}
                            </Text>
                          </View>
                          <Text style={styles.selectArrow}>↗</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Recent Searches (When Query is Empty) */}
                  {activeQuery.trim().length < 2 && recentPlaces.length > 0 && (
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>RECENT SEARCHES</Text>
                        <TouchableOpacity onPress={handleClearRecents} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.clearRecentsText}>Clear</Text>
                        </TouchableOpacity>
                      </View>
                      {recentPlaces.map((rp) => (
                        <TouchableOpacity
                          key={rp.id}
                          style={styles.recentPlaceRow}
                          onPress={() => handleSelectPlace(rp)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.recentIconCircle}>
                            <Text style={styles.recentIcon}>🕒</Text>
                          </View>
                          <View style={styles.placeInfoWrap}>
                            <Text style={styles.placeTitle}>{rp.title}</Text>
                            <Text style={styles.placeAddress} numberOfLines={1}>
                              {rp.address}
                            </Text>
                          </View>
                          <Text style={styles.selectArrow}>↗</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.listHeaderTitle}>
                    {activeQuery.trim().length >= 2
                      ? `SEARCH RESULTS FOR "${activeQuery.trim().toUpperCase()}"`
                      : selectedCategory !== 'all'
                      ? `POPULAR IN ${selectedCategory.toUpperCase()}`
                      : 'VERIFIED PLACES IN PESHAWAR'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const supported = ServiceAreaService.isWithinServiceArea(item.lat, item.lng);
                const icon = getCategoryIcon(item.category);
                const isCurrentSelected =
                  (activeField === 'to' &&
                    destination?.lat === item.lat &&
                    destination?.lng === item.lng) ||
                  (activeField === 'from' &&
                    pickup?.lat === item.lat &&
                    pickup?.lng === item.lng);

                return (
                  <TouchableOpacity
                    style={[styles.placeCard, isCurrentSelected && styles.placeCardSelected]}
                    onPress={() => handleSelectPlace(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.placeIconCircle, isCurrentSelected && styles.placeIconCircleSelected]}>
                      <Text style={styles.placeIcon}>{icon}</Text>
                    </View>
                    <View style={styles.placeInfoWrap}>
                      <View style={styles.titleRow}>
                        <Text style={styles.placeTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.category && (
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{item.category}</Text>
                          </View>
                        )}
                        {isCurrentSelected && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>✓ SELECTED</Text>
                          </View>
                        )}
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
                    <View style={styles.rightEndWrap}>
                      {item.distanceKm != null && (
                        <Text style={styles.distanceText}>{item.distanceKm} km</Text>
                      )}
                      <Text style={styles.selectArrow}>↗</Text>
                    </View>
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
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 1,
  },
  promptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  promptIcon: {
    fontSize: 14,
  },
  promptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    flex: 1,
  },
  inputsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  connectorCol: {
    alignItems: 'center',
    width: 22,
    paddingVertical: 8,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  destDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#DC2626',
  },
  fieldsCol: {
    flex: 1,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  inputRowActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  inputFlex: {
    flex: 1,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  selectedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selectedPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#15803D',
  },
  textInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 2,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  swapArrow: {
    fontSize: 18,
    color: '#16A34A',
    fontWeight: '700',
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
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  currentLocIcon: {
    fontSize: 13,
  },
  currentLocText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  servicePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  categoriesSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryLabelSelected: {
    color: '#15803D',
    fontWeight: '700',
  },
  resultsWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sectionBlock: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  clearRecentsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  savedPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  savedIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedIcon: {
    fontSize: 15,
  },
  recentPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  recentIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentIcon: {
    fontSize: 14,
  },
  loadingState: {
    paddingTop: 50,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#16A34A',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  placeCardSelected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  placeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIconCircleSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
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
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  selectedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#15803D',
  },
  unsupportedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unsupportedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#DC2626',
  },
  placeAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rightEndWrap: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 2,
  },
  selectArrow: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
