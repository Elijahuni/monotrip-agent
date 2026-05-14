import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** 닫기 가능 여부 (loading 중일 때 false로) */
  dismissible?: boolean;
  /** 화면 최대 비율 (기본 85%) */
  maxHeightRatio?: number;
  children: React.ReactNode;
}

/**
 * 공통 바텀시트.
 * - 검은 오버레이 터치 시 닫힘 (dismissible=true일 때만)
 * - 상단 핸들바 + 옵션 제목/부제목
 * - 안전 영역 패딩 처리됨
 * - 내부 콘텐츠는 ScrollView로 감싸짐
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  dismissible = true,
  maxHeightRatio = 0.85,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  function handleOverlayPress() {
    if (dismissible) onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleOverlayPress}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={handleOverlayPress}>
        <ScrollView
          onStartShouldSetResponder={() => true}
          keyboardShouldPersistTaps="handled"
          className="bg-bg-base rounded-t-3xl"
          style={{ maxHeight: `${maxHeightRatio * 100}%` }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}>
          {/* 핸들 */}
          <View className="w-10 h-1 bg-line-strong rounded-full self-center mb-5" />

          {title ? (
            <Text className="text-lg font-bold text-tx-primary mb-1">{title}</Text>
          ) : null}
          {subtitle ? (
            <Text className="text-sm text-tx-tertiary mb-4">{subtitle}</Text>
          ) : null}

          {children}
        </ScrollView>
      </TouchableOpacity>
    </Modal>
  );
}
