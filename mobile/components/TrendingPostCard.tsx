/**
 * TrendingPostCard — 홈 "인기 여행기" 섹션 카드
 *
 * 구조:
 *  - 유저 아바타(이니셜 원형) + 닉네임 + 카테고리 pill
 *  - PostPhotoGrid (이미지 수별 분기)
 *  - 본문 2줄 미리보기 + 좋아요·댓글 수
 */
import { PostPhotoGrid } from '@/components/PostPhotoGrid';
import { useThemedColors } from '@/lib/design-tokens';
import type { TrendingPost } from '@/lib/types';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  post: TrendingPost;
  onPress?: () => void;
}

const CATEGORY_ICON: Record<string, string> = {
  qna: '💬',
  review: '⭐',
  photospot: '📸',
};

export function TrendingPostCard({ post, onPress }: Props) {
  const colors = useThemedColors();

  const initials = post.nickname.slice(0, 2).toUpperCase();
  const categoryIcon = CATEGORY_ICON[post.category] ?? '📝';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.lineDefault }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* 헤더: 아바타 + 닉네임 + 카테고리 */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.brandPrimary + '30' }]}>
          <Text style={[styles.avatarText, { color: colors.brandPrimary }]}>{initials}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={[styles.nickname, { color: colors.txPrimary }]} numberOfLines={1}>
            {post.nickname}
          </Text>
          {post.city && (
            <Text style={[styles.city, { color: colors.txTertiary }]} numberOfLines={1}>
              {post.city}
            </Text>
          )}
        </View>
        <View style={[styles.categoryPill, { backgroundColor: colors.bgBase }]}>
          <Text style={[styles.categoryText, { color: colors.txSecondary }]}>
            {categoryIcon} {post.category}
          </Text>
        </View>
      </View>

      {/* 제목 */}
      <Text style={[styles.title, { color: colors.txPrimary }]} numberOfLines={2}>
        {post.title}
      </Text>

      {/* 포토그리드 */}
      {post.images && post.images.length > 0 && (
        <View style={styles.grid}>
          <PostPhotoGrid images={post.images} />
        </View>
      )}

      {/* 본문 미리보기 */}
      <Text style={[styles.body, { color: colors.txSecondary }]} numberOfLines={2}>
        {post.body}
      </Text>

      {/* 좋아요·댓글 */}
      <View style={styles.footer}>
        <Text style={[styles.stat, { color: colors.txTertiary }]}>
          ♥ {post.like_count}
        </Text>
        <Text style={[styles.stat, { color: colors.txTertiary }]}>
          💬 {post.comment_count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    flex: 1,
  },
  nickname: {
    fontSize: 13,
    fontWeight: '600',
  },
  city: {
    fontSize: 11,
    marginTop: 1,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  grid: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  stat: {
    fontSize: 12,
  },
});
