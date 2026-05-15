/**
 * Expo Router 딥링크 인텐트 핸들러 (U8)
 *
 * 지원하는 URL 스킴:
 *   monotrip://trips/123                   → /trips/123
 *   monotrip://share/{token}               → /trips/shared/{token}
 *   https://monotrip.app/share/{token}     → /trips/shared/{token}  (Universal Link 준비)
 *
 * Expo Router가 이 파일을 자동으로 인식하여 알 수 없는 URL을
 * determineInitialURL·linking 단계에서 이 함수로 라우팅한다.
 *
 * 참고: https://docs.expo.dev/router/reference/native-intent/
 */

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    // ── monotrip://trips/123 ───────────────────────────────────────────────
    const tripsMatch = path.match(/^\/trips\/(\d+)(\/.*)?$/);
    if (tripsMatch) {
      const tripId = tripsMatch[1];
      const rest   = tripsMatch[2] ?? '';
      return `/trips/${tripId}${rest}`;
    }

    // ── monotrip://share/{token} ──────────────────────────────────────────
    const shareMatch = path.match(/^\/share\/([A-Za-z0-9_-]+)$/);
    if (shareMatch) {
      return `/trips/shared/${shareMatch[1]}`;
    }

    // ── https://monotrip.app/share/{token} (Universal Link) ───────────────
    const universalShareMatch = path.match(/\/share\/([A-Za-z0-9_-]+)$/);
    if (universalShareMatch) {
      return `/trips/shared/${universalShareMatch[1]}`;
    }

    // ── 나머지: 홈으로 ─────────────────────────────────────────────────────
    return initial ? '/' : path;
  } catch {
    return '/';
  }
}
