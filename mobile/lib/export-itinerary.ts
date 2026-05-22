/**
 * 아이티너러리 내보내기 — PDF / 캘린더(.ics).
 *
 * - exportTripPdf: 일정 HTML → expo-print로 PDF 생성 → expo-sharing 공유
 * - exportTripIcs: 장소를 일자별 종일 일정으로 .ics 생성 → 공유(캘린더 앱으로 가져오기)
 *
 * 둘 다 공유 시트(Share Sheet)로 끝나므로 사용자가 저장/전송 위치를 선택한다.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';

import { groupByDay } from '@/lib/trip-utils';
import type { Location, Trip } from '@/lib/types';

// ── 공통 헬퍼 ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** trip.start_date 기준 day_index(1-base)의 날짜를 YYYYMMDD로. 없으면 null. */
function dateForDay(trip: Trip, dayIndex: number): string | null {
  if (!trip.start_date) return null;
  const base = new Date(trip.start_date);
  if (isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + Math.max(0, dayIndex - 1));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// ── PDF ────────────────────────────────────────────────────────────────────────

export async function exportTripPdf(
  trip: Trip,
  locations: Location[],
  lang: string,
): Promise<void> {
  const groups = groupByDay(locations);
  const dayLabel = (n: number) => (lang === 'ko' ? `${n}일차` : `Day ${n}`);

  const dayHtml = groups
    .map((g) => {
      const items = g.locations
        .map(
          (l, i) => `
          <li>
            <span class="num">${i + 1}</span>
            <span class="name">${esc(l.name)}</span>
            ${l.address ? `<div class="addr">${esc(l.address)}</div>` : ''}
            ${l.notes ? `<div class="notes">${esc(l.notes)}</div>` : ''}
          </li>`,
        )
        .join('');
      return `<section><h2>${dayLabel(g.day)}</h2><ul>${items}</ul></section>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>
      * { font-family: -apple-system, "Noto Sans KR", sans-serif; }
      body { padding: 32px; color: #1A1A2E; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      .sub { color: #8a8a9a; font-size: 13px; margin-bottom: 24px; }
      h2 { font-size: 16px; color: #FF5A5F; margin: 20px 0 8px; border-bottom: 2px solid #FFE3E4; padding-bottom: 4px; }
      ul { list-style: none; padding: 0; margin: 0; }
      li { padding: 8px 0; border-bottom: 1px solid #f0f0f3; }
      .num { display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; background: #FF5A5F; color: #fff; border-radius: 11px; font-size: 12px; margin-right: 8px; }
      .name { font-weight: 700; font-size: 15px; }
      .addr { color: #6a6a7a; font-size: 12px; margin: 2px 0 0 30px; }
      .notes { color: #9a9aaa; font-size: 12px; margin: 2px 0 0 30px; font-style: italic; }
    </style></head>
    <body>
      <h1>${esc(trip.title)}</h1>
      <div class="sub">${esc(trip.destination ?? '')}${
        trip.start_date ? ` · ${trip.start_date}${trip.end_date ? ` ~ ${trip.end_date}` : ''}` : ''
      }</div>
      ${dayHtml || `<p>${lang === 'ko' ? '장소가 없습니다.' : 'No places.'}</p>`}
    </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: trip.title });
  }
}

// ── ICS (캘린더) ─────────────────────────────────────────────────────────────

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function exportTripIcs(trip: Trip, locations: Location[]): Promise<void> {
  const now = new Date();
  const dtstamp =
    now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // YYYYMMDDTHHMMSSZ

  const events = locations
    .map((l, idx) => {
      const day = l.day_index ?? 1;
      const date = dateForDay(trip, day);
      if (!date) return null; // 시작일 없으면 일정 생성 불가
      const uid = `triple-${trip.id}-${l.id ?? idx}@triple.app`;
      const summary = icsEscape(l.name);
      const desc = icsEscape([l.address, l.notes].filter(Boolean).join(' / '));
      // 종일 일정: DTEND는 다음날 (ICS 종일 규칙)
      const next = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`);
      next.setDate(next.getDate() + 1);
      const dtend = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${summary}`,
        desc ? `DESCRIPTION:${desc}` : '',
        l.latitude && l.longitude ? `GEO:${l.latitude};${l.longitude}` : '',
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n');
    })
    .filter(Boolean);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triple//Itinerary//KO',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const fileUri = `${cacheDirectory}trip-${trip.id}.ics`;
  await writeAsStringAsync(fileUri, ics, { encoding: EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/calendar',
      dialogTitle: trip.title,
      UTI: 'public.calendar-event',
    });
  }
}
