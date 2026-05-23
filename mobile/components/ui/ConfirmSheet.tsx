/**
 * ConfirmSheet — BottomSheet 기반 확인 다이얼로그.
 * 네이티브 Alert 대신 앱 디자인에 맞는 확인/취소 모달.
 */
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { notifyWarning, tapMedium } from '@/lib/haptics';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 파괴적(삭제 등) 액션이면 확인 버튼을 빨강으로 */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const colors = useThemedColors();
  const confirmColor = destructive ? '#E74C3C' : palette.coral500;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={message} dismissible={!loading}>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <TouchableOpacity
          onPress={onClose}
          disabled={loading}
          activeOpacity={0.8}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: colors.bgStrong,
          }}
        >
          <Text style={{ color: colors.txSecondary, fontWeight: '700', fontSize: 15 }}>
            {cancelLabel ?? '취소'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (destructive) notifyWarning();
            else tapMedium();
            onConfirm();
          }}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: confirmColor,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              {confirmLabel ?? '확인'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}
