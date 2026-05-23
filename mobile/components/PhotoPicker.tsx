/**
 * 사진 업로드 컴포넌트.
 * - 갤러리/카메라 선택 시트
 * - expo-image-manipulator로 800px 압축
 * - 백엔드 /uploads/photo로 업로드
 * - 썸네일 그리드 + 삭제 버튼
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Text, TouchableOpacity, View } from 'react-native';

import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';

interface Props {
  /** 현재 등록된 이미지 URL 목록 */
  urls: string[];
  /** 변경된 전체 URL 목록을 호출 */
  onChange: (urls: string[]) => void;
  /** 최대 사진 수 (기본 5) */
  max?: number;
  isDark?: boolean;
  lang?: string;
}

export function PhotoPicker({ urls, onChange, max = 5, isDark = false, lang = 'ko' }: Props) {
  const [uploading, setUploading] = useState(false);
  const colors = useThemedColors();

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(lang === 'ko' ? '권한 필요' : 'Permission required', lang === 'ko' ? '갤러리 접근 권한이 필요합니다.' : 'Gallery permission required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: max - urls.length,
    });
    if (!res.canceled && res.assets.length > 0) {
      await uploadAssets(res.assets);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(lang === 'ko' ? '권한 필요' : 'Permission required', lang === 'ko' ? '카메라 권한이 필요합니다.' : 'Camera permission required.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled && res.assets.length > 0) {
      await uploadAssets(res.assets);
    }
  }

  async function uploadAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const asset of assets) {
        // 800px 압축
        const result = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        const { url } = await api.uploads.photo(result.uri);
        uploaded.push(url);
      }
      onChange([...urls, ...uploaded]);
    } catch (e) {
      console.warn('upload failed', e);
      Alert.alert(
        lang === 'ko' ? '업로드 실패' : 'Upload failed',
        lang === 'ko' ? '사진 업로드 중 오류가 발생했습니다.' : 'Failed to upload photo.',
      );
    } finally {
      setUploading(false);
    }
  }

  function showPicker() {
    if (urls.length >= max) {
      Alert.alert(lang === 'ko' ? '최대 ' + max + '장' : `Max ${max} photos`);
      return;
    }
    const galleryLabel = lang === 'ko' ? '갤러리에서 선택' : 'Choose from Gallery';
    const cameraLabel  = lang === 'ko' ? '카메라로 촬영' : 'Take Photo';
    const cancelLabel  = lang === 'ko' ? '취소' : 'Cancel';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [cancelLabel, galleryLabel, cameraLabel], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) pickFromGallery();
          else if (idx === 2) pickFromCamera();
        },
      );
    } else {
      Alert.alert(
        lang === 'ko' ? '사진 추가' : 'Add Photo', '',
        [
          { text: galleryLabel, onPress: pickFromGallery },
          { text: cameraLabel, onPress: pickFromCamera },
          { text: cancelLabel, style: 'cancel' },
        ],
      );
    }
  }

  function removeAt(idx: number) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {urls.map((u, i) => (
          <View key={u + i} style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
            <TouchableOpacity
              onPress={() => removeAt(i)}
              style={{
                position: 'absolute', top: 2, right: 2,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: 'rgba(0,0,0,0.6)',
                justifyContent: 'center', alignItems: 'center',
              }}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {urls.length < max && (
          <TouchableOpacity
            onPress={showPicker}
            disabled={uploading}
            style={{
              width: 72, height: 72, borderRadius: 12,
              borderWidth: 1.5, borderColor: colors.lineDefault, borderStyle: 'dashed',
              backgroundColor: colors.bgSubtle,
              justifyContent: 'center', alignItems: 'center',
              opacity: uploading ? 0.5 : 1,
            }}>
            {uploading ? (
              <ActivityIndicator color={palette.coral500} size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={22} color={palette.coral500} />
                <Text style={{ color: colors.txSecondary, fontSize: 10, marginTop: 2 }}>{urls.length}/{max}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
