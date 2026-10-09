/**
 * SafarGo Customer Mobile - Premium Compact Header
 * Layout: Left = Logo, Center = Flexible Space, Right = Profile Avatar + Two-line Hamburger
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  onOpenMenu: () => void;
  onPressProfile?: () => void;
}

export function Header({ onOpenMenu, onPressProfile }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const initial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();

  return (
    <View style={styles.headerContainer}>
      {/* Left: SafarGo Logo */}
      <View style={styles.leftSection}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>S</Text>
        </View>
        <View style={styles.brandTitleWrap}>
          <Text style={styles.brandName}>Safar<Text style={styles.brandAccent}>Go</Text></Text>
          <View style={styles.cityPill}>
            <Text style={styles.cityText}>PESHAWAR</Text>
          </View>
        </View>
      </View>

      {/* Center: Flexible Empty Space (No Crowded Title) */}
      <View style={styles.flexSpace} />

      {/* Right: User Avatar + 2-Line Hamburger Menu */}
      <View style={styles.rightSection}>
        {/* User Profile Avatar */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onPressProfile}
          activeOpacity={0.7}
          accessibilityLabel="Open Profile"
        >
          {user?.avatarUrl && !user.avatarUrl.includes('safargo-symbol') ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Hamburger Menu (Two Horizontal Lines) */}
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={onOpenMenu}
          activeOpacity={0.7}
          accessibilityLabel="Open Navigation Menu"
        >
          <View style={styles.hamburgerLine} />
          <View style={[styles.hamburgerLine, styles.hamburgerLineShort]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      },
    }),
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Bold' : 'sans-serif-medium',
    lineHeight: 22,
  },
  brandTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#16A34A',
  },
  cityPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  flexSpace: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#16A34A',
    overflow: 'hidden',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  hamburgerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hamburgerLine: {
    width: 17,
    height: 2.2,
    backgroundColor: '#1E293B',
    borderRadius: 2,
  },
  hamburgerLineShort: {
    width: 12,
    alignSelf: 'flex-start',
    marginLeft: 9.5,
  },
});
