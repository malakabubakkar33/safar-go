/**
 * SafarGo Customer Mobile - Forgot & Reset Password Flow
 * Complete 3-step recovery lifecycle:
 * 1. Email entry & reset code request
 * 2. 6-digit cryptographic OTP verification
 * 3. New password creation with strength validation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';

type Step = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('EMAIL');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Resend Cooldown Timer
  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && cooldownSeconds > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (cooldownSeconds === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, cooldownSeconds]);

  // Step 1: Send Reset Code
  const handleRequestReset = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.forgotPassword(clean);
      setMaskedEmail(res.emailMasked || clean);
      setCooldownSeconds(60);
      setStep('OTP');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Reset Code
  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.verifyResetOtp(email.trim().toLowerCase(), cleanOtp);
      setResetToken(res.resetToken);
      setStep('NEW_PASSWORD');
    } catch (err: any) {
      setError(err.message || 'Incorrect verification code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Reset Code
  const handleResend = async () => {
    if (!canResend) return;
    setError(null);
    setIsLoading(true);

    try {
      await api.forgotPassword(email.trim().toLowerCase());
      setCooldownSeconds(60);
      setCanResend(false);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to resend reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleSetNewPassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await api.resetPassword({
        resetToken,
        newPassword,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => (step === 'EMAIL' ? router.back() : setStep('EMAIL'))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>Password Recovery</Text>
            </View>
          </View>

          {/* Heading */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'EMAIL' && 'Reset your password'}
              {step === 'OTP' && 'Enter verification code'}
              {step === 'NEW_PASSWORD' && 'Create new password'}
              {step === 'SUCCESS' && 'Password updated!'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'EMAIL' && 'Enter your registered email address to receive a secure 6-digit recovery code.'}
              {step === 'OTP' && `We sent a 6-digit recovery code to ${maskedEmail || email}.`}
              {step === 'NEW_PASSWORD' && 'Your identity has been verified. Enter a strong new password.'}
              {step === 'SUCCESS' && 'Your password has been reset successfully. You can now log in.'}
            </Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerIcon}>⚠️</Text>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* STEP 1: Email Input */}
          {step === 'EMAIL' && (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Registered Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (error) setError(null);
                  }}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleRequestReset}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Send Recovery Code</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 'OTP' && (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>6-Digit Recovery Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(val) => {
                    setOtp(val);
                    if (error) setError(null);
                  }}
                  autoFocus
                />
              </View>

              <View style={styles.resendRow}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendLink}>Resend Code</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.resendTimer}>Resend code in {cooldownSeconds}s</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Verify Code</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: New Password Creation */}
          {step === 'NEW_PASSWORD' && (
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>New Password</Text>
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    if (error) setError(null);
                  }}
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (error) setError(null);
                  }}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleSetNewPassword}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4: Success Confirmation */}
          {step === 'SUCCESS' && (
            <View style={styles.successCard}>
              <View style={styles.successCircle}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Password Changed!</Text>
              <Text style={styles.successMessage}>
                Your password has been successfully updated. You may now sign in using your new credentials.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.88}
              >
                <Text style={styles.submitButtonText}>Sign In Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16A34A',
  },
  badgeWrap: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  header: {
    marginVertical: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorBannerIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
  },
  resendRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  resendTimer: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    padding: 28,
    marginTop: 10,
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
