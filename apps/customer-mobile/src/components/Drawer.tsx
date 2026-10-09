/**
 * SafarGo Customer Mobile - Animated Drawer Navigation
 * Contains: Home, Ride History, Saved Places, Notifications, Payment Methods, Help & Support, Settings, Profile, Logout
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAuthStore } from '../store/authStore';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, width * 0.82);

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export function Drawer({ isOpen, onClose, onNavigate }: DrawerProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);

  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (isOpen) {
      translateX.value = withTiming(0, { duration: 280 });
      backdropOpacity.value = withTiming(0.5, { duration: 280 });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, { duration: 240 });
      backdropOpacity.value = withTiming(0, { duration: 240 });
    }
  }, [isOpen]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const initial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();

  const handleItemPress = (item: { id: string; route?: string; title: string; content?: string }) => {
    onClose();
    if (item.route) {
      setTimeout(() => onNavigate(item.route!), 200);
    } else if (item.content) {
      setTimeout(() => setInfoModal({ title: item.title, content: item.content! }), 250);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of SafarGo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          onClose();
          logout();
          onNavigate('/(auth)/login');
        },
      },
    ]);
  };

  const menuItems = [
    { id: 'home', icon: '🏠', title: 'Home', route: '/(main)/home' },
    { id: 'history', icon: '🕒', title: 'Ride History', route: '/(main)/history' },
    { id: 'saved', icon: '📍', title: 'Saved Places', route: '/(main)/profile' },
    {
      id: 'notifications',
      icon: '🔔',
      title: 'Notifications',
      content: 'You have no new alerts. SafarGo ride updates and driver arrival alerts will appear here in real time.',
    },
    {
      id: 'payment',
      icon: '💳',
      title: 'Payment Methods',
      content: 'Supported Payment Modes in Peshawar:\n\n• Cash on Ride (Default)\n• SafarPay Digital Wallet\n• Bank Card (Raast / Debit Card)',
    },
    {
      id: 'support',
      icon: '💬',
      title: 'Help & Support',
      content: 'SafarGo Peshawar Helpline: 091-555-SAFAR (72327)\nEmail: support@safargo.com\n\n24/7 Roadside Assistance & Emergency Response available across Peshawar.',
    },
    {
      id: 'settings',
      icon: '⚙️',
      title: 'Settings',
      content: 'SafarGo Mobile v1.0.0 (Peshawar Edition)\n\n• Language: English / Urdu\n• Dark Mode: System Default\n• GPS Accuracy: High Precision',
    },
    { id: 'profile', icon: '👤', title: 'Profile', route: '/(main)/profile' },
  ];

  return (
    <>
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]} pointerEvents={isOpen ? 'auto' : 'none'}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        {/* Drawer Content */}
        <Animated.View style={[styles.drawer, drawerStyle]}>
          {/* User Profile Banner */}
          <View style={styles.profileBanner}>
            <View style={styles.avatarWrap}>
              {user?.avatarUrl && !user.avatarUrl.includes('safargo-symbol') ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarLetter}>{initial}</Text>
              )}
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.fullName || 'SafarGo Traveler'}
            </Text>
            <Text style={styles.userHandle}>
              {user?.username ? `@${user.username}` : user?.phone || 'Peshawar Rider'}
            </Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>⭐ 4.95 • Verified Traveler</Text>
            </View>
          </View>

          {/* Navigation List */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Logout Action */}
            <TouchableOpacity style={styles.logoutItem} onPress={handleLogoutPress} activeOpacity={0.7}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Version */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>SafarGo Peshawar Mobility • v1.0</Text>
          </View>
        </Animated.View>
      </View>

      {/* Info Dialog Modal */}
      {infoModal && (
        <Modal transparent animationType="fade" visible={Boolean(infoModal)} onRequestClose={() => setInfoModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{infoModal.title}</Text>
              <Text style={styles.modalContent}>{infoModal.content}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setInfoModal(null)}>
                <Text style={styles.modalCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  profileBanner: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    borderWidth: 2.5,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#15803D',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  menuScroll: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  menuIcon: {
    fontSize: 17,
    marginRight: 14,
  },
  menuTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuArrow: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 14,
    backgroundColor: '#FEF2F2',
  },
  logoutIcon: {
    fontSize: 17,
    marginRight: 14,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  footer: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 20,
  },
  modalCloseBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
