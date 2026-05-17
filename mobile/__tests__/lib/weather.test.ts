/**
 * lib/weather.ts 테스트
 * fetchWeather는 네트워크를 사용하므로 mock 처리.
 * codeToEmoji는 내부 함수이므로 fetchWeather의 current.icon으로 간접 검증.
 */

import { fetchWeather } from '@/lib/weather';

// fetch mock
global.fetch = jest.fn();

const makeMockResponse = (weatherCode: string) => ({
  ok: true,
  json: async () => ({
    current_condition: [{
      temp_C: '20',
      FeelsLikeC: '18',
      humidity: '60',
      weatherDesc: [{ value: 'Partly cloudy' }],
      weatherCode,
      windspeedKmph: '15',
    }],
    weather: [
      {
        date: '2026-04-01',
        maxtempC: '25',
        mintempC: '15',
        avgtempC: '20',
        hourly: Array(8).fill({
          weatherCode: '116',
          weatherDesc: [{ value: 'Partly cloudy' }],
          chanceofrain: '10',
        }),
      },
    ],
  }),
});

describe('fetchWeather', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('현재 날씨와 예보를 반환', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('113'));

    const data = await fetchWeather('Tokyo');
    expect(data.location).toBe('Tokyo');
    expect(data.current.temp_c).toBe(20);
    expect(data.current.humidity).toBe(60);
    expect(data.forecast).toHaveLength(1);
    expect(typeof data.fetched_at).toBe('number');
  });

  it('맑음 코드(113) → ☀️ 이모지', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('113'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('☀️');
  });

  it('구름 코드(116) → ⛅ 이모지', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('116'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('⛅');
  });

  it('비 코드(293) → 🌧️ 이모지', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('293'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('🌧️');
  });

  it('눈 코드(179) → 🌨️ 이모지', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('179'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('🌨️');
  });

  it('뇌우 코드(200) → ⛈️ 이모지', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('200'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('⛈️');
  });

  it('알 수 없는 코드(999) → 🌤️ 기본값', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('999'));
    const data = await fetchWeather('Seoul');
    expect(data.current.icon).toBe('🌤️');
  });

  it('wttr.in API 오류 시 throw', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchWeather('Seoul')).rejects.toThrow('503');
  });

  it('URL에 도시명 encodeURIComponent 적용', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeMockResponse('113'));
    await fetchWeather('New York');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('New York')),
      expect.any(Object),
    );
  });
});
