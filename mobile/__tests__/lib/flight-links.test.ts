/**
 * lib/flight-links.ts 테스트
 * - resolveIata: 도시명 → IATA 코드 변환
 * - buildFlightLinks: URL 빌드 정확성
 */

import { resolveIata, buildFlightLinks } from '@/lib/flight-links';

// ─── resolveIata ──────────────────────────────────────────────────────────────

describe('resolveIata', () => {
  describe('정확 일치', () => {
    it('한국어 도시명', () => {
      expect(resolveIata('도쿄')).toBe('TYO');
      expect(resolveIata('오사카')).toBe('KIX');
      expect(resolveIata('파리')).toBe('CDG');
      expect(resolveIata('뉴욕')).toBe('NYC');
    });

    it('영어 도시명 (소문자)', () => {
      expect(resolveIata('tokyo')).toBe('TYO');
      expect(resolveIata('paris')).toBe('CDG');
      expect(resolveIata('london')).toBe('LON');
      expect(resolveIata('bangkok')).toBe('BKK');
    });

    it('공백 앞뒤 trim 처리', () => {
      expect(resolveIata('  도쿄  ')).toBe('TYO');
      expect(resolveIata(' paris ')).toBe('CDG');
    });
  });

  describe('IATA 코드 직접 입력', () => {
    it('대문자 3자리 IATA 코드는 그대로 반환', () => {
      expect(resolveIata('TYO')).toBe('TYO');
      expect(resolveIata('NRT')).toBe('NRT');
      expect(resolveIata('LAX')).toBe('LAX');
      expect(resolveIata('CDG')).toBe('CDG');
    });
  });

  describe('오기·별칭 처리', () => {
    it('한국어 오기', () => {
      expect(resolveIata('도교')).toBe('TYO');   // 도쿄 오기
      expect(resolveIata('오사까')).toBe('KIX');  // 오사카 오기
    });

    it('영어 별칭', () => {
      expect(resolveIata('ho chi minh city')).toBe('SGN');
      expect(resolveIata('saigon')).toBe('SGN');
      expect(resolveIata('hcmc')).toBe('SGN');
      expect(resolveIata('nyc')).toBe('NYC');
      expect(resolveIata('ny')).toBe('NYC');
      expect(resolveIata('vegas')).toBe('LAS');
    });

    it('공항명 입력', () => {
      expect(resolveIata('나리타')).toBe('NRT');
      expect(resolveIata('하네다')).toBe('HND');
      expect(resolveIata('heathrow')).toBe('LHR');
    });

    it('복합 지역명', () => {
      expect(resolveIata('교토')).toBe('KIX');    // 교토 → 오사카 공항
      expect(resolveIata('홋카이도')).toBe('CTS'); // 홋카이도 → 삿포로 공항
    });
  });

  describe('부분 포함 매칭', () => {
    it('수식어가 붙은 도시명', () => {
      expect(resolveIata('도쿄 3일 여행')).toBe('TYO');
      expect(resolveIata('오사카 자유여행')).toBe('KIX');
      expect(resolveIata('paris trip')).toBe('CDG');
    });
  });

  describe('신규 추가 도시', () => {
    it('동남아 신규', () => {
      expect(resolveIata('푸꾸옥')).toBe('PQC');
      expect(resolveIata('phu quoc')).toBe('PQC');
      expect(resolveIata('끄라비')).toBe('KBV');
      expect(resolveIata('시엠립')).toBe('REP');
      expect(resolveIata('siem reap')).toBe('REP');
    });

    it('유럽 신규', () => {
      expect(resolveIata('피렌체')).toBe('FLR');
      expect(resolveIata('florence')).toBe('FLR');
      expect(resolveIata('두브로브니크')).toBe('DBV');
      expect(resolveIata('코펜하겐')).toBe('CPH');
      expect(resolveIata('헬싱키')).toBe('HEL');
    });

    it('미주 신규', () => {
      expect(resolveIata('보스턴')).toBe('BOS');
      expect(resolveIata('마이애미')).toBe('MIA');
      expect(resolveIata('덴버')).toBe('DEN');
    });

    it('오세아니아 신규', () => {
      expect(resolveIata('퀸스타운')).toBe('ZQN');
      expect(resolveIata('queenstown')).toBe('ZQN');
      expect(resolveIata('브리즈번')).toBe('BNE');
    });
  });

  describe('매핑 없는 경우', () => {
    it('존재하지 않는 도시는 null', () => {
      expect(resolveIata('존재하지않는도시')).toBeNull();
      expect(resolveIata('unknowncity')).toBeNull();
      expect(resolveIata('')).toBeNull();
    });
  });
});

// ─── buildFlightLinks ─────────────────────────────────────────────────────────

describe('buildFlightLinks', () => {
  describe('IATA 매핑 성공 시', () => {
    it('스카이스캐너 URL에 IATA 코드 포함', () => {
      const links = buildFlightLinks('도쿄');
      expect(links.iata).toBe('TYO');
      expect(links.skyscanner).toContain('ICN/TYO');
    });

    it('날짜 없으면 anytime 포함', () => {
      const links = buildFlightLinks('파리');
      expect(links.skyscanner).toContain('anytime');
    });

    it('날짜 있으면 포맷 변환', () => {
      const links = buildFlightLinks('오사카', '2026-10-01');
      expect(links.skyscanner).toContain('261001');  // YYMMDD
      expect(links.kayak).toContain('2026-10-01');   // YYYY-MM-DD
      expect(links.naver).toContain('20261001');      // YYYYMMDD
    });
  });

  describe('IATA 매핑 실패 시', () => {
    it('fallback URL에 인코딩된 도시명 포함', () => {
      const links = buildFlightLinks('알수없는도시');
      expect(links.iata).toBeNull();
      expect(links.skyscanner).toContain(encodeURIComponent('알수없는도시'));
    });
  });
});
