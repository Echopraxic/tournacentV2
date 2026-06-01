import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@/lib/stripe-rn';
import * as Notifications from 'expo-notifications';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const SCREEN_MAP: Record<string, string> = {
  home: '/(tabs)',
  tasks: '/(tabs)/tasks',
  wallet: '/(tabs)/wallet',
  leaderboard: '/(tabs)/leaderboard',
};

export default function RootLayout() {
  useFrameworkReady();
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Navigate to the relevant tab when the user taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen as string | undefined;
        const path = screen ? SCREEN_MAP[screen] : null;
        if (path) router.push(path as any);
      }
    );
    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    // GestureHandlerRootView must be the outermost native view for RNGH to work.
    // ThemeProvider sits inside so useTheme() is available everywhere in the tree.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={STRIPE_PK} urlScheme="tournacent" merchantIdentifier="merchant.com.tournacent.app">
      <ThemeProvider defaultMode="light">
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="join" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
