import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

export default function SignupOtpScreen() {
  const router = useRouter();
  const signupFlow = useAuthStore((s) => s.signupFlow);
  const setVerificationToken = useAuthStore((s) => s.setVerificationToken);

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(signupFlow.cooldownSeconds || 60);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleDigitChange = (val: string, index: number) => {
    const cleaned = val.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 1) {
      // Paste detected
      const chars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setOtpDigits(newDigits);
      if (chars.length === 6) {
        verifyCode(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (code: string) => {
    setApiError(null);
    setIsLoading(true);

    try {
      const response = await api.verifyOtp({
        email: signupFlow.email,
        otp: code,
      });

      setVerificationToken(response.verificationToken);
      router.push('/(auth)/signup/avatar');
    } catch (err: any) {
      setApiError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setApiError(null);
    setIsResending(true);

    try {
      const response = await api.resendOtp({ email: signupFlow.email });
      setCooldown(response.cooldownSeconds || 60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setApiError(err.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Top Bar with Step Indicator */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step 2 of 4</Text>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to{' '}
            <Text style={styles.emailHighlight}>{signupFlow.emailMasked || signupFlow.email}</Text>
          </Text>
        </View>

        {/* Error Banner */}
        {apiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        )}

        {/* 6 Digit Cells */}
        <View style={styles.otpRow}>
          {otpDigits.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              style={[styles.otpCell, digit ? styles.otpCellFilled : null]}
              keyboardType="number-pad"
              maxLength={6}
              value={digit}
              onChangeText={(text) => handleDigitChange(text, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {/* Verify Action Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={() => verifyCode(otpDigits.join(''))}
          disabled={isLoading || otpDigits.join('').length !== 6}
          activeOpacity={0.88}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        {/* Resend Action */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || isResending}>
            <Text style={[styles.resendLink, cooldown > 0 && styles.resendLinkDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
            </Text>
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
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#16A34A',
  },
  stepBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  stepBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    marginVertical: 24,
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
  emailHighlight: {
    color: '#0F172A',
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  otpCellFilled: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
    color: '#15803D',
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#64748B',
  },
  resendLink: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: '#94A3B8',
  },
});
