/**
 * 한국 여행 회화 정적 사전 — 일본인 관광객 관점.
 * 일본어가 prompt, 한국어가 표현 + 로마자(국립국어원 RR).
 */
export type KoreaPhraseCategory =
  | 'greeting' | 'restaurant' | 'shopping' | 'transport' | 'hotel' | 'emergency';

export interface KoreanPhrase {
  japanese: string;    // 일본어 (검색·이해용)
  korean: string;      // 한국어 표현
  romanized: string;   // 국립국어원 RR
}

export const KOREA_PHRASE_CATEGORIES: { key: KoreaPhraseCategory; label: string; emoji: string }[] = [
  { key: 'greeting',   label: 'あいさつ',   emoji: '👋' },
  { key: 'restaurant', label: 'グルメ',     emoji: '🍲' },
  { key: 'shopping',   label: 'ショッピング', emoji: '🛍️' },
  { key: 'transport',  label: '交通',       emoji: '🚇' },
  { key: 'hotel',      label: 'ホテル',     emoji: '🏨' },
  { key: 'emergency',  label: '緊急',       emoji: '🆘' },
];

export const KOREA_PHRASES: Record<KoreaPhraseCategory, KoreanPhrase[]> = {
  greeting: [
    { japanese: 'こんにちは',        korean: '안녕하세요',          romanized: 'annyeonghaseyo' },
    { japanese: 'ありがとうございます', korean: '감사합니다',          romanized: 'gamsahamnida' },
    { japanese: 'すみません',        korean: '죄송합니다',          romanized: 'joesonghamnida' },
    { japanese: 'はじめまして',      korean: '처음 뵙겠습니다',     romanized: 'cheoeum boepgesseumnida' },
    { japanese: 'さようなら',        korean: '안녕히 계세요',       romanized: 'annyeonghi gyeseyo' },
  ],
  restaurant: [
    { japanese: 'メニューをください',         korean: '메뉴 주세요',           romanized: 'menyu juseyo' },
    { japanese: 'おすすめは何ですか',         korean: '뭐가 맛있어요?',         romanized: 'mwoga masisseoyo?' },
    { japanese: 'これをください',             korean: '이거 주세요',           romanized: 'igeo juseyo' },
    { japanese: '辛くしないでください',       korean: '안 맵게 해 주세요',     romanized: 'an maepge hae juseyo' },
    { japanese: 'お会計お願いします',         korean: '계산해 주세요',         romanized: 'gyesanhae juseyo' },
    { japanese: 'お水をください',             korean: '물 좀 주세요',          romanized: 'mul jom juseyo' },
    { japanese: 'ごちそうさまでした',         korean: '잘 먹었습니다',         romanized: 'jal meogeosseumnida' },
    { japanese: '辛いものは食べられません',   korean: '매운 거 못 먹어요',     romanized: 'maeun geo mot meogeoyo' },
  ],
  shopping: [
    { japanese: 'いくらですか',               korean: '얼마예요?',             romanized: 'eolmayeyo?' },
    { japanese: '試着してもいいですか',       korean: '입어봐도 돼요?',         romanized: 'ibeobwado dwaeyo?' },
    { japanese: '免税できますか',             korean: '면세 되나요?',          romanized: 'myeonse doenayo?' },
    { japanese: 'カードは使えますか',         korean: '카드 돼요?',             romanized: 'kadeu dwaeyo?' },
    { japanese: '袋をください',               korean: '봉투 주세요',            romanized: 'bongtu juseyo' },
    { japanese: '見ているだけです',           korean: '그냥 구경할게요',        romanized: 'geunyang gugyeonghalgeyo' },
    { japanese: 'もう少し安くなりませんか',   korean: '좀 깎아주세요',          romanized: 'jom kkakkajuseyo' },
  ],
  transport: [
    { japanese: '弘大入口駅までどう行きますか', korean: '홍대입구역 어떻게 가요?', romanized: 'hongdae-ipgu-yeok eotteoke gayo?' },
    { japanese: 'T-moneyカードはどこで買えますか', korean: '티머니 카드 어디서 사요?', romanized: 'timeoni kadeu eodiseo sayo?' },
    { japanese: 'チャージしたいです',         korean: '충전해 주세요',         romanized: 'chungjeonhae juseyo' },
    { japanese: '何番出口から出ますか',       korean: '몇 번 출구로 나가요?',  romanized: 'myeot beon chulguro nagayo?' },
    { japanese: 'タクシーを呼んでください',   korean: '택시 좀 불러 주세요',   romanized: 'taeksi jom bulleo juseyo' },
    { japanese: 'KTXに乗りたいです',          korean: 'KTX 타려고 해요',       romanized: 'KTX taryeogo haeyo' },
  ],
  hotel: [
    { japanese: 'チェックインお願いします',   korean: '체크인 해주세요',       romanized: 'chekeu-in haejuseyo' },
    { japanese: 'Wi-Fiのパスワードは何ですか', korean: '와이파이 비번 뭐예요?', romanized: 'waipai bibeon mwoyeyo?' },
    { japanese: '荷物を預けてもいいですか',   korean: '짐 좀 맡겨도 돼요?',     romanized: 'jim jom matgyeodo dwaeyo?' },
    { japanese: 'チェックアウトは何時ですか', korean: '체크아웃 몇 시예요?',    romanized: 'chekeu-aut myeot siyeyo?' },
    { japanese: '近くにコンビニはありますか', korean: '근처에 편의점 있어요?', romanized: 'geuncheo-e pyeonuijeom isseoyo?' },
  ],
  emergency: [
    { japanese: '助けてください',             korean: '도와주세요',             romanized: 'dowajuseyo' },
    { japanese: '体調が悪いです',             korean: '몸이 안 좋아요',         romanized: 'momi an joayo' },
    { japanese: '病院はどこですか',           korean: '병원이 어디예요?',       romanized: 'byeongwoni eodiyeyo?' },
    { japanese: '警察を呼んでください',       korean: '경찰 좀 불러 주세요',    romanized: 'gyeongchal jom bulleo juseyo' },
    { japanese: '日本大使館はどこですか',     korean: '일본 대사관이 어디예요?', romanized: 'ilbon daesagwani eodiyeyo?' },
    { japanese: '財布を失くしました',         korean: '지갑을 잃어버렸어요',    romanized: 'jigabeul ireobeoryeosseoyo' },
  ],
};
