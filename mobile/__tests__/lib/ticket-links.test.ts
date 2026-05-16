/**
 * lib/ticket-links.ts 테스트
 * - buildTicketLinks: URL 빌드
 * - isTicketable: 카테고리 판별
 */

import { buildTicketLinks, isTicketable } from '@/lib/ticket-links';

describe('buildTicketLinks', () => {
  it('모든 플랫폼 URL 반환', () => {
    const links = buildTicketLinks('센소지 사원', '도쿄');
    expect(links).toHaveProperty('klook');
    expect(links).toHaveProperty('kkday');
    expect(links).toHaveProperty('myrealtrip');
    expect(links).toHaveProperty('viator');
  });

  it('장소명 + 도시명이 쿼리에 포함', () => {
    const links = buildTicketLinks('에펠탑', '파리');
    const query = encodeURIComponent('에펠탑 파리');
    expect(links.klook).toContain(query);
    expect(links.kkday).toContain(query);
    expect(links.myrealtrip).toContain(query);
  });

  it('viator는 장소·도시 별도 인코딩', () => {
    const links = buildTicketLinks('Eiffel Tower', 'Paris');
    expect(links.viator).toContain(encodeURIComponent('Eiffel Tower'));
    expect(links.viator).toContain(encodeURIComponent('Paris'));
  });

  it('특수문자 인코딩', () => {
    const links = buildTicketLinks("Saint-Malo", 'Brittany');
    expect(links.klook).toContain(encodeURIComponent('Saint-Malo Brittany'));
  });
});

describe('isTicketable', () => {
  it('티켓 대상 카테고리 true', () => {
    expect(isTicketable('관광지')).toBe(true);
    expect(isTicketable('액티비티')).toBe(true);
    expect(isTicketable('문화')).toBe(true);
    expect(isTicketable('엔터테인먼트')).toBe(true);
  });

  it('티켓 비대상 카테고리 false', () => {
    expect(isTicketable('음식점')).toBe(false);
    expect(isTicketable('숙소')).toBe(false);
    expect(isTicketable('카페')).toBe(false);
    expect(isTicketable('쇼핑')).toBe(false);
    expect(isTicketable('자연')).toBe(false);
    expect(isTicketable('')).toBe(false);
    expect(isTicketable('알수없음')).toBe(false);
  });
});
