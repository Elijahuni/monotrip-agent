/**
 * wttr.in 무료 날씨 API 래퍼 (U11)
 *
 * API: https://wttr.in/{destination}?format=j1
 * - 인증 키 불필요
 * - JSON 응답: 현재 날씨 + 3일 예보
 * - 한계: 분당 50회 정도 허용 (개인 사용에 충분)
 */

export interface CurrentWeather {
  temp_c: number;
  feels_like_c: number;
  humidity: number;        // %
  description: string;     // "Partly cloudy"
  icon: string;            // 날씨 이모지
  wind_kph: number;
  weather_code: number;    // wttr.in weatherCode (비/눈 감지용)
}

export interface WeatherForecast {
  date: string;            // "YYYY-MM-DD"
  max_c: number;
  min_c: number;
  avg_c: number;
  icon: string;
  description: string;
  chance_of_rain: number;  // %
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  forecast: WeatherForecast[];  // 3일
  fetched_at: number;           // Date.now()
}

// ─── 조건 코드 → 이모지 매핑 ──────────────────────────────────────────────────
// Set으로 모듈 상수화: 함수 호출마다 배열이 재생성되는 것을 방지 (O(n)→O(1))

const CODES_CLOUDY   = new Set([119, 122]);
const CODES_FOG      = new Set([143, 248, 260]);
const CODES_RAIN     = new Set([176, 293, 296, 299, 302, 305, 308, 353, 356, 359]);
const CODES_SNOW     = new Set([179, 182, 185, 281, 284, 311, 314, 317, 320, 362, 365, 374, 377]);
const CODES_THUNDER  = new Set([200, 386, 389, 392, 395]);
const CODES_DRIZZLE  = new Set([263, 266]);

function codeToEmoji(code: number): string {
  if (code === 113) return '☀️';
  if (code === 116) return '⛅';
  if (CODES_CLOUDY.has(code))  return '☁️';
  if (CODES_FOG.has(code))     return '🌫️';
  if (CODES_RAIN.has(code))    return '🌧️';
  if (CODES_SNOW.has(code))    return '🌨️';
  if (CODES_THUNDER.has(code)) return '⛈️';
  if (CODES_DRIZZLE.has(code)) return '🌦️';
  return '🌤️';
}

// ─── API 호출 ─────────────────────────────────────────────────────────────────

interface WttrJson {
  current_condition: Array<{
    temp_C: string;
    FeelsLikeC: string;
    humidity: string;
    weatherDesc: Array<{ value: string }>;
    weatherCode: string;
    windspeedKmph: string;
  }>;
  weather: Array<{
    date: string;
    maxtempC: string;
    mintempC: string;
    avgtempC: string;
    hourly: Array<{
      weatherCode: string;
      weatherDesc: Array<{ value: string }>;
      chanceofrain: string;
    }>;
  }>;
}

export async function fetchWeather(destination: string): Promise<WeatherData> {
  const encoded = encodeURIComponent(destination);
  const res = await fetch(`https://wttr.in/${encoded}?format=j1`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`wttr.in responded ${res.status}`);
  }
  const json: WttrJson = await res.json();

  const cur = json.current_condition[0];
  const code = Number(cur.weatherCode);

  const current: CurrentWeather = {
    temp_c:       Number(cur.temp_C),
    feels_like_c: Number(cur.FeelsLikeC),
    humidity:     Number(cur.humidity),
    description:  cur.weatherDesc[0]?.value ?? '',
    icon:         codeToEmoji(code),
    wind_kph:     Number(cur.windspeedKmph),
    weather_code: code,
  };

  const forecast: WeatherForecast[] = json.weather.slice(0, 3).map((day) => {
    // 낮 시간대 (index 4 = 14:00) 코드 사용
    const midDay = day.hourly[4] ?? day.hourly[0];
    const fc: WeatherForecast = {
      date:             day.date,
      max_c:            Number(day.maxtempC),
      min_c:            Number(day.mintempC),
      avg_c:            Number(day.avgtempC),
      icon:             codeToEmoji(Number(midDay.weatherCode)),
      description:      midDay.weatherDesc[0]?.value ?? '',
      chance_of_rain:   Number(midDay.chanceofrain),
    };
    return fc;
  });

  return {
    location: destination,
    current,
    forecast,
    fetched_at: Date.now(),
  };
}
