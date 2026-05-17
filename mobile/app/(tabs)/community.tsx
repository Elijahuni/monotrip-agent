/**
 * Phase 3: 커뮤니티 피드 탭.
 * - 도시·카테고리 필터
 * - 새 글 작성 모달
 * - 좋아요·신고
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

export default function CommunityTab() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const router = useRouter();
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<'' | 'qna' | 'review' | 'photospot'>('');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: insets.top }}>
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

      {/* 카테고리 필터 */}
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

      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brandPrimary} />}
        renderItem={({ item }) => <PostCard post={item} colors={colors} onChanged={load} />}
        ListEmptyComponent={
          loading ? null : (
            <Text style={{ color: colors.txTertiary, textAlign: 'center', marginTop: 40 }}>
              아직 글이 없어요. 첫 글을 작성해보세요!
            </Text>
          )
        }
      />

      <ComposeModal
        visible={composing}
        defaultCity={city || undefined}
        onClose={() => setComposing(false)}
        onCreated={() => { setComposing(false); load(); }}
        colors={colors}
      />
    </View>
  );
}

// ─── 게시글 카드 ──────────────────────────────────────────────────────────────

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

  const handleReport = () => {
    Alert.alert('신고', '이 게시글을 신고하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '스팸/광고',
        onPress: async () => { await api.community.report(post.id, { reason: 'spam' }); Toast.show({ type: 'success', text1: '신고가 접수되었어요' }); onChanged(); },
      },
      {
        text: '혐오/욕설',
        onPress: async () => { await api.community.report(post.id, { reason: 'hate' }); Toast.show({ type: 'success', text1: '신고가 접수되었어요' }); onChanged(); },
        style: 'destructive',
      },
    ]);
  };

  return (
    <View
      style={{
        padding: 14, borderRadius: 14,
        backgroundColor: colors.bgSurface,
        borderWidth: 1, borderColor: colors.lineDefault,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: colors.txTertiary }}>
          {post.city ?? '전체'} · {categoryLabel(post.category)}
        </Text>
        <TouchableOpacity onPress={handleReport} hitSlop={8}>
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
  visible, defaultCity, onClose, onCreated, colors,
}: {
  visible: boolean;
  defaultCity?: string;
  onClose: () => void;
  onCreated: () => void;
  colors: ReturnType<typeof useThemedColors>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'qna' | 'review' | 'photospot'>('qna');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await api.community.createPost({
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
            backgroundColor: submitting || !title.trim() || !body.trim() ? colors.bgStrong : colors.brandPrimary,
          }}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>게시하기</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
