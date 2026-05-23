/**
 * PostPhotoGrid — 커뮤니티·인기 여행기 공용 이미지 그리드
 *
 * 이미지 수에 따른 레이아웃:
 *   0개 → 렌더링 없음
 *   1개 → 전체 너비 단일 이미지 (height 180)
 *   2개 → 좌·우 50:50 분할
 *   3개+ → 좌 대형 + 우 상·하 2분할 (트리플 스타일)
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

interface Props {
  images: string[];
}

const RADIUS = 8;
const HEIGHT = 180;

export function PostPhotoGrid({ images }: Props) {
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <Image
        source={{ uri: images[0] }}
        style={styles.single}
        contentFit="cover"
        transition={200}
      />
    );
  }

  if (images.length === 2) {
    return (
      <View style={styles.row}>
        <Image source={{ uri: images[0] }} style={[styles.half, { borderRadius: 0, borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS }]} contentFit="cover" transition={200} />
        <View style={styles.divider} />
        <Image source={{ uri: images[1] }} style={[styles.half, { borderRadius: 0, borderTopRightRadius: RADIUS, borderBottomRightRadius: RADIUS }]} contentFit="cover" transition={200} />
      </View>
    );
  }

  // 3개 이상 — 좌 대형 + 우 2분할
  return (
    <View style={styles.row}>
      <Image
        source={{ uri: images[0] }}
        style={[styles.left, { borderTopLeftRadius: RADIUS, borderBottomLeftRadius: RADIUS }]}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.divider} />
      <View style={styles.rightCol}>
        <Image
          source={{ uri: images[1] }}
          style={[styles.rightTop, { borderTopRightRadius: RADIUS }]}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.hDivider} />
        <Image
          source={{ uri: images[2] }}
          style={[styles.rightBottom, { borderBottomRightRadius: RADIUS }]}
          contentFit="cover"
          transition={200}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: {
    width: '100%',
    height: HEIGHT,
    borderRadius: RADIUS,
  },
  row: {
    flexDirection: 'row',
    height: HEIGHT,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    height: HEIGHT,
  },
  divider: {
    width: 2,
    backgroundColor: 'transparent',
  },
  hDivider: {
    height: 2,
    backgroundColor: 'transparent',
  },
  left: {
    flex: 2,
    height: HEIGHT,
  },
  rightCol: {
    flex: 1,
    height: HEIGHT,
  },
  rightTop: {
    flex: 1,
  },
  rightBottom: {
    flex: 1,
  },
});
