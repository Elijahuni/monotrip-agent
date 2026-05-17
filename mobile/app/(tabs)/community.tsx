/**
 * Phase 3: 커뮤니티 피드 탭.
 * - 도시·카테고리 필터
 * - "지금 ◯◯" LIVE 탭 (5분 자동 새로고침)
 * - 새 글 작성 모달 (regular / live 선택)
 * - 좋아요·신고
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { LiveFeedCard } from '@/components/LiveFeedCard';
import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import type { CommunityPost } from '@/lib/types';

const CITIES = [
  { key: '', label: '전체' },
  { key: 'tokyo', label: '도쿄' },
  { key: 'osaka', label: '오사카' },
  { key: 'kyoto', label: '교토' },
  { key: 'seoul', label: '서울' },
  { key: 'busan', label: '부산' },
  { key: 'jeju', label: '제주' },
];

const CATEGORIES = [
  { key: '', label: '전체', emoji: '✨' },
  { key: 'qna', label: '질문', emoji: '❓' },
  { key: 'review', label: '후기', emoji: '⭐' },
  { key: 'photospot', label: '포토스팟', emoji: '📷' },
] as const;

type FeedTab = 'all' | 'live';

const LIVE_REFRESH_MS = 5 * 60 * 1000; // 5분

export default function CommunityTab() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const [feedTab, setFeedTab] = useState<FeedTab>('all');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<'' | 'qna' | 'review' | 'photospot'>('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [livePosts, setLivePosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.community.feed({
        city: city || undefined,
        category: category || undefined,
        limit: 30,
      });
      setPosts(data);
    } catch (e) {
      console.warn('[community] feed failed', e);
    } finally {
      setLoading(false);
    }
  }, [city, category]);

  const loadLive = useCallback(async () => {
    try {
      const data = await api.community.liveFeed({
        city: city || undefined,
        limit: 30,
      });
      setLivePosts(data);
    } catch (e) {
      console.warn('[community] liveFeed failed', e);
    }
  }, [city]);

  // 탭 전환 시 초기 로드
  useEffect(() => {
    if (feedTab === 'live') {
      setLoading(true);
      loadLive().finally(() => setLoading(false));
    } else {
      loadAll();
    }
  }, [feedTab, loadAll, loadLive]);

  // LIVE 탭: 5분 자동 새로고침
  useEffect(() => {
    if (feedTab === 'live') {
      liveTimerRef.current = setInterval(loadLive, LIVE_REFRESH_MS);
    }
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [feedTab, loadLive]);

  useFocusEffect(
    useCallback(() => {
      if (feedTab === 'all') loadAll();
      else loadLive();
    }, [feedTab, loadAll, loadLive]),
  );

  const currentPosts = feedTab === 'live' ? livePosts : posts;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: colors.txPrimary }}>
          커뮤니티
        </Text>
        <TouchableOpacity
          onPress={() => setComposing(true)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: colors.brandPrimary,
          }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ 글쓰기</Text>
        </TouchableOpacity>
      </View>

      {/* 피드 탭 (전체 / 지금 ◯◯ LIVE) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 }}>
        <TouchableOpacity
          onPress={() => setFeedTab('all')}
          style={{
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
            backgroundColor: feedTab === 'all' ? colors.txPrimary : colors.bgSurface,
            borderWidth: 1, borderColor: feedTab === 'all' ? colors.txPrimary : colors.lineDefault,
          }}>
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: feedTab === 'all' ? colors.bgBase : colors.txSecondary,
          }}>
            전체 피드
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFeedTab('live')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: feedTab === 'live' ? '#FF3B30' : colors.bgSurface,
            borderWidth: 1, borderColor: feedTab === 'live' ? '#FF3B30' : colors.lineDefault,
          }}>
          {feedTab === 'live' && (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
          )}
          <Text style={{
            fontSize: 13, fontWeight: '700',
            color: feedTab === 'live' ? '#FFFFFF' : colors.txSecondary,
          }}>
            지금 {city ? `${cityDisplayName(city)} ` : ''}LIVE
          </Text>
        </TouchableOpacity>
      </View>

      {/* 도시 필터 */}
      <View style={{ flexShrink: 0 }}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}>
          {CITIES.map((c) => {
            const active = c.key === city;
            return (
              <TouchableOpacity
                key={c.key || 'all'}
                onPress={() => setCity(c.key)}
                style={{
                  flexShrink: 0,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 999, borderWidth: 1,
                  backgroundColor: active ? colors.txPrimary : colors.bgSurface,
                  borderColor: active ? colors.txPrimary : colors.lineDefault,
                }}>
                <Text
                  allowFontScaling={false}
                  style={{ fontSize: 12, fontWeight: '700', color: active ? colors.bgBase : colors.txSecondary }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 카테고리 필터 (전체 피드 탭에서만 표시) */}
      {feedTab === 'all' && (
        <View style={{ flexShrink: 0 }}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}>
            {CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <TouchableOpacity
                  key={c.key || 'all'}
                  onPress={() => setCategory(c.key as typeof category)}
                  style={{
                    flexShrink: 0,
                    flexDirection: 'row', gap: 4, alignItems: 'center',
                    paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: 10, borderWidth: 1,
                    backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
                    borderColor: active ? colors.brandPrimary : colors.lineDefault,
                  }}>
                  <Text allowFontScaling={false} style={{ fontSize: 12 }}>{c.emoji}</Text>
                  <Text
                    allowFontScaling={false}
                    style={{ fontSize: 11, fontWeight: '700', color: active ? '#FFFFFF' : colors.txSecondary }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* LIVE 탭 안내 문구 */}
      {feedTab === 'live' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 11, color: colors.txTertiary }}>
            5분마다 자동 새로고침 · 최근 6시간 이내 글
          </Text>
        </View>
      )}

      <FlatList
        data={currentPosts}
        keyExtractor={(p) => String(p.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={feedTab === 'live' ? loadLive : loadAll}
            tintColor={feedTab === 'live' ? '#FF3B30' : colors.brandPrimary}
          />
        }
        renderItem={({ item }) =>
          item.post_type === 'live' || feedTab === 'live' ? (
            <LiveFeedCard
              post={item}
              onReport={() => handleReport(item.id, feedTab === 'live' ? loadLive : loadAll)}
            />
          ) : (
            <PostCard post={item} colors={colors} onChanged={loadAll} />
          )
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={{ color: colors.txTertiary, textAlign: 'center', marginTop: 40 }}>
              {feedTab === 'live'
                ? '지금 올라온 실시간 글이 없어요.\n첫 번째 LIVE 글을 작성해보세요!'
                : '아직 글이 없어요. 첫 글을 작성해보세요!'}
            </Text>
          )
        }
      />

      <ComposeModal
        visible={composing}
        defaultCity={city || undefined}
        defaultPostType={feedTab === 'live' ? 'live' : 'regular'}
        onClose={() => setComposing(false)}
        onCreated={() => {
          setComposing(false);
          if (feedTab === 'live') loadLive();
          else loadAll();
        }}
        colors={colors}
      />
    </View>
  );
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function cityDisplayName(key: string): string {
  const found = CITIES.find((c) => c.key === key);
  return found?.label ?? key;
}

function handleReport(postId: number, onChanged: () => void) {
  Alert.alert('신고', '이 게시글을 신고하시겠어요?', [
    { text: '취소', style: 'cancel' },
    {
      text: '스팸/광고',
      onPress: async () => {
        await api.community.report(postId, { reason: 'spam' });
        Toast.show({ type: 'success', text1: '신고가 접수되었어요' });
        onChanged();
      },
    },
    {
      text: '혐오/욕설',
      onPress: async () => {
        await api.community.report(postId, { reason: 'hate' });
        Toast.show({ type: 'success', text1: '신고가 접수되었어요' });
        onChanged();
      },
      style: 'destructive',
    },
  ]);
}

// ─── 일반 게시글 카드 ──────────────────────────────────────────────────────────

function PostCard({
  post, colors, onChanged,
}: {
  post: CommunityPost;
  colors: ReturnType<typeof useThemedColors>;
  onChanged: () => void;
}) {
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [liked, setLiked] = useState(false);

  const toggleLike = async () => {
    try {
      const r = await api.community.toggleLike(post.id);
      setLiked(r.liked);
      setLikeCount(r.like_count);
    } catch { /* ignore */ }
  };

  return (
    <View
      style={{
        padding: 14, borderRadius: 14, marginBottom: 10,
        backgroundColor: colors.bgSurface,
        borderWidth: 1, borderColor: colors.lineDefault,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: colors.txTertiary }}>
          {post.city ?? '전체'} · {categoryLabel(post.category)}
        </Text>
        <TouchableOpacity onPress={() => handleReport(post.id, onChanged)} hitSlop={8}>
          <Text style={{ fontSize: 14, color: colors.txTertiary }}>⋯</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.txPrimary, marginTop: 4 }}>
        {post.title}
      </Text>
      <Text style={{ fontSize: 13, color: colors.txSecondary, marginTop: 4, lineHeight: 19 }} numberOfLines={4}>
        {post.body}
      </Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <TouchableOpacity onPress={toggleLike} hitSlop={6}>
          <Text style={{ fontSize: 12, color: liked ? colors.brandPrimary : colors.txTertiary, fontWeight: '700' }}>
            {liked ? '❤️' : '🤍'} {likeCount}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12, color: colors.txTertiary }}>💬 {post.comment_count}</Text>
      </View>
    </View>
  );
}

function categoryLabel(c: string): string {
  return c === 'qna' ? '질문' : c === 'review' ? '후기' : c === 'photospot' ? '포토스팟' : c;
}

// ─── 작성 모달 ────────────────────────────────────────────────────────────────

function ComposeModal({
  visible, defaultCity, defaultPostType, onClose, onCreated, colors,
}: {
  visible: boolean;
  defaultCity?: string;
  defaultPostType?: 'regular' | 'live';
  onClose: () => void;
  onCreated: () => void;
  colors: ReturnType<typeof useThemedColors>;
}) {
  const [postType, setPostType] = useState<'regular' | 'live'>(defaultPostType ?? 'regular');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'qna' | 'review' | 'photospot'>('qna');
  const [submitting, setSubmitting] = useState(false);

  // 모달이 열릴 때 기본값 동기화
  useEffect(() => {
    if (visible) setPostType(defaultPostType ?? 'regular');
  }, [visible, defaultPostType]);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await api.community.createPost({
        post_type: postType,
        category,
        city: defaultCity || undefined,
        title: title.trim(),
        body: body.trim(),
      });
      setTitle(''); setBody('');
      onCreated();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      Alert.alert('작성 실패', err?.response?.data?.message ?? '잠시 후 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgBase, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.txPrimary }}>새 글 작성</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 22, color: colors.txSecondary }}>×</Text>
          </TouchableOpacity>
        </View>

        {/* 게시글 타입 선택 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => setPostType('regular')}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center',
              borderWidth: 1,
              backgroundColor: postType === 'regular' ? colors.txPrimary : colors.bgSurface,
              borderColor: postType === 'regular' ? colors.txPrimary : colors.lineDefault,
            }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: postType === 'regular' ? colors.bgBase : colors.txSecondary }}>
              일반 글
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPostType('live')}
            style={{
              flex: 1, flexDirection: 'row', gap: 4, paddingVertical: 8, borderRadius: 999,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              backgroundColor: postType === 'live' ? '#FF3B30' : colors.bgSurface,
              borderColor: postType === 'live' ? '#FF3B30' : colors.lineDefault,
            }}>
            {postType === 'live' && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
            )}
            <Text style={{ fontSize: 13, fontWeight: '700', color: postType === 'live' ? '#FFFFFF' : colors.txSecondary }}>
              LIVE (6시간)
            </Text>
          </TouchableOpacity>
        </View>

        {postType === 'live' && (
          <Text style={{ fontSize: 11, color: '#FF3B30', marginTop: 4 }}>
            LIVE 글은 6시간 후 자동 만료됩니다.
          </Text>
        )}

        {/* 카테고리 */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {(['qna', 'review', 'photospot'] as const).map((c) => {
            const active = c === category;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: active ? colors.brandPrimary : colors.bgSurface,
                  borderColor: active ? colors.brandPrimary : colors.lineDefault,
                }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.txSecondary }}>
                  {categoryLabel(c)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="제목"
          placeholderTextColor={colors.txTertiary}
          maxLength={200}
          style={{
            marginTop: 12, padding: 12, borderRadius: 12, fontSize: 14,
            color: colors.txPrimary, backgroundColor: colors.bgSurface,
            borderWidth: 1, borderColor: colors.lineDefault,
          }}
        />

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="내용을 입력해주세요"
          placeholderTextColor={colors.txTertiary}
          multiline
          maxLength={10000}
          style={{
            flex: 1, marginTop: 12, padding: 12, borderRadius: 12, fontSize: 14,
            color: colors.txPrimary, backgroundColor: colors.bgSurface,
            borderWidth: 1, borderColor: colors.lineDefault,
            textAlignVertical: 'top',
          }}
        />

        <TouchableOpacity
          onPress={submit}
          disabled={submitting || !title.trim() || !body.trim()}
          style={{
            marginTop: 12, paddingVertical: 14, borderRadius: 14,
            alignItems: 'center',
            backgroundColor:
              submitting || !title.trim() || !body.trim()
                ? colors.bgStrong
                : postType === 'live' ? '#FF3B30' : colors.brandPrimary,
          }}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              {postType === 'live' ? 'LIVE로 게시하기' : '게시하기'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
