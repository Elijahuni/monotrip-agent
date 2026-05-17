/** 한국 면세/택스리펀드 가이드 (일본인 관광객 관점). */

export interface TaxFreeStep {
  title: string;
  body: string;
}

export const KOREA_TAX_FREE_OVERVIEW = `한국 면세는 두 가지 — ① 사후면세(Tax Refund): 매장에서 일단 부가세 10% 포함 결제 후 출국 시 환급, ② 즉시환급(Instant Refund): 한 매장 1회 ₩30,000~₩500,000 구매 시 결제 즉시 부가세 차감. 외국인 단기 체류자(90일 미만 관광)만 가능합니다.`;

export const KOREA_TAX_FREE_STEPS: TaxFreeStep[] = [
  {
    title: '1. Tax Free 가맹점 확인',
    body: '"TAX FREE" / "Global Blue" / "Global Tax Free" 로고가 붙은 매장만 가능. 백화점·올리브영·면세점·대형 쇼핑몰 대부분 가능합니다.',
  },
  {
    title: '2. 결제 시 여권 제시',
    body: '구매 시 반드시 여권 원본을 제시. "택스 프리(Tax Free)" 라고 말하면 영수증 + 환급 전표를 함께 받습니다.',
  },
  {
    title: '3. 즉시환급 vs 사후환급 구분',
    body: '한 매장 1회 ₩30,000~₩500,000은 즉시환급 가능 (결제액에서 부가세 바로 차감). 그 외에는 출국 시 환급.',
  },
  {
    title: '4. 출국 시 세관 확인 (사후환급만)',
    body: '인천/김포/김해 공항 출국심사 전 "세관 신고대 / Tax Refund Customs"에서 여권·환급 전표·물품 확인 도장 받기. 미개봉 상태여야 함.',
  },
  {
    title: '5. 환급 카운터에서 수령',
    body: '출국 게이트 안 "Tax Refund Counter"에서 현금(KRW/JPY) 또는 카드 환급. ₩75,000 미만은 키오스크로도 가능. 일본 입국 후 우편 환급(JPY)도 가능.',
  },
];

export const KOREA_TAX_FREE_TIPS = [
  '면세점(롯데/신라/현대)은 처음부터 면세가 적용된 가격 — Tax Refund 별도 환급 없음',
  '명동·동대문 일부 매장은 일본어 응대 가능, 일본인 가이드 동반 시 수월',
  '환급액은 보통 부가세의 약 70~85% (수수료 차감)',
  '카드 환급은 1~3주 소요, 공항 현금 환급이 가장 빠름',
  '일본 입국 시 면세 한도 ¥200,000(약 ₩1,890,000) — 초과 시 자진신고가 유리',
];
