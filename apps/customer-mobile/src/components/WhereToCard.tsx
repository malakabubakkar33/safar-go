/**
 * SafarGo Customer Mobile - Premium Integrated Location Card
 * Displays two distinct rows: PICKUP ("Detecting your location..." / resolved address)
 * and DESTINATION ("Search destination in Peshawar"), connected with a visual line,
 * swap action, and genuine Peshawar quick shortcuts.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

export interface QuickPlace {
  title: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
  tag?: string;
}

interface WhereToCardProps {
  pickupAddress?: string;
  destinationAddress?: string;
  isDetectingLocation?: boolean;
  onPressSearch: (field?: 'pickup' | 'destination') => void;
  onSwapLocations?: () => void;
  onSelectQuickPlace?: (place: QuickPlace) => void;
}

// 4 Authenticated Peshawar Landmark Shortcuts (Verified Coordinates)
export const PESHAWAR_QUICK_PLACES: QuickPlace[] = [
  {
    title: 'Saddar',
    address: 'Saddar Bazaar, Peshawar Cantt',
    lat: 34.0084,
    lng: 71.5545,
    icon: '🏬',
    tag: 'Shopping',
  },
  {
    title: 'Hayatabad',
    address: 'Phase 3 / Tatara Park, Hayatabad',
    lat: 33.9892,
    lng: 71.4367,
    icon: '🌳',
    tag: 'Residential',
  },
  {
    title: 'Univ of Peshawar',
    address: 'University Road, Peshawar',
    lat: 34.0006,
    lng: 71.4851,
    icon: '🎓',
    tag: 'Education',
  },
  {
    title: 'KTH Hospital',
    address: 'Khyber Teaching Hospital, Jamrud Rd',
    lat: 34.0041,
    lng: 71.4897,
    icon: '🏥',
    tag: 'Medical',
  },
];

export function WhereToCard({
  pickupAddress,
  destinationAddress,
  isDetectingLocation = false,
  onPressSearch,
  onSwapLocations,
  onSelectQuickPlace,
}: WhereToCardProps) {
  const displayPickup = isDetectingLocation
    ? 'Detecting your location in Peshawar...'
    : pickupAddress || 'Current GPS Location';

  return (
    <View style={styles.cardContainer}>
      <View style={styles.dragHandle} />

      {/* Card Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>Where are you going?</Text>
          <Text style={styles.cardSubtitle}>Real-time rides across Peshawar</Text>
        </View>
        <View style={styles.cityBadge}>
          <Text style={styles.cityBadgeText}>PESHAWAR ONLY</Text>
        </View>
      </View>

      {/* Integrated Location Box with Connector */}
      <View style={styles.locationBox}>
        {/* Visual Connector Column */}
        <View style={styles.connectorColumn}>
          <View style={styles.pickupPin}>
            <View style={styles.pickupDot} />
          </View>
          <View style={styles.connectorLine} />
          <View style={styles.destPin}>
            <View style={styles.destDot} />
          </View>
        </View>

        {/* Input Rows Column */}
        <View style={styles.rowsColumn}>
          {/* Row 1: PICKUP */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => onPressSearch('pickup')}
            activeOpacity={0.7}
            accessibilityLabel="Set pickup location"
          >
            <View style={styles.labelValueWrap}>
              <Text style={styles.rowLabel}>PICKUP</Text>
              <Text
                style={[
                  styles.addressText,
                  isDetectingLocation && styles.addressDetecting,
                ]}
                numberOfLines={1}
              >
                {displayPickup}
              </Text>
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </TouchableOpacity>

          <View style={styles.horizontalDivider} />

          {/* Row 2: DESTINATION */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => onPressSearch('destination')}
            activeOpacity={0.7}
            accessibilityLabel="Search destination in Peshawar"
          >
            <View style={styles.labelValueWrap}>
              <Text style={styles.rowLabel}>DESTINATION</Text>
              <Text
                style={[
                  styles.addressText,
                  !destinationAddress && styles.placeholderText,
                ]}
                numberOfLines={1}
              >
                {destinationAddress || 'Search destination in Peshawar'}
              </Text>
            </View>
            <View style={styles.searchActionCircle}>
              <Text style={styles.searchActionArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Swap Control */}
        {onSwapLocations && (
          <TouchableOpacity
            style={styles.swapButton}
            onPress={onSwapLocations}
            activeOpacity={0.75}
            accessibilityLabel="Swap pickup and destination"
          >
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Verified Peshawar Destinations */}
      <View style={styles.quickSection}>
        <Text style={styles.quickHeaderTitle}>POPULAR IN PESHAWAR</Text>
        <View style={styles.quickGrid}>
          {PESHAWAR_QUICK_PLACES.map((place) => (
            <TouchableOpacity
              key={place.title}
              style={styles.quickPill}
              onPress={() => onSelectQuickPlace && onSelectQuickPlace(place)}
              activeOpacity={0.72}
            >
              <Text style={styles.quickIcon}>{place.icon}</Text>
              <View style={styles.quickTextWrap}>
                <Text style={styles.quickTitle} numberOfLines={1}>
                  {place.title}
                </Text>
                <Text style={styles.quickTag}>{place.tag}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 10,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#F1F5F9',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  cityBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  cityBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 14,
    position: 'relative',
  },
  connectorColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    marginRight: 10,
  },
  pickupPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#16A34A',
  },
  connectorLine: {
    width: 2,
    height: 28,
    backgroundColor: '#CBD5E1',
    marginVertical: 3,
  },
  destPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  rowsColumn: {
    flex: 1,
    paddingRight: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  labelValueWrap: {
    flex: 1,
    marginRight: 8,
  },
  rowLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  addressDetecting: {
    color: '#16A34A',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#64748B',
    fontWeight: '500',
  },
  editIcon: {
    fontSize: 13,
    color: '#94A3B8',
    paddingHorizontal: 4,
  },
  searchActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionArrow: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  horizontalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  swapButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    marginLeft: 4,
  },
  swapIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  quickSection: {
    marginTop: 2,
  },
  quickHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
  },
  quickIcon: {
    fontSize: 16,
  },
  quickTextWrap: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  quickTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
});
