/**
 * SafarGo Customer Mobile - Real-time Fare Negotiation & Deal Chat Screen
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRideStore, ChatMessage } from '../../src/store/rideStore';
import { socketService } from '../../src/services/socket';
import { api } from '../../src/services/api';

export default function DealChatScreen() {
  const router = useRouter();

  const activeRide = useRideStore((s) => s.activeRide);
  const selectedOffer = useRideStore((s) => s.selectedOffer);
  const messages = useRideStore((s) => s.messages);
  const addMessage = useRideStore((s) => s.addMessage);
  const setMessages = useRideStore((s) => s.setMessages);
  const setActiveRide = useRideStore((s) => s.setActiveRide);

  const [inputMsg, setInputMsg] = useState('');
  const [customCounter, setCustomCounter] = useState('');
  const [acceptingFare, setAcceptingFare] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const currentFare = activeRide?.currentOfferedFare || selectedOffer?.offeredFare || 250;

  // 1. Fetch historical messages for this ride
  useEffect(() => {
    if (!activeRide?.id) return;

    api.getRideMessages(activeRide.id)
      .then((res) => {
        if (res.messages) {
          setMessages(res.messages);
        }
      })
      .catch(() => {});
  }, [activeRide?.id]);

  const handleSendMessage = () => {
    if (!inputMsg.trim() || !activeRide?.id) return;

    const content = inputMsg.trim();
    setInputMsg('');

    // Emit via Socket
    socketService.sendChatMessage(activeRide.id, content, 'TEXT');

    // Also persist via API
    api.sendRideMessage(activeRide.id, content, 'TEXT').catch(() => {});
  };

  const handleSendCounterOffer = async (amount: number) => {
    if (!activeRide?.id) return;

    try {
      const res = await api.sendCounterOffer(activeRide.id, amount);
      if (res.success && res.ride) {
        setActiveRide(res.ride);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit counter offer.');
    }
  };

  const handleAcceptFare = async () => {
    if (!activeRide?.id) return;

    setAcceptingFare(true);
    try {
      const res = await api.acceptFare(activeRide.id, currentFare);
      if (res.success) {
        setActiveRide(res.ride);
        router.push('/(main)/booking-confirm');
      } else {
        throw new Error('Could not accept fare');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept fare.');
    } finally {
      setAcceptingFare(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Driver Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.driverSummary}>
            <View style={styles.driverAvatar}>
              <Text style={styles.avatarEmoji}>
                {activeRide?.vehicleType === 'BIKE' ? '🏍️' : '🚗'}
              </Text>
            </View>
            <View>
              <Text style={styles.driverName}>
                {activeRide?.driverName || selectedOffer?.driverName || 'Driver'}
              </Text>
              <Text style={styles.driverStatusText}>
                {activeRide?.driverVehicle || selectedOffer?.vehicleInfo || 'Active Negotiator'}
              </Text>
            </View>
          </View>

          <View style={styles.currentFareBadge}>
            <Text style={styles.currentFareLabel}>Current</Text>
            <Text style={styles.currentFareValue}>PKR {currentFare}</Text>
          </View>
        </View>

        {/* Real-time Message Stream */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.senderRole === 'CUSTOMER';
            const isSystem = item.type === 'SYSTEM' || item.type === 'AGREED';

            if (isSystem) {
              return (
                <View style={styles.systemMessageWrap}>
                  <Text style={styles.systemMessageText}>{item.content}</Text>
                </View>
              );
            }

            if (item.type === 'COUNTER_OFFER') {
              return (
                <View style={[styles.offerMsgCard, isMe ? styles.myOfferCard : styles.theirOfferCard]}>
                  <Text style={styles.offerMsgTitle}>
                    {isMe ? 'Your Counter Offer' : `${item.senderName}'s Counter Offer`}
                  </Text>
                  <Text style={styles.offerMsgAmount}>PKR {item.amount}</Text>
                </View>
              );
            }

            return (
              <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                  {item.content}
                </Text>
              </View>
            );
          }}
        />

        {/* Counter Offer Quick Actions */}
        <View style={styles.quickCounterRow}>
          <Text style={styles.quickCounterLabel}>Counter Offer:</Text>
          <TouchableOpacity
            style={styles.quickCounterPill}
            onPress={() => handleSendCounterOffer(Math.max(50, currentFare - 20))}
            activeOpacity={0.7}
          >
            <Text style={styles.quickCounterText}>- PKR 20</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickCounterPill}
            onPress={() => handleSendCounterOffer(currentFare + 20)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickCounterText}>+ PKR 20</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickCounterPill, { backgroundColor: '#DCFCE7' }]}
            onPress={() => handleSendCounterOffer(Math.round(currentFare * 0.9))}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickCounterText, { color: '#15803D' }]}>-10%</Text>
          </TouchableOpacity>
        </View>

        {/* Main Accept Fare CTA Button */}
        <View style={styles.acceptActionWrap}>
          <TouchableOpacity
            style={styles.acceptFareBtn}
            onPress={handleAcceptFare}
            disabled={acceptingFare}
            activeOpacity={0.88}
          >
            {acceptingFare ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptFareBtnText}>Accept Fare: PKR {currentFare} →</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Text Input Footer */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="Type a message to driver..."
            placeholderTextColor="#94A3B8"
            value={inputMsg}
            onChangeText={setInputMsg}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputMsg.trim() && styles.sendBtnDisabled]}
            onPress={handleSendMessage}
            disabled={!inputMsg.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
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
    marginRight: 12,
  },
  backArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  driverSummary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverStatusText: {
    fontSize: 11,
    color: '#64748B',
  },
  currentFareBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  currentFareLabel: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
  },
  currentFareValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#16A34A',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  systemMessageWrap: {
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginVertical: 4,
  },
  systemMessageText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  offerMsgCard: {
    padding: 14,
    borderRadius: 18,
    marginVertical: 4,
    maxWidth: '75%',
  },
  myOfferCard: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  theirOfferCard: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  offerMsgTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  offerMsgAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#16A34A',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  myMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  theirMessageText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  quickCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  quickCounterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  quickCounterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  quickCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  acceptActionWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  acceptFareBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptFareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
