import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../src/store/authStore';
import { api } from '../../../src/services/api';

export default function SignupAvatarScreen() {
  const router = useRouter();
  const setAvatar = useAuthStore((s) => s.setAvatar);
  const signupFlow = useAuthStore((s) => s.signupFlow);

  const [selectedUri, setSelectedUri] = useState<string | null>(signupFlow.avatarUri);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(signupFlow.avatarUrl);

  const handlePickFromLibrary = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to select a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Image Selection Error', err.message || 'Unable to open photo library.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Unable to open camera.');
    }
  };

  const processAndUploadImage = async (uri: string) => {
    setSelectedUri(uri);
    setIsUploading(true);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('avatar', blob, 'profile_avatar.jpg');
      } else {
        formData.append('avatar', {
          uri,
          name: 'profile_avatar.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const uploadRes = await api.uploadAvatar(formData);
      if (uploadRes && uploadRes.avatarUrl) {
        setUploadedUrl(uploadRes.avatarUrl);
        setAvatar(uri, uploadRes.avatarUrl);
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload photo to server. You can still proceed or try another photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleChooseDefault = () => {
    setSelectedUri('/brand/safargo-symbol.svg');
    setUploadedUrl('/brand/safargo-symbol.svg');
    setAvatar('/brand/safargo-symbol.svg', '/brand/safargo-symbol.svg');
  };

  const handleSkip = () => {
    setAvatar('', '/brand/safargo-symbol.svg');
    router.push('/(auth)/signup/password');
  };

  const handleNext = () => {
    if (selectedUri) {
      setAvatar(selectedUri, uploadedUrl || selectedUri);
    }
    router.push('/(auth)/signup/password');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar with Step Indicator */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step 3 of 4</Text>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add a profile photo</Text>
          <Text style={styles.subtitle}>
            A profile photo helps your drivers and travelers recognize you in Peshawar.
          </Text>
        </View>

        {/* Avatar Display */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarRing}>
            {selectedUri && !selectedUri.includes('safargo-symbol') ? (
              <Image source={{ uri: selectedUri }} style={styles.avatarImage} />
            ) : selectedUri && selectedUri.includes('safargo-symbol') ? (
              <View style={styles.defaultAvatarWrap}>
                <Text style={styles.defaultAvatarText}>S</Text>
              </View>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>📷</Text>
              </View>
            )}
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
          </View>
          {uploadedUrl && !isUploading && (
            <View style={styles.successPill}>
              <Text style={styles.successPillText}>✓ Photo Uploaded</Text>
            </View>
          )}
        </View>

        {/* Photo Selection Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={handlePickFromLibrary}
            disabled={isUploading}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnPrimaryText}>📁 Choose from Photo Library</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={handleTakePhoto}
            disabled={isUploading}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnSecondaryText}>📸 Take a Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={handleChooseDefault}
            disabled={isUploading}
          >
            <Text style={styles.actionBtnOutlineText}>🖼️ Use Default Avatar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, isUploading && styles.submitButtonDisabled]}
            onPress={handleNext}
            disabled={isUploading}
            activeOpacity={0.88}
          >
            <Text style={styles.submitButtonText}>
              {selectedUri ? 'Continue with Photo' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    justifyContent: 'space-between',
    paddingBottom: 24,
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
    marginTop: 12,
    marginBottom: 20,
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
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  avatarRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#16A34A',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  defaultAvatarWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultAvatarText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successPill: {
    marginTop: 10,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successPillText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  actionsContainer: {
    gap: 10,
  },
  actionBtnPrimary: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimaryText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSecondaryText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnOutline: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutlineText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
