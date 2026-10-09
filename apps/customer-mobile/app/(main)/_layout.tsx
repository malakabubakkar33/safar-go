/**
 * SafarGo Customer Mobile - Main App Stack Navigation Layout
 */

import React from 'react';
import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="home" options={{ animation: 'fade' }} />
      <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="route-preview" />
      <Stack.Screen name="vehicle-select" />
      <Stack.Screen name="finding-drivers" options={{ gestureEnabled: false }} />
      <Stack.Screen name="deal-chat" />
      <Stack.Screen name="booking-confirm" />
      <Stack.Screen name="live-ride" options={{ gestureEnabled: false }} />
      <Stack.Screen name="ride-complete" options={{ gestureEnabled: false }} />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
