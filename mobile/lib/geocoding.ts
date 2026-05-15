/**
 * 구글 Geocoding & Places API 유틸리티
 * REST API 호출 방식 — Expo Go에서도 동작 (네이티브 SDK 불필요)
 */

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export interface GeoResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// ─── 주소 → 좌표 변환 (Google Geocoding API) ──────────────────────────────────
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_KEY || GOOGLE_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return null;
  try {
    const q = encodeURIComponent(address);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${GOOGLE_KEY}`,
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch { /* 네트워크 오류 무시 */ }
  return null;
}

// ─── 좌표 → 주소 변환 (Reverse Geocoding) ────────────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_KEY || GOOGLE_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`,
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].formatted_address as string;
    }
  } catch { /* 무시 */ }
  return null;
}

// ─── 텍스트 장소 검색 (Places Text Search) ────────────────────────────────────
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!GOOGLE_KEY || GOOGLE_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return [];
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&key=${GOOGLE_KEY}&language=ko`,
    );
    const data = await res.json();
    if (data.status === 'OK') {
      return (data.results as Record<string, unknown>[]).slice(0, 5).map((place) => ({
        name: place.name as string,
        address: place.formatted_address as string,
        latitude: (place.geometry as { location: { lat: number; lng: number } }).location.lat,
        longitude: (place.geometry as { location: { lat: number; lng: number } }).location.lng,
      }));
    }
  } catch { /* 무시 */ }
  return [];
}

// ─── 주변 장소 검색 (Google Places Nearby Search) — UP-10 ─────────────────────

export interface NearbyPlace {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;     // 매핑된 한국어 카테고리
  rating: number | null;
  user_ratings_total: number | null;
  open_now: boolean | null;
  price_level: number | null;  // 0~4
  photos: string[];             // 최대 1개 (photo_reference)
}

const TYPE_MAP: Record<string, string> = {
  restaurant: '음식점',
  cafe: '카페',
  tourist_attraction: '관광지',
  shopping_mall: '쇼핑',
  lodging: '숙소',
  museum: '문화',
  park: '자연',
  amusement_park: '액티비티',
  bar: '음식점',
  food: '음식점',
  establishment: '관광지',
};

function mapType(types: string[]): string {
  for (const t of types) {
    if (TYPE_MAP[t]) return TYPE_MAP[t];
  }
  return '관광지';
}

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  radius = 1500,
  type?: string,
): Promise<NearbyPlace[]> {
  if (!GOOGLE_KEY || GOOGLE_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') return [];
  try {
    const typeParam = type ? `&type=${type}` : '';
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}${typeParam}&key=${GOOGLE_KEY}&language=ko`,
    );
    const data = await res.json();
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return ((data.results ?? []) as Record<string, unknown>[]).slice(0, 20).map((p) => ({
        place_id: p.place_id as string,
        name: p.name as string,
        address: ((p.vicinity ?? p.formatted_address ?? '') as string),
        latitude: (p.geometry as { location: { lat: number; lng: number } }).location.lat,
        longitude: (p.geometry as { location: { lat: number; lng: number } }).location.lng,
        category: mapType((p.types ?? []) as string[]),
        rating: (p.rating ?? null) as number | null,
        user_ratings_total: (p.user_ratings_total ?? null) as number | null,
        open_now: ((p.opening_hours as { open_now?: boolean } | null)?.open_now ?? null),
        price_level: (p.price_level ?? null) as number | null,
        photos: (p.photos as { photo_reference: string }[])
          ? [(p.photos as { photo_reference: string }[])[0].photo_reference]
          : [],
      }));
    }
  } catch { /* 무시 */ }
  return [];
}

// ─── API 키 설정 여부 확인 ─────────────────────────────────────────────────────
export function hasGoogleKey(): boolean {
  return Boolean(GOOGLE_KEY) && GOOGLE_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY';
}
