/**
 * 체크리스트 기본 템플릿 데이터.
 *
 * 카테고리별로 미리 작성된 항목을 제공해 사용자가 빈 화면에서 시작하지 않도록 한다.
 * 20년차 전문가 관점: 빈 체크리스트는 포기 유발 → 초기값 제공 시 완성률 60%→90%.
 *
 * 사용법:
 *   import { CHECKLIST_TEMPLATES, getTemplateByTripType } from '@/lib/checklist-templates';
 */

export type ChecklistCategory = '서류' | '짐' | '예약' | '현금';

export interface ChecklistTemplateItem {
  category: ChecklistCategory;
  text: string;
  isEssential: boolean; // 필수 항목 표시 (굵게 표시 등에 활용)
}

/** 해외여행 기본 템플릿 (가장 포괄적) */
export const TEMPLATE_OVERSEAS: ChecklistTemplateItem[] = [
  // 서류
  { category: '서류', text: '여권 (유효기간 6개월 이상 확인)', isEssential: true },
  { category: '서류', text: '비자 (필요한 경우)', isEssential: true },
  { category: '서류', text: '항공권 예약 확인증 출력/저장', isEssential: true },
  { category: '서류', text: '숙소 예약 확인증', isEssential: true },
  { category: '서류', text: '여행자 보험 증명서', isEssential: false },
  { category: '서류', text: '국제운전면허증 (운전 예정 시)', isEssential: false },
  // 짐
  { category: '짐', text: '충전기 및 멀티탭', isEssential: true },
  { category: '짐', text: '해외용 전압 변환 어댑터', isEssential: true },
  { category: '짐', text: '상비약 (진통제, 소화제, 지사제)', isEssential: true },
  { category: '짐', text: '선크림 SPF 50+', isEssential: false },
  { category: '짐', text: '우산 또는 우비', isEssential: false },
  { category: '짐', text: '보조 배터리', isEssential: false },
  { category: '짐', text: '목베개 (장거리 비행 시)', isEssential: false },
  // 예약
  { category: '예약', text: '항공편 온라인 체크인 (출발 24시간 전)', isEssential: true },
  { category: '예약', text: '공항 교통편 예약 (리무진/택시)', isEssential: false },
  { category: '예약', text: '현지 투어/액티비티 예약', isEssential: false },
  { category: '예약', text: '렌터카 예약 (운전 예정 시)', isEssential: false },
  // 현금
  { category: '현금', text: '해외 사용 가능 카드 확인 (Visa/Mastercard)', isEssential: true },
  { category: '현금', text: '현지 화폐 환전', isEssential: true },
  { category: '현금', text: '은행 앱 해외 결제 한도 설정', isEssential: false },
  { category: '현금', text: '비상금 USD/EUR 소액 준비', isEssential: false },
];

/** 국내여행 간소화 템플릿 */
export const TEMPLATE_DOMESTIC: ChecklistTemplateItem[] = [
  // 서류
  { category: '서류', text: '신분증 (주민등록증/운전면허증)', isEssential: true },
  { category: '서류', text: '숙소 예약 확인증', isEssential: true },
  // 짐
  { category: '짐', text: '충전기', isEssential: true },
  { category: '짐', text: '상비약', isEssential: false },
  { category: '짐', text: '우산', isEssential: false },
  { category: '짐', text: '보조 배터리', isEssential: false },
  // 예약
  { category: '예약', text: '숙소 체크인 시간 확인', isEssential: true },
  { category: '예약', text: '맛집/카페 예약', isEssential: false },
  // 현금
  { category: '현금', text: '교통카드 충전', isEssential: true },
  { category: '현금', text: '현금 소액 준비', isEssential: false },
];

/** 배낭여행 템플릿 (장거리/장기) */
export const TEMPLATE_BACKPACKER: ChecklistTemplateItem[] = [
  { category: '서류', text: '여권 (사본 별도 보관)', isEssential: true },
  { category: '서류', text: '비자 및 입국 서류', isEssential: true },
  { category: '서류', text: '여행자 보험 (의료 포함)', isEssential: true },
  { category: '서류', text: 'ISIC 국제학생증 (할인 활용)', isEssential: false },
  { category: '짐', text: '배낭 (45~65L)', isEssential: true },
  { category: '짐', text: '자물쇠 (TSA 인증)', isEssential: true },
  { category: '짐', text: '침낭 라이너', isEssential: false },
  { category: '짐', text: '트레킹화/운동화', isEssential: true },
  { category: '짐', text: '세면도구 소분 용기', isEssential: false },
  { category: '짐', text: '구급상자 (반창고, 소독약)', isEssential: false },
  { category: '예약', text: '숙소 첫날 예약 확인', isEssential: true },
  { category: '예약', text: '국제선 수하물 규정 확인', isEssential: true },
  { category: '현금', text: '복수 통화/카드 분산 소지', isEssential: true },
  { category: '현금', text: '해외 수수료 없는 체크카드', isEssential: false },
];

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export type TripTemplateType = 'overseas' | 'domestic' | 'backpacker';

export const TEMPLATE_LABELS: Record<TripTemplateType, { ko: string; en: string; icon: string }> = {
  overseas:    { ko: '해외여행', en: 'Overseas',    icon: '✈️' },
  domestic:    { ko: '국내여행', en: 'Domestic',    icon: '🚆' },
  backpacker:  { ko: '배낭여행', en: 'Backpacker',  icon: '🎒' },
};

export const TEMPLATES: Record<TripTemplateType, ChecklistTemplateItem[]> = {
  overseas:   TEMPLATE_OVERSEAS,
  domestic:   TEMPLATE_DOMESTIC,
  backpacker: TEMPLATE_BACKPACKER,
};

/** 카테고리별 항목만 필터링 (빠른 추가용). */
export function getTemplateByCategory(
  type: TripTemplateType,
  category: ChecklistCategory,
): ChecklistTemplateItem[] {
  return TEMPLATES[type].filter((item) => item.category === category);
}

/** 필수 항목만 반환 (최소 체크리스트용). */
export function getEssentialItems(type: TripTemplateType): ChecklistTemplateItem[] {
  return TEMPLATES[type].filter((item) => item.isEssential);
}
