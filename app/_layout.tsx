import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0B0B12' },
          headerTintColor: '#F5F5FA',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0B0B12' },
        }}
      >
        <Stack.Screen name="demo" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Setup' }} />
        <Stack.Screen name="phase1" options={{ title: 'Phase 1 — Touch' }} />
        <Stack.Screen name="phase2" options={{ title: 'Phase 2 — Dyadic' }} />
        <Stack.Screen name="datalog" options={{ title: 'Data & Log' }} />
        <Stack.Screen name="benchmark" options={{ title: 'Benchmark Mode' }} />
      </Stack>
    </>
  );
}
