/**
 * SafarGo Customer Mobile - Ride History Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

export default function HistoryScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory(activeTab);
  }, [activeTab]);

  const fetchHistory = (filter: 'all' | 'completed' | 'cancelled') => {
    setLoading(true);
    api.getRideHistory(filter)
      .then((res) => {
        if (res.rides) setRides(res.rides);
      })
      .catch((err) => console.warn('History error:', err))
      .finally(() => setLoading(false));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'completed', 'cancelled'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rides List */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#16A34A" size="large" />
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📜</Text>
            <Text style={styles.emptyTitle}>No Rides Found</Text>
            <Text style={styles.emptySub}>
              You have no {activeTab !== 'all' ? activeTab : ''} trips in your history yet.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.dateWrap}>
                    <Text style={styles.dateText}>
                      {new Date(item.createdAt).toLocaleDateString('en-PK', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.vehicleType}>{item.vehicleType}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'COMPLETED' ? styles.statusCompleted : styles.statusCancelled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        item.status === 'COMPLETED' ? styles.textCompleted : styles.textCancelled,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Route Addresses */}
                <View style={styles.routeBox}>
                  <View style={styles.routeItem}>
                    <View style={styles.greenDot} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {item.pickupAddress}
                    </Text>
                  </View>
                  <View style={styles.routeItem}>
                    <View style={styles.redDot} />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {item.destAddress}
                    </Text>
                  </View>
                </View>

                {/* Footer: Driver & Fare */}
                <View style={styles.cardFooter}>
                  <Text style={styles.driverName}>
                    Driver: {item.driverName || 'SafarGo Driver'}
                  </Text>
                  <Text style={styles.fareAmount}>
                    PKR {item.agreedFare || item.estimatedFare || 0}
                  </Text>
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
  tabsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#16A34A',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateWrap: {
    gap: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleType: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textCompleted: {
    color: '#15803D',
  },
  textCancelled: {
    color: '#DC2626',
  },
  routeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 10,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16A34A',
  },
});
