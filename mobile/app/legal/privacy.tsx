/**
 * 개인정보처리방침 (한/영).
 * iOS/Android 앱 심사 필수 항목.
 */
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedColors } from '@/lib/design-tokens';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemedColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      {/* 헤더 */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.lineDefault,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: colors.txPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.txPrimary }}>
          개인정보처리방침 / Privacy Policy
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 16 }}>
          최종 업데이트: 2026년 5월 18일 · Last updated: May 18, 2026
        </Text>

        {/* 한국어 */}
        <Section title="개인정보처리방침" color={colors.txPrimary}>
          <Para colors={colors}>
            트리플(이하 "회사")은 「개인정보 보호법」 및 관련 법령을 준수하며, 이용자의 개인정보를
            안전하게 보호하기 위해 최선을 다합니다.
          </Para>

          <SubSection title="1. 수집하는 개인정보 항목" colors={colors}>
            {`회사는 서비스 제공을 위해 아래와 같은 정보를 수집합니다:\n\n`}
            {`[필수 항목]\n`}
            {`• 이메일 주소, 비밀번호 (자체 가입)\n`}
            {`• 카카오/구글 계정 식별자 (소셜 로그인)\n`}
            {`• 닉네임\n\n`}
            {`[서비스 이용 중 자동 수집]\n`}
            {`• 앱 이용 기록, 기기 정보(OS 버전, 앱 버전)\n`}
            {`• 위치 정보 (이용자 동의 시에만 수집)\n`}
            {`• 오류 로그 (Sentry를 통한 익명화된 크래시 리포트)`}
          </SubSection>

          <SubSection title="2. 개인정보 수집·이용 목적" colors={colors}>
            {`• 회원 가입 및 본인 확인\n`}
            {`• AI 여행 추천 개인화\n`}
            {`• 고객 문의 대응 및 서비스 개선\n`}
            {`• 서비스 이용 통계 분석 (익명화)`}
          </SubSection>

          <SubSection title="3. 개인정보 보유 및 이용 기간" colors={colors}>
            {`• 회원 탈퇴 시 즉시 삭제 (단, 관계 법령에 따라 일정 기간 보관)\n`}
            {`• 전자상거래 관련 기록: 5년\n`}
            {`• 소비자 불만·분쟁 기록: 3년\n`}
            {`• 접속 로그: 3개월`}
          </SubSection>

          <SubSection title="4. 개인정보 제3자 제공" colors={colors}>
            회사는 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다. 단, 법령에 의거하거나
            수사기관의 적법한 요청이 있는 경우는 예외입니다.
          </SubSection>

          <SubSection title="5. 개인정보 처리 위탁" colors={colors}>
            {`회사는 서비스 운영을 위해 아래 업체에 일부 업무를 위탁합니다:\n`}
            {`• Google LLC — 클라우드 인프라(AI API)\n`}
            {`• Sentry Inc. — 오류 로그 수집 (익명화)\n`}
            {`• Expo — 푸시 알림 발송`}
          </SubSection>

          <SubSection title="6. 이용자 권리" colors={colors}>
            {`이용자는 언제든지 다음 권리를 행사할 수 있습니다:\n`}
            {`• 개인정보 열람·정정·삭제 요청\n`}
            {`• 처리 정지 요청\n`}
            {`• 개인정보 이동 요청\n\n`}
            권리 행사는 앱 내 프로필 → 고객센터 또는 support@triple-app.io로 문의하세요.
          </SubSection>

          <SubSection title="7. 개인정보 보호책임자" colors={colors}>
            {`성명: 트리플 개인정보 보호팀\n이메일: privacy@triple-app.io`}
          </SubSection>
        </Section>

        <Divider colors={colors} />

        {/* English */}
        <Section title="Privacy Policy (English)" color={colors.txPrimary}>
          <Para colors={colors}>
            Triple (the "Company") complies with the Personal Information Protection Act and related
            laws, and strives to protect users' personal information safely.
          </Para>

          <SubSection title="1. Information We Collect" colors={colors}>
            {`[Required]\n`}
            {`• Email address, password (direct sign-up)\n`}
            {`• Kakao/Google account identifier (social login)\n`}
            {`• Nickname\n\n`}
            {`[Automatically collected during use]\n`}
            {`• App usage history, device info (OS version, app version)\n`}
            {`• Location data (only with user consent)\n`}
            {`• Error logs (anonymized crash reports via Sentry)`}
          </SubSection>

          <SubSection title="2. How We Use Your Information" colors={colors}>
            {`• Member registration and identity verification\n`}
            {`• Personalized AI travel recommendations\n`}
            {`• Customer support and service improvement\n`}
            {`• Anonymized usage analytics`}
          </SubSection>

          <SubSection title="3. Retention Period" colors={colors}>
            {`• Deleted immediately upon account withdrawal\n`}
            {`  (except where required by law)\n`}
            {`• E-commerce records: 5 years\n`}
            {`• Consumer complaint/dispute records: 3 years\n`}
            {`• Access logs: 3 months`}
          </SubSection>

          <SubSection title="4. Sharing with Third Parties" colors={colors}>
            We do not share your personal information with third parties without your consent,
            except as required by law or by lawful requests from investigative authorities.
          </SubSection>

          <SubSection title="5. Data Processing Partners" colors={colors}>
            {`• Google LLC — Cloud infrastructure (AI API)\n`}
            {`• Sentry Inc. — Error log collection (anonymized)\n`}
            {`• Expo — Push notification delivery`}
          </SubSection>

          <SubSection title="6. Your Rights" colors={colors}>
            {`You may exercise the following rights at any time:\n`}
            {`• Access, correct, or delete your personal information\n`}
            {`• Request restriction of processing\n`}
            {`• Data portability request\n\n`}
            To exercise these rights, contact us via Profile → Customer Support or
            {' '}support@triple-app.io.
          </SubSection>

          <SubSection title="7. Privacy Officer" colors={colors}>
            {`Team: Triple Privacy Team\nEmail: privacy@triple-app.io`}
          </SubSection>
        </Section>

        <Text style={{ fontSize: 11, color: colors.txTertiary, textAlign: 'center', marginTop: 24 }}>
          문의: privacy@triple-app.io
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({
  title, color, children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color, marginBottom: 12 }}>{title}</Text>
      {children}
    </View>
  );
}

function SubSection({
  title, colors, children,
}: {
  title: string;
  colors: ReturnType<typeof useThemedColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.txPrimary, marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: colors.txSecondary, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

function Para({
  colors, children,
}: {
  colors: ReturnType<typeof useThemedColors>;
  children: React.ReactNode;
}) {
  return (
    <Text style={{ fontSize: 13, color: colors.txSecondary, lineHeight: 20, marginBottom: 14 }}>
      {children}
    </Text>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useThemedColors> }) {
  return <View style={{ height: 1, backgroundColor: colors.lineDefault, marginVertical: 24 }} />;
}
