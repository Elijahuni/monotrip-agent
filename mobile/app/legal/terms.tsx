/**
 * 이용약관 (한/영).
 * iOS/Android 앱 심사 필수 항목.
 */
import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedColors } from '@/lib/design-tokens';

export default function TermsScreen() {
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
          이용약관 / Terms of Service
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>

        <Text style={{ fontSize: 11, color: colors.txTertiary, marginBottom: 16 }}>
          최종 업데이트: 2026년 5월 18일 · Last updated: May 18, 2026
        </Text>

        {/* 한국어 */}
        <Section title="서비스 이용약관" color={colors.txPrimary}>
          <Para colors={colors}>
            트리플(이하 "회사")이 제공하는 AI 여행 계획 서비스(이하 "서비스")를 이용해 주셔서
            감사합니다. 본 약관은 서비스 이용에 관한 기본적인 사항을 규정합니다.
          </Para>

          <SubSection title="제1조 (목적)" colors={colors}>
            본 약관은 회사가 제공하는 모든 서비스의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무
            및 책임 사항을 규정함을 목적으로 합니다.
          </SubSection>

          <SubSection title="제2조 (이용자 의무)" colors={colors}>
            이용자는 본 서비스를 이용함에 있어 다음 행위를 하여서는 안 됩니다:{'\n'}
            1. 타인의 개인정보를 무단으로 수집·이용하는 행위{'\n'}
            2. 회사의 서비스를 방해하거나 서버에 과도한 부하를 주는 행위{'\n'}
            3. 음란물, 혐오 표현, 스팸 등 불법·유해한 콘텐츠를 게시하는 행위{'\n'}
            4. 서비스를 통해 수집된 타인의 정보를 상업적으로 이용하는 행위
          </SubSection>

          <SubSection title="제3조 (서비스 제공 및 변경)" colors={colors}>
            회사는 서비스를 안정적으로 제공하기 위해 노력하며, 시스템 점검·업데이트 등으로 서비스가
            일시 중단될 수 있습니다. 회사는 서비스 내용을 변경할 경우 사전에 공지합니다.
          </SubSection>

          <SubSection title="제4조 (면책 조항)" colors={colors}>
            회사는 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 손실을 입는 경우에 대해
            책임을 지지 않습니다. AI가 제공하는 여행 추천은 참고용이며, 최종 결정은 이용자 본인이
            합니다.
          </SubSection>

          <SubSection title="제5조 (준거법 및 관할)" colors={colors}>
            본 약관은 대한민국 법률에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 제1심 관할
            법원으로 합니다.
          </SubSection>
        </Section>

        <Divider colors={colors} />

        {/* English */}
        <Section title="Terms of Service (English)" color={colors.txPrimary}>
          <Para colors={colors}>
            Thank you for using the AI travel planning service (the "Service") provided by Triple
            (the "Company"). These Terms govern your use of the Service.
          </Para>

          <SubSection title="1. Purpose" colors={colors}>
            These Terms set out the conditions and procedures for using all services provided by the
            Company, and define the rights, obligations, and responsibilities of the Company and
            users.
          </SubSection>

          <SubSection title="2. User Obligations" colors={colors}>
            Users must not engage in the following when using the Service:{'\n'}
            1. Collecting or using others' personal information without authorization{'\n'}
            2. Interfering with the Service or placing excessive load on servers{'\n'}
            3. Posting illegal or harmful content including pornography, hate speech, or spam{'\n'}
            4. Commercially exploiting information about others collected through the Service
          </SubSection>

          <SubSection title="3. Service Provision and Changes" colors={colors}>
            The Company strives to provide a stable Service. The Service may be temporarily
            interrupted for maintenance or updates. The Company will provide advance notice when
            changing Service content.
          </SubSection>

          <SubSection title="4. Disclaimer" colors={colors}>
            The Company is not responsible for any loss of expected profits or damages incurred by
            users through use of the Service. AI travel recommendations are for reference only, and
            final decisions rest with the user.
          </SubSection>

          <SubSection title="5. Governing Law and Jurisdiction" colors={colors}>
            These Terms are governed by the laws of the Republic of Korea. Any disputes shall be
            subject to the jurisdiction of the Seoul Central District Court as the court of first
            instance.
          </SubSection>
        </Section>

        <Text style={{ fontSize: 11, color: colors.txTertiary, textAlign: 'center', marginTop: 24 }}>
          문의: support@triple-app.io
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
