import { Stack } from 'expo-router';

/**
 * trips/* 전체 헤더 숨김.
 * 각 화면(trips/[id]/index.tsx 등)이 자체 헤더를 구현한다.
 */
export default function TripsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
