/** 일본어 회화 정적 사전 — 자주 쓰는 ~35문장. Gemini 자유입력의 폴백·기본 컬렉션. */
export type PhraseCategory =
  | 'greeting' | 'restaurant' | 'shopping' | 'transport' | 'hotel' | 'emergency';

export interface JapanesePhrase {
  korean: string;
  japanese: string;
  romaji: string;
}

export const PHRASE_CATEGORIES: { key: PhraseCategory; label: string; emoji: string }[] = [
  { key: 'greeting',   label: '인사',     emoji: '👋' },
  { key: 'restaurant', label: '음식점',   emoji: '🍜' },
  { key: 'shopping',   label: '쇼핑',     emoji: '🛍️' },
  { key: 'transport',  label: '교통',     emoji: '🚆' },
  { key: 'hotel',      label: '숙소',     emoji: '🏨' },
  { key: 'emergency',  label: '응급',     emoji: '🆘' },
];

export const PHRASES: Record<PhraseCategory, JapanesePhrase[]> = {
  greeting: [
    { korean: '안녕하세요',       japanese: 'こんにちは',           romaji: 'konnichiwa' },
    { korean: '감사합니다',       japanese: 'ありがとうございます',   romaji: 'arigatou gozaimasu' },
    { korean: '죄송합니다',       japanese: 'すみません',           romaji: 'sumimasen' },
    { korean: '잘 부탁드립니다',  japanese: 'よろしくお願いします',   romaji: 'yoroshiku onegaishimasu' },
    { korean: '안녕히 계세요',    japanese: 'さようなら',           romaji: 'sayounara' },
  ],
  restaurant: [
    { korean: '메뉴 주세요',                japanese: 'メニューをください',           romaji: 'menyuu o kudasai' },
    { korean: '추천 메뉴는 뭐예요?',         japanese: 'おすすめは何ですか?',          romaji: 'osusume wa nan desu ka?' },
    { korean: '이거 주세요',                japanese: 'これをください',               romaji: 'kore o kudasai' },
    { korean: '맵지 않게 해주세요',          japanese: '辛くしないでください',          romaji: 'karaku shinaide kudasai' },
    { korean: '계산해 주세요',              japanese: 'お会計お願いします',           romaji: 'okaikei onegaishimasu' },
    { korean: '물 한 잔 주세요',            japanese: 'お水を一杯ください',           romaji: 'omizu o ippai kudasai' },
    { korean: '잘 먹었습니다',              japanese: 'ごちそうさまでした',           romaji: 'gochisousama deshita' },
  ],
  shopping: [
    { korean: '얼마예요?',                  japanese: 'いくらですか?',                romaji: 'ikura desu ka?' },
    { korean: '이거 입어봐도 돼요?',         japanese: 'これ試着してもいいですか?',     romaji: 'kore shichaku shitemo ii desu ka?' },
    { korean: '면세 가능한가요?',           japanese: '免税できますか?',              romaji: 'menzei dekimasu ka?' },
    { korean: '카드 되나요?',               japanese: 'カード使えますか?',            romaji: 'kaado tsukaemasu ka?' },
    { korean: '봉투 하나 주세요',           japanese: '袋をひとつください',           romaji: 'fukuro o hitotsu kudasai' },
    { korean: '둘러봐도 돼요?',             japanese: '見るだけでもいいですか?',       romaji: 'miru dake demo ii desu ka?' },
  ],
  transport: [
    { korean: '신주쿠역까지 어떻게 가요?',  japanese: '新宿駅までどう行きますか?',     romaji: 'shinjuku-eki made dou ikimasu ka?' },
    { korean: '이 표 맞나요?',              japanese: 'この切符で合っていますか?',     romaji: 'kono kippu de atte imasu ka?' },
    { korean: '몇 번 출구로 나가요?',        japanese: '何番出口から出ますか?',        romaji: 'nanban deguchi kara demasu ka?' },
    { korean: 'IC카드 충전하고 싶어요',      japanese: 'ICカードをチャージしたいです',  romaji: 'ai-shii kaado o chaaji shitai desu' },
    { korean: '다음 열차는 언제예요?',       japanese: '次の電車はいつですか?',        romaji: 'tsugi no densha wa itsu desu ka?' },
    { korean: '택시를 불러주세요',           japanese: 'タクシーを呼んでください',     romaji: 'takushii o yonde kudasai' },
  ],
  hotel: [
    { korean: '체크인 부탁드려요',           japanese: 'チェックインお願いします',     romaji: 'chekku-in onegaishimasu' },
    { korean: '와이파이 비밀번호 알려주세요', japanese: 'Wi-Fiのパスワードを教えてください', romaji: 'wai-fai no pasuwaado o oshiete kudasai' },
    { korean: '짐 보관해 주실 수 있나요?',   japanese: '荷物を預かってもらえますか?',   romaji: 'nimotsu o azukatte moraemasu ka?' },
    { korean: '체크아웃 시간은 몇 시예요?',  japanese: 'チェックアウトは何時ですか?',   romaji: 'chekku-auto wa nanji desu ka?' },
    { korean: '근처에 편의점 있어요?',       japanese: '近くにコンビニはありますか?',   romaji: 'chikaku ni konbini wa arimasu ka?' },
  ],
  emergency: [
    { korean: '도와주세요',                 japanese: '助けてください',               romaji: 'tasukete kudasai' },
    { korean: '몸이 안 좋아요',             japanese: '体調が悪いです',               romaji: 'taichou ga warui desu' },
    { korean: '병원이 어디예요?',           japanese: '病院はどこですか?',            romaji: 'byouin wa doko desu ka?' },
    { korean: '경찰을 불러주세요',          japanese: '警察を呼んでください',          romaji: 'keisatsu o yonde kudasai' },
    { korean: '한국 대사관에 연락해 주세요', japanese: '韓国大使館に連絡してください',   romaji: 'kankoku taishikan ni renraku shite kudasai' },
    { korean: '지갑을 잃어버렸어요',         japanese: '財布をなくしました',           romaji: 'saifu o nakushimashita' },
  ],
};
