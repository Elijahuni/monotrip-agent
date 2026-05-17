/**
 * LiveFeedCard — 실시간 마이크로피드 카드.
 * 게시 시각으로부터 경과 시간 + 만료까지 남은 시간을 표시.
 * post_type === "live" 전용.
 */
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemedColors } from '@/lib/design-tokens';
import type { CommunityPost } from '@/lib/types';

interface Props {
  post: CommunityPost;
  onLike?: () => Promise<void>;
  onReport?: () => void;
}

function formatElapsed(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

function formatCountdown(isoExpires: string): { label: string; urgent: boolean } {
  const remaining = Math.floor((new Date(isoExpires).getTime() - Date.now()) / 1000);
  if (remaining <= 0) return { label: '만료됨', urgent: true };
  if (remaining < 1800) return { label: `${Math.floor(remaining / 60)}분 후 만료`, urgent: true };
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return { label: `${h}h ${m}m 남음`, urgent: false };
}

export function LiveFeedCard({ post, onLike, onReport }: Props) {
  const colors = useThemedColors();
  const [elapsed, setElapsed] = useState(() => formatElapsed(post.created_at));
  const [countdown, setCountdown] = useState(() =>
    post.expires_at ? formatCountdown(post.expires_at) : null,
  );

  // 1분마다 경과 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatElapsed(post.created_at));
      if (post.expires_at) setCountdown(formatCountdown(post.expires_at));
    }, 60_000);
    return () => clearInterval(timer);
  }, [post.created_at, post.expires_at]);

  const cityLabel = post.city ? `📍 ${post.city}` : '📍 전체';

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.bgSurface,
        borderWidth: 1.5,
        borderColor: '#FF6B35',
        marginBottom: 10,
      }}>
      {/* 상단 배지 행 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {/* LIVE 배지 */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#FF3B30', borderRadius: 6,
            paddingHorizontal: 7, paddingVertical: 3,
          }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>
            LIVE
          </Text>
        </View>

        {/* 도시 배지 */}
        <View
          style={{
            backgroundColor: '#FF6B3515', borderRadius: 6,
            paddingHorizontal: 7, paddingVertical: 3,
          }}>
          <Text style={{ color: '#FF6B35', fontSize: 10, fontWeight: '700' }}>{cityLabel}</Text>
        </View>

        {/* 카테고리 */}
        <Text style={{ fontSize: 10, color: colors.txTertiary, flex: 1 }}>
          {categoryLabel(post.category)}
        </Text>

        {/* 신고 버튼 */}
        {onReport && (
          <TouchableOpacity onPress={onReport} hitSlop={8}>
            <Text style={{ fontSize: 14, color: colors.txTertiary }}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 본문 */}
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.txPrimary }}>
        {post.title}
      </Text>
      <Text
        style={{ fontSize: 13, color: colors.txSecondary, marginTop: 4, lineHeight: 19 }}
        numberOfLines={3}>
        {post.body}
      </Text>

      {/* 하단 메타 행 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
        {/* 좋아요 */}
        {onLike && (
          <TouchableOpacity onPress={onLike} hitSlop={6}>
            <Text style={{ fontSize: 12, color: colors.txTertiary, fontWeight: '700' }}>
              🤍 {post.like_count}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 12, color: colors.txTertiary }}>
          💬 {post.comment_count}
        </Text>

        {/* 경과 시간 */}
        <Text style={{ fontSize: 11, color: colors.txTertiary, flex: 1 }}>{elapsed}</Text>

        {/* 만료 카운트다운 */}
        {countdown && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: countdown.urgent ? '#FF3B30' : colors.txTertiary,
            }}>
            {countdown.label}
          </Text>
        )}
      </View>
    </View>
  );
}

function categoryLabel(c: string): string {
  return c === 'qna' ? '질문' : c === 'review' ? '후기' : c === 'photospot' ? '포토스팟' : c;
}
