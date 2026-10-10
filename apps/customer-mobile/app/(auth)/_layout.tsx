import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="role-select" />
      <Stack.Screen name="signup/step1" />
      <Stack.Screen name="signup/otp" />
      <Stack.Screen name="signup/avatar" />
      <Stack.Screen name="signup/password" />
      <Stack.Screen name="signup/success" />
    </Stack>
  );
}
