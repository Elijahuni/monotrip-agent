/**
 * 채팅방 — 1:1 DM 스레드 (GET/POST /dm/{id})
 * 말풍선(내/상대), 전송, 5초 폴링으로 신규 메시지 수신. 조회 시 자동 읽음.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui';
import { api } from '@/lib/api';
import { palette, useThemedColors } from '@/lib/design-tokens';
import { tapLight } from '@/lib/haptics';
import { useSettings } from '@/lib/settings-context';
import type { DmMessage } from '@/lib/types';
import { useAuthStore } from '@/store';

const POLL_MS = 5000;

export default function ChatRoomScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const otherId = Number(userId);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lang } = useSettings();
  const colors = useThemedColors();
  const myId = useAuthStore((s) => s.user?.user_id ?? null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<DmMessage[]>([]);

  const fetchThread = useCallback(async () => {
    try {
      // 최신순(desc)으로 받아 inverted 리스트에 그대로 사용
      setMessages(await api.dm.thread(otherId, { limit: 50 }));
    } catch {
      /* 유지 */
    }
  }, [otherId]);

  // 최초 로드
  useEffect(() => {
    let active = true;
    (async () => {
      await fetchThread();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [fetchThread]);

  // 5초 폴링 (신규 메시지 수신)
  useEffect(() => {
    const t = setInterval(() => { void fetchThread(); }, POLL_MS);
    return () => clearInterval(t);
  }, [fetchThread]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    tapLight();
    try {
      const msg = await api.dm.send(otherId, body);
      setMessages((prev) => [msg, ...prev]); // 최신이 앞(inverted에서 맨 아래)
    } catch {
      setText(body); // 실패 시 입력 복원
    } finally {
      setSending(false);
    }
  }, [text, sending, otherId]);

  const title = name ?? `${lang === 'ko' ? '사용자' : 'User'} #${otherId}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* 헤더 */}
      <View
        style={{
          backgroundColor: colors.bgSurface,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
        }}
      >
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel={lang === 'ko' ? '뒤로' : 'Back'} style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.txPrimary }} numberOfLines={1}>{title}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.coral500} />
        </View>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 60, transform: [{ scaleY: -1 }] }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>👋</Text>
              <Text style={{ color: colors.txSecondary, fontSize: 14 }}>
                {lang === 'ko' ? '첫 메시지를 보내보세요.' : 'Say hi!'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <View
                  style={{
                    maxWidth: '78%',
                    backgroundColor: mine ? palette.coral500 : colors.bgSurface,
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.lineDefault,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                  }}
                >
                  <Text style={{ color: mine ? '#fff' : colors.txPrimary, fontSize: 15, lineHeight: 21 }}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* 입력창 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: colors.lineDefault,
          backgroundColor: colors.bgSurface,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={lang === 'ko' ? '메시지 입력...' : 'Message...'}
          placeholderTextColor={colors.txDisabled}
          multiline
          style={{
            flex: 1,
            maxHeight: 100,
            backgroundColor: colors.bgBase,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 9,
            color: colors.txPrimary,
            fontSize: 15,
          }}
        />
        <IconButton
          icon={sending ? 'hourglass-outline' : 'arrow-up-circle'}
          onPress={send}
          disabled={sending || !text.trim()}
          accessibilityLabel={lang === 'ko' ? '전송' : 'Send'}
          size={32}
          color={text.trim() ? palette.coral500 : colors.txDisabled}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
