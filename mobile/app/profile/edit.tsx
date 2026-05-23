/**
 * 프로필 수정 화면
 *
 * 기능:
 *  - 닉네임 변경
 *  - 프로필 사진 변경 (갤러리 or 카메라 → R2 업로드 → URL 저장)
 *  - 저장 시 Zustand auth store 업데이트 + React Query 캐시 무효화
 */
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import { queryClient } from '@/lib/queries';
import { useAuthStore } from '@/store';

// ── 아바타 컴포넌트 (이니셜 원형) ─────────────────────────────────────────────

function AvatarCircle({
  initial,
  imageUri,
  size = 90,
}: {
  initial: string;
  imageUri?: string | null;
  size?: number;
}) {
  // expo-image는 이미 패키지에 있음
  if (imageUri) {
    const { Image } = require('expo-image');
    return (
      <Image
        source={{ uri: imageUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#E8ECF2',
        }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF5A5F',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '800' }}>{initial}</Text>
    </View>
  );
}

// ── 메인 화면 ──────────────────────────────────────────────────────────────────

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useSettings();
  const colors = useThemedColors();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  // CachedUser에는 profile_image_url 미포함 — 초기값 null (저장 후 반영)
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = (nickname || user?.nickname || 'T').charAt(0).toUpperCase();
  // CachedUser에는 profile_image_url 없음 → 이미지 변경 여부는 imageUri !== null 로 판단
  const hasChanges = nickname !== user?.nickname || imageUri !== null;

  // ── 사진 선택 ──────────────────────────────────────────────────────────────

  async function pickImage() {
    Alert.alert(
      lang === 'ko' ? '프로필 사진 변경' : 'Change Profile Photo',
      '',
      [
        {
          text: lang === 'ko' ? '갤러리에서 선택' : 'Choose from Gallery',
          onPress: () => openPicker('library'),
        },
        {
          text: lang === 'ko' ? '카메라로 촬영' : 'Take a Photo',
          onPress: () => openPicker('camera'),
        },
        {
          text: lang === 'ko' ? '사진 삭제' : 'Remove Photo',
          style: 'destructive',
          onPress: () => setImageUri(null),
        },
        { text: lang === 'ko' ? '취소' : 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function openPicker(source: 'library' | 'camera') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(lang === 'ko' ? '카메라 권한이 필요합니다.' : 'Camera permission required.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(lang === 'ko' ? '갤러리 권한이 필요합니다.' : 'Gallery permission required.');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const uploaded = await api.uploads.photo(result.assets[0].uri);
      setImageUri(uploaded.url);
    } catch {
      Toast.show({
        type: 'error',
        text1: lang === 'ko' ? '사진 업로드 실패' : 'Upload failed',
        visibilityTime: 2000,
      });
    } finally {
      setUploading(false);
    }
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!nickname.trim()) {
      Toast.show({ type: 'error', text1: lang === 'ko' ? '닉네임을 입력해주세요' : 'Nickname required', visibilityTime: 2000 });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.users.updateProfile({
        nickname: nickname.trim() !== user?.nickname ? nickname.trim() : undefined,
        profile_image_url: imageUri !== null ? imageUri : undefined,
      });

      // Zustand store + 로컬 캐시 갱신 (refreshUser가 /auth/me 다시 호출)
      await refreshUser().catch(() => {});

      // React Query 캐시 무효화
      await queryClient.invalidateQueries({ queryKey: ['userStats'] });
      await queryClient.invalidateQueries({ queryKey: ['gamification'] });

      Toast.show({ type: 'success', text1: lang === 'ko' ? '프로필이 저장되었습니다 ✓' : 'Profile saved ✓', visibilityTime: 1800 });
      router.back();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? (lang === 'ko' ? '저장 실패. 다시 시도해주세요.' : 'Save failed.');
      Toast.show({ type: 'error', text1: msg, visibilityTime: 2500 });
    } finally {
      setSaving(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 헤더 */}
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 26, color: colors.txPrimary, fontWeight: '300', lineHeight: 30 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
          {lang === 'ko' ? '프로필 수정' : 'Edit Profile'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || saving || uploading}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.brandPrimary} />
          ) : (
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: hasChanges && !uploading ? colors.brandPrimary : colors.txDisabled,
              }}
            >
              {lang === 'ko' ? '저장' : 'Save'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* 아바타 섹션 */}
        <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: colors.bgSurface, marginBottom: 12 }}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85}>
            <View>
              {uploading ? (
                <View
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: colors.bgStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={colors.brandPrimary} />
                </View>
              ) : (
                <AvatarCircle initial={initial} imageUri={imageUri} />
              )}
              {/* 카메라 배지 */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.brandPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.bgSurface,
                }}
              >
                <Text style={{ fontSize: 13 }}>📷</Text>
              </View>
            </View>
          </TouchableOpacity>
          <Text style={{ marginTop: 10, fontSize: 12, color: colors.txTertiary }}>
            {lang === 'ko' ? '탭하여 사진 변경' : 'Tap to change photo'}
          </Text>
        </View>

        {/* 닉네임 입력 */}
        <View style={{ backgroundColor: colors.bgSurface }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.txTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              {lang === 'ko' ? '닉네임' : 'Nickname'}
            </Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
              placeholder={lang === 'ko' ? '닉네임 입력' : 'Enter nickname'}
              placeholderTextColor={colors.txDisabled}
              returnKeyType="done"
              style={{
                fontSize: 16,
                color: colors.txPrimary,
                paddingVertical: 10,
                borderBottomWidth: 1.5,
                borderBottomColor: nickname !== user?.nickname ? colors.brandPrimary : colors.lineStrong,
              }}
            />
            <Text style={{ fontSize: 11, color: colors.txTertiary, textAlign: 'right', marginTop: 4 }}>
              {nickname.length}/20
            </Text>
          </View>
        </View>

        {/* 이메일 (읽기 전용) */}
        <View style={{ backgroundColor: colors.bgSurface, marginTop: 2, paddingHorizontal: 20, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.lineDefault }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.txTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            {lang === 'ko' ? '이메일 (변경 불가)' : 'Email (read-only)'}
          </Text>
          <Text style={{ fontSize: 15, color: colors.txSecondary }}>{user?.email ?? '—'}</Text>
        </View>

        {/* 저장 버튼 */}
        <View style={{ marginHorizontal: 20, marginTop: 28 }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || saving || uploading}
            activeOpacity={0.85}
            style={{
              backgroundColor: hasChanges && !saving && !uploading ? colors.brandPrimary : colors.bgStrong,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: hasChanges && !uploading ? '#FFFFFF' : colors.txDisabled,
                }}
              >
                {lang === 'ko' ? '저장하기' : 'Save Changes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
