import {
  Fraunces_400Regular,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
} from '@expo-google-fonts/source-sans-3';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';

import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.foam },
          headerTintColor: colors.deepTide,
          headerTitleStyle: { fontFamily: 'SourceSans3_500Medium', fontWeight: '500' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.mist },
        }}
      >
        <Stack.Screen name="demo" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="phase1"
          options={{
            title: 'Calm Down',
            headerShown: false,
            contentStyle: { flex: 1, backgroundColor: colors.mist },
          }}
        />
        <Stack.Screen name="phase2" options={{ title: 'Play Together', headerShown: false }} />
        <Stack.Screen name="datalog" options={{ title: 'Data & Log' }} />
        <Stack.Screen name="benchmark" options={{ title: 'Benchmark Mode' }} />
      </Stack>
    </>
  );
}
