/**
 * 메시지 — 대화 목록 (GET /dm/conversations)
 * 상대별 최신 메시지 + 미읽음 배지. 탭 시 채팅방으로 이동.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ListSkeleton, PressableScale } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { tapMedium } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import type { DmConversation } from '@/lib/types';

function timeAgo(iso: string, lang: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return lang === 'ko' ? '방금' : 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}${lang === 'ko' ? '분' : 'm'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${lang === 'ko' ? '시간' : 'h'}`;
  return `${Math.floor(diff / 86400)}${lang === 'ko' ? '일' : 'd'}`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [convos, setConvos] = useState<DmConversation[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setConvos(await api.dm.conversations());
    } catch {
      setConvos([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    tapMedium();
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // 채팅방에서 돌아오면 목록(미읽음) 갱신
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openChat(c: DmConversation) {
    const name = c.other_nickname ?? `${lang === 'ko' ? '사용자' : 'User'} #${c.other_user_id}`;
    router.push(`/messages/${c.other_user_id}?name=${encodeURIComponent(name)}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <IconButton
          icon="chevron-back"
          onPress={() => router.back()}
          accessibilityLabel={lang === 'ko' ? '뒤로' : 'Back'}
          style={{ marginRight: 8 }}
        />
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }}>
          {lang === 'ko' ? '메시지' : 'Messages'}
        </Text>
      </View>

      {loading ? (
        <ListSkeleton count={6} />
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => String(c.other_user_id)}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.coral500} colors={[palette.coral500]} />
          }
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '대화가 없어요.' : 'No conversations.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const name = item.other_nickname ?? `${lang === 'ko' ? '사용자' : 'User'} #${item.other_user_id}`;
            return (
              <PressableScale
                onPress={() => openChat(item)}
                accessibilityLabel={`${name}, ${item.last_message}`}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: palette.coral500, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, color: colors.txPrimary, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
                    <Text style={{ color: colors.txTertiary, fontSize: 11 }}>{timeAgo(item.last_at, lang)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ flex: 1, color: item.unread_count > 0 ? colors.txPrimary : colors.txTertiary, fontSize: 13, fontWeight: item.unread_count > 0 ? '600' : '400' }} numberOfLines={1}>
                      {item.last_from_me ? (lang === 'ko' ? '나: ' : 'Me: ') : ''}{item.last_message}
                    </Text>
                    {item.unread_count > 0 && (
                      <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: palette.coral500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}
