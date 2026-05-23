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
import { PostPhotoGrid } from '@/components/PostPhotoGrid';
import { api } from '@/lib/api';
import { useThemedColors } from '@/lib/design-tokens';
import { useSettings } from '@/lib/settings-context';
import type { CommunityPost } from '@/lib/types';

// 도시 슬러그 목록 (라벨은 i18n으로 처리)
const CITY_KEYS = ['tokyo', 'osaka', 'kyoto', 'seoul', 'busan', 'jeju'] as const;
type CommunityCityKey = (typeof CITY_KEYS)[number];

const CATEGORY_KEYS = [
  { key: '',          emoji: '✨' },
  { key: 'qna',       emoji: '❓' },
  { key: 'review',    emoji: '⭐' },
  { key: 'photospot', emoji: '📷' },
] as const;

type FeedTab = 'all' | 'live';

const LIVE_REFRESH_MS = 5 * 60 * 1000; // 5분

export default function CommunityTab() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const { t, lang } = useSettings();

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

  // 도시 표시 이름 (i18n)
  const cityLabel = (key: string): string => {
    if (!key) return t('community', 'cityAll');
    if (CITY_KEYS.includes(key as CommunityCityKey)) {
      return t('cities', key as CommunityCityKey);
    }
    return key;
  };

  // 카테고리 표시 이름 (i18n)
  const catLabel = (key: string): string => {
    if (key === 'qna')       return t('community', 'catQna');
    if (key === 'review')    return t('community', 'catReview');
    if (key === 'photospot') return t('community', 'catPhotospot');
    return t('community', 'catAll');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: colors.txPrimary }}>
          {t('community', 'title')}
        </Text>
        <TouchableOpacity
          onPress={() => setComposing(true)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: colors.brandPrimary,
          }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
            {t('community', 'write')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 피드 탭 (전체 / LIVE) */}
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
            {t('community', 'feedAll')}
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
            {city ? `${cityLabel(city)} ` : ''}{t('community', 'feedLive')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 도시 필터 */}
      <View style={{ flexShrink: 0 }}>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 6 }}>
          {/* 전체 */}
          <TouchableOpacity
            key="all"
            onPress={() => setCity('')}
            style={{
              flexShrink: 0,
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 999, borderWidth: 1,
              backgroundColor: city === '' ? colors.txPrimary : colors.bgSurface,
              borderColor: city === '' ? colors.txPrimary : colors.lineDefault,
            }}>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 12, fontWeight: '700', color: city === '' ? colors.bgBase : colors.txSecondary }}>
              {t('community', 'cityAll')}
            </Text>
          </TouchableOpacity>

          {/* 도시별 */}
          {CITY_KEYS.map((key) => {
            const active = key === city;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setCity(key)}
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
                  {t('cities', key)}
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
            {CATEGORY_KEYS.map((c) => {
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
                    {catLabel(c.key)}
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
            {t('community', 'liveHint')}
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
              onReport={() => handleReport(item.id, feedTab === 'live' ? loadLive : loadAll, t)}
            />
          ) : (
            <PostCard post={item} colors={colors} catLabel={catLabel} onChanged={loadAll} t={t} />
          )
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={{ color: colors.txTertiary, textAlign: 'center', marginTop: 40 }}>
              {feedTab === 'live' ? t('community', 'emptyLive') : t('community', 'emptyAll')}
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
        catLabel={catLabel}
      />
    </View>
  );
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useSettings>['t'];

function handleReport(postId: number, onChanged: () => void, t: TFunc) {
  Alert.alert(t('community', 'report'), t('community', 'reportConfirm'), [
    { text: t('community', 'reportCancel'), style: 'cancel' },
    {
      text: t('community', 'reportSpam'),
      onPress: async () => {
        await api.community.report(postId, { reason: 'spam' });
        Toast.show({ type: 'success', text1: t('community', 'reported') });
        onChanged();
      },
    },
    {
      text: t('community', 'reportHate'),
      onPress: async () => {
        await api.community.report(postId, { reason: 'hate' });
        Toast.show({ type: 'success', text1: t('community', 'reported') });
        onChanged();
      },
      style: 'destructive',
    },
  ]);
}

// ─── 일반 게시글 카드 ──────────────────────────────────────────────────────────

function PostCard({
  post, colors, catLabel, onChanged, t,
}: {
  post: CommunityPost;
  colors: ReturnType<typeof useThemedColors>;
  catLabel: (key: string) => string;
  onChanged: () => void;
  t: TFunc;
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
          {post.city ?? t('community', 'cityAll')} · {catLabel(post.category)}
        </Text>
        <TouchableOpacity onPress={() => handleReport(post.id, onChanged, t)} hitSlop={8}>
          <Text style={{ fontSize: 14, color: colors.txTertiary }}>⋯</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.txPrimary, marginTop: 4 }}>
        {post.title}
      </Text>
      {/* 포토그리드 (이미지 있을 때만) */}
      {post.images && post.images.length > 0 && (
        <View style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden' }}>
          <PostPhotoGrid images={post.images} />
        </View>
      )}
      <Text style={{ fontSize: 13, color: colors.txSecondary, marginTop: 6, lineHeight: 19 }} numberOfLines={4}>
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

// ─── 작성 모달 ────────────────────────────────────────────────────────────────

function ComposeModal({
  visible, defaultCity, defaultPostType, onClose, onCreated, colors, catLabel,
}: {
  visible: boolean;
  defaultCity?: string;
  defaultPostType?: 'regular' | 'live';
  onClose: () => void;
  onCreated: () => void;
  colors: ReturnType<typeof useThemedColors>;
  catLabel: (key: string) => string;
}) {
  const { t } = useSettings();
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
      Alert.alert(
        t('community', 'writeFail'),
        err?.response?.data?.message ?? t('community', 'writeFailMsg'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgBase, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.txPrimary }}>
            {t('community', 'composeTitle')}
          </Text>
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
              {t('community', 'typeRegular')}
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
              {t('community', 'typeLive')}
            </Text>
          </TouchableOpacity>
        </View>

        {postType === 'live' && (
          <Text style={{ fontSize: 11, color: '#FF3B30', marginTop: 4 }}>
            {t('community', 'liveExpiry')}
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
                  {catLabel(c)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('community', 'titlePlaceholder')}
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
          placeholder={t('community', 'bodyPlaceholder')}
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
              {postType === 'live' ? t('community', 'postLiveBtn') : t('community', 'postBtn')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
