// ─── 지원 언어 ─────────────────────────────────────────────────────────────────
export type Lang = 'ko' | 'en';

// ─── 번역 사전 ─────────────────────────────────────────────────────────────────
const translations = {
  // ── 공통 ──────────────────────────────────────────────────────────────────
  common: {
    save:      { ko: '저장',     en: 'Save'    },
    cancel:    { ko: '취소',     en: 'Cancel'  },
    edit:      { ko: '편집',     en: 'Edit'    },
    delete:    { ko: '삭제',     en: 'Delete'  },
    confirm:   { ko: '확인',     en: 'Confirm' },
    close:     { ko: '닫기',     en: 'Close'   },
    loading:   { ko: '로딩 중…', en: 'Loading…'},
    error:     { ko: '오류',     en: 'Error'   },
    network:   { ko: '네트워크 오류가 발생했습니다.', en: 'Network error occurred.' },
    or:        { ko: '또는',     en: 'or'      },
    optional:  { ko: '선택',     en: 'optional'},
    dateTbd:   { ko: '날짜 미정', en: 'Date TBD'},
    dateSelect:{ ko: '날짜 선택', en: 'Pick date'},
    version:   { ko: '버전',     en: 'Version' },
    platform:  { ko: '플랫폼',   en: 'Platform'},
  },

  // ── 오프라인 배너 ──────────────────────────────────────────────────────────
  offline: {
    banner:   { ko: '오프라인 • 로컬 데이터 표시 중', en: 'Offline • Showing local data' },
    restored: { ko: '온라인 • 데이터 동기화 완료',    en: 'Online • Data synced'         },
  },

  // ── 인증 ──────────────────────────────────────────────────────────────────
  auth: {
    appName:       { ko: '트리플',               en: 'Triple'                  },
    appTagline:    { ko: 'AI 여행 플래너',        en: 'AI Travel Planner'       },
    email:         { ko: '이메일',               en: 'Email'                   },
    emailHolder:   { ko: 'example@email.com',    en: 'example@email.com'       },
    password:      { ko: '비밀번호',              en: 'Password'                },
    passwordHolder:{ ko: '비밀번호를 입력해주세요', en: 'Enter your password'    },
    nickname:      { ko: '닉네임',               en: 'Nickname'                },
    nicknameHolder:{ ko: '표시될 이름',           en: 'Display name'            },
    login:         { ko: '로그인',               en: 'Log in'                  },
    loginFail:     { ko: '로그인에 실패했습니다.', en: 'Login failed.'           },
    register:      { ko: '회원가입',              en: 'Sign up'                 },
    registerFail:  { ko: '회원가입에 실패했습니다.',en: 'Registration failed.'   },
    createAccount: { ko: '새 계정 만들기',        en: 'Create account'          },
    alreadyAccount:{ ko: '이미 계정이 있으신가요?', en: 'Already have an account?'},
    backToLogin:   { ko: '로그인으로 돌아가기',    en: 'Back to login'           },
    fillAll:       { ko: '모든 항목을 입력해주세요.', en: 'Please fill in all fields.' },
    fillEmailPass: { ko: '이메일과 비밀번호를 입력해주세요.', en: 'Please enter email and password.' },
    logout:        { ko: '로그아웃',              en: 'Log out'                 },
    logoutConfirm: { ko: '정말 로그아웃하시겠어요?', en: 'Are you sure you want to log out?' },
    logoutTitle:   { ko: '로그아웃',              en: 'Log out'                 },
  },

  // ── 홈 (여행 목록) ─────────────────────────────────────────────────────────
  home: {
    title:         { ko: '내 여행',              en: 'My Trips'                },
    subtitle:      { ko: '여행 계획을 관리해보세요', en: 'Manage your travel plans' },
    searchHolder:  { ko: '여행 검색…',            en: 'Search trips…'           },
    noTrips:       { ko: '아직 여행이 없어요',     en: 'No trips yet'            },
    noTripsHint:   { ko: '+ 버튼을 눌러\n첫 번째 여행을 시작해보세요', en: 'Tap + to start\nyour first trip' },
    noResults:     { ko: '검색 결과가 없어요',     en: 'No results found'        },
    noResultsHint: { ko: '에 대한 여행을 찾을 수 없어요', en: 'No trips found for'  },
    seeDetail:     { ko: '자세히 보기',            en: 'See details'             },
    syncing:       { ko: '동기화 중…',            en: 'Syncing…'                },
    createTrip:    { ko: '새 여행 만들기',         en: 'New Trip'                },
    createSubtitle:{ ko: '여행 정보를 입력해주세요', en: 'Enter trip details'      },
    editTrip:      { ko: '여행 정보 수정',         en: 'Edit Trip'               },
    editSubtitle:  { ko: '수정할 내용을 입력해주세요', en: 'Update trip details'   },
    tripName:      { ko: '여행명',                en: 'Trip name'               },
    tripNameHolder:{ ko: '예: 도쿄 봄 여행 🌸',   en: 'e.g. Tokyo Spring 🌸'    },
    tripNameHolderEdit: { ko: '여행 이름', en: 'Trip name' },
    duration:      { ko: '여행 기간',             en: 'Duration'                },
    departure:     { ko: '출발일',               en: 'Departure'               },
    return_:       { ko: '귀국일',               en: 'Return'                  },
    editInfo:      { ko: '✏️ 정보 수정',          en: '✏️ Edit'                 },
    deleteTrip:    { ko: '🗑️ 삭제',              en: '🗑️ Delete'               },
    deleteConfirm: { ko: '이 여행을 삭제할까요?',   en: 'Delete this trip?'       },
    deleteMsg:     { ko: '삭제하면 되돌릴 수 없어요.', en: 'This cannot be undone.'  },
    createBtn:     { ko: '만들기',               en: 'Create'                  },
    saveBtn:       { ko: '저장하기',              en: 'Save'                    },
    iosConfirm:    { ko: '확인',                  en: 'Done'                    },
  },

  // ── 여행 상세 ──────────────────────────────────────────────────────────────
  detail: {
    back:          { ko: '← 내 여행',            en: '← My Trips'              },
    locations:     { ko: '방문 장소',             en: 'Places'                  },
    totalPlaces:   { ko: '총',                   en: 'Total'                   },
    places:        { ko: '곳',                   en: 'places'                  },
    noPlaces:      { ko: '장소가 없어요',          en: 'No places yet'           },
    noPlacesHint:  { ko: '+ 버튼으로 장소를 추가해보세요', en: 'Tap + to add places'  },
    addPlace:      { ko: '장소 추가',             en: 'Add Place'               },
    addSubtitle:   { ko: '방문할 장소 정보를 입력해주세요', en: 'Enter place details'   },
    placeName:     { ko: '장소명',               en: 'Place name'              },
    placeHolder:   { ko: '예: 도쿄 타워',         en: 'e.g. Tokyo Tower'        },
    address:       { ko: '주소',                 en: 'Address'                 },
    addressHolder: { ko: '예: 일본 도쿄 미나토구',  en: 'e.g. 4-2-8 Shibakoen, Tokyo' },
    category:      { ko: '카테고리',              en: 'Category'                },
    notes:         { ko: '메모 (선택)',           en: 'Notes (optional)'        },
    notesHolder:   { ko: '방문 메모를 입력해주세요', en: 'Add visit notes…'       },
    deleteTrip:    { ko: '이 여행 삭제',           en: 'Delete Trip'             },
    deleteConfirm: { ko: '여행을 삭제할까요?\n장소 정보도 모두 삭제돼요.',
                     en: 'Delete this trip?\nAll places will be removed.' },
    map:           { ko: '지도',                 en: 'Map'                     },
  },

  // ── 카테고리 ───────────────────────────────────────────────────────────────
  categories: {
    숙소:         { ko: '숙소',        en: 'Lodging'        },
    음식점:       { ko: '음식점',      en: 'Restaurant'     },
    관광지:       { ko: '관광지',      en: 'Attraction'     },
    카페:         { ko: '카페',        en: 'Café'           },
    쇼핑:         { ko: '쇼핑',        en: 'Shopping'       },
    자연:         { ko: '자연',        en: 'Nature'         },
    문화:         { ko: '문화',        en: 'Culture'        },
    엔터테인먼트:  { ko: '엔터테인먼트', en: 'Entertainment'  },
  },

  // ── AI 추천 ────────────────────────────────────────────────────────────────
  explore: {
    title:         { ko: 'AI 추천',               en: 'AI Suggest'              },
    subtitle:      { ko: 'AI가 최적의 여행 코스를 만들어드려요', en: 'Let AI plan your perfect trip' },
    destination:   { ko: '여행지',                en: 'Destination'             },
    destHolder:    { ko: '예: 도쿄, 파리, 뉴욕…',  en: 'e.g. Tokyo, Paris, NYC…' },
    days:          { ko: '여행 일수',              en: 'Duration'                },
    day:           { ko: '일',                    en: 'd'                       },
    preferences:   { ko: '취향 (선택)',            en: 'Preferences (optional)'  },
    prefHolder:    { ko: '예: 맛집 위주, 역사 문화, 자연 힐링…', en: 'e.g. food, history, nature…' },
    recommend:     { ko: 'AI 추천 받기',           en: 'Get AI Recommendation'   },
    recommending:  { ko: 'AI가 코스를 생성 중이에요…', en: 'AI is crafting your trip…' },
    saveTrip:      { ko: '이 일정으로 여행 저장',   en: 'Save This Itinerary'     },
    savingTrip:    { ko: '저장 중…',              en: 'Saving…'                 },
    saved:         { ko: '여행이 저장됐어요!',       en: 'Trip saved!'             },
    savedMsg:      { ko: '내 여행 탭에서 확인해보세요.', en: 'Check it in My Trips.' },
    goTrips:       { ko: '내 여행으로 가기',         en: 'Go to My Trips'          },
    fillDest:      { ko: '여행지를 입력해주세요.',    en: 'Please enter a destination.' },
    noResult:      { ko: 'AI 추천 결과가 없어요',    en: 'No AI result'            },
    noResultHint:  { ko: '다른 여행지나 취향을 입력해보세요', en: 'Try a different destination' },
  },

  // ── 프로필 ─────────────────────────────────────────────────────────────────
  profile: {
    title:         { ko: '프로필',               en: 'Profile'                 },
    subtitle:      { ko: '내 계정 정보',           en: 'My Account'              },
    language:      { ko: '언어',                 en: 'Language'                },
    langKo:        { ko: '한국어',               en: '한국어'                   },
    langEn:        { ko: 'English',             en: 'English'                 },
    darkMode:      { ko: '다크 모드',             en: 'Dark Mode'               },
    notices:       { ko: '공지사항',              en: 'Notices'                 },
    privacy:       { ko: '개인정보처리방침',       en: 'Privacy Policy'          },
    terms:         { ko: '이용약관',              en: 'Terms of Service'        },
    settings:      { ko: '설정',                 en: 'Settings'               },
  },

  // ── 탭바 ──────────────────────────────────────────────────────────────────
  tabs: {
    home:    { ko: '내 여행', en: 'Trips'   },
    explore: { ko: 'AI 추천', en: 'AI'      },
    saved:   { ko: '보관함',  en: 'Saved'   },
    profile: { ko: '프로필',  en: 'Profile' },
  },

  // ── 보관함 ────────────────────────────────────────────────────────────────
  savedTab: {
    title:      { ko: '보관함',                    en: 'Saved Places'          },
    subtitle:   { ko: '찜한 장소를 모아보세요',    en: 'Your bookmarked places' },
    empty:      { ko: '아직 찜한 장소가 없어요',   en: 'No saved places yet'    },
    emptySub:   { ko: 'AI 추천 탭에서 장소를 찜해보세요', en: 'Bookmark places from AI recommendations' },
    addToTrip:  { ko: '여행에 추가',               en: 'Add to Trip'           },
    remove:     { ko: '보관함에서 삭제',            en: 'Remove from saved'     },
    selectTrip: { ko: '어떤 여행에 추가할까요?',   en: 'Which trip to add to?' },
    selectDay:  { ko: '몇 번째 날에 추가할까요?',  en: 'Which day to add to?'  },
    added:      { ko: '여행에 추가됐어요!',        en: 'Added to trip!'        },
  },
} as const;

// ─── 타입 유틸리티 ─────────────────────────────────────────────────────────────
type TranslationMap = typeof translations;
type Section = keyof TranslationMap;
type Key<S extends Section> = keyof TranslationMap[S];

// ─── 번역 함수 팩토리 ──────────────────────────────────────────────────────────
export function createTranslator(lang: Lang) {
  return function t<S extends Section>(section: S, key: Key<S>): string {
    const entry = translations[section][key] as { ko: string; en: string };
    return entry[lang];
  };
}

// ─── 편의 훅 (컴포넌트에서 useSettings()와 함께 사용) ─────────────────────────
export { translations };
