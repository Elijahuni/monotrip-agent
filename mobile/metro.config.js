const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// Sentry Metro 통합: 프로덕션 소스맵 자동 업로드 + 에러 스택 트레이스 개선
// ContextNavigator hooks order 에러의 실제 원인은 Sentry가 아니었음.
// → useStore()의 계산 블록에서 모듈 지연 로딩 중 발생한 우발적 useState() 호출이 원인.
// → router-store.js 패치로 수정 완료. Sentry Metro 통합은 안전하게 복원.
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });