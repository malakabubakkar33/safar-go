import React, { useState } from 'react';
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccountInput } from '@safargo/shared';
import { api } from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/authStore';

export default function SignupPasswordScreen() {
  const router = useRouter();
  const signupFlow = useAuthStore((s) => s.signupFlow);
  const setAuthSuccess = useAuthStore((s) => s.setAuthSuccess);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema as any),
    defaultValues: {
      verificationToken: signupFlow.verificationToken || '',
      password: '',
      confirmPassword: '',
      avatarUrl: signupFlow.avatarUrl || '/brand/safargo-symbol.svg',
    },
  });

  const pwdValue = watch('password') || '';

  // Password Strength Calculations
  const hasLength = pwdValue.length >= 8;
  const hasUpper = /[A-Z]/.test(pwdValue);
  const hasLower = /[a-z]/.test(pwdValue);
  const hasNumber = /[0-9]/.test(pwdValue);
  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

  const onSubmit = async (data: CreateAccountInput) => {
    setApiError(null);
    setIsLoading(true);

    try {
      const response = await api.createAccount({
        verificationToken: signupFlow.verificationToken || data.verificationToken,
        password: data.password,
        confirmPassword: data.confirmPassword,
        avatarUrl: signupFlow.avatarUrl || '/brand/safargo-symbol.svg',
      });

      setAuthSuccess(response.user, response.tokens);
      router.replace('/(auth)/signup/success');
    } catch (err: any) {
      setApiError(err.message || 'Failed to create your account.');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Bar with Step Indicator */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>Step 4 of 4</Text>
            </View>
          </View>

          {/* Heading */}
          <View style={styles.header}>
            <Text style={styles.title}>Secure your account</Text>
            <Text style={styles.subtitle}>Create a strong password to protect your SafarGo account</Text>
          </View>

          {/* Error Banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{apiError}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.password && styles.inputError]}
                    placeholder="Create a strong password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}
            </View>

            {/* Strength Meter (4 bars) */}
            <View style={styles.meterContainer}>
              <View style={styles.meterBarsRow}>
                {[1, 2, 3, 4].map((step) => {
                  let barColor = '#E2E8F0';
                  if (step <= strengthScore) {
                    if (strengthScore <= 2) barColor = '#EF4444';
                    else if (strengthScore === 3) barColor = '#F59E0B';
                    else barColor = '#16A34A';
                  }
                  return <View key={step} style={[styles.meterBar, { backgroundColor: barColor }]} />;
                })}
              </View>

              {/* Requirement Checklist */}
              <View style={styles.rulesList}>
                <Text style={[styles.ruleItem, hasLength && styles.ruleItemValid]}>
                  {hasLength ? '✓' : '•'} At least 8 characters
                </Text>
                <Text style={[styles.ruleItem, hasUpper && styles.ruleItemValid]}>
                  {hasUpper ? '✓' : '•'} At least 1 uppercase letter
                </Text>
                <Text style={[styles.ruleItem, hasLower && styles.ruleItemValid]}>
                  {hasLower ? '✓' : '•'} At least 1 lowercase letter
                </Text>
                <Text style={[styles.ruleItem, hasNumber && styles.ruleItemValid]}>
                  {hasNumber ? '✓' : '•'} At least 1 number
                </Text>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Confirm Password</Text>
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Text style={styles.toggleText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.confirmPassword && styles.inputError]}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (isLoading || strengthScore < 4) && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading || strengthScore < 4}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
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
    marginVertical: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
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
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  toggleText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  meterContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  meterBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  meterBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  rulesList: {
    gap: 4,
  },
  ruleItem: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  ruleItemValid: {
    color: '#16A34A',
    fontWeight: '700',
  },
  submitButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
});
