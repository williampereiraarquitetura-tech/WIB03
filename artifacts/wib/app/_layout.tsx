import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import type { Session } from "@supabase/supabase-js";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { API_URL } from "@/config/api";
import { supabase } from "@/config/supabase";
import { setupNotifications } from "@/services/notifications";

setBaseUrl(API_URL);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RootLayoutNav({ session }: { session: Session | null }) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#050505" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="auth/login" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="inbox" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="tarefas" options={{ headerShown: false }} />
      <Stack.Screen name="assistente" options={{ headerShown: false }} />
      <Stack.Screen name="memorias" options={{ headerShown: false }} />
      <Stack.Screen name="projeto/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="novo-projeto" options={{ headerShown: false, presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthReady(true);
      if (s) {
        setAuthTokenGetter(async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        });
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        setAuthTokenGetter(async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        });
        // Invalidate all cached queries on login so fresh user data is fetched
        queryClient.invalidateQueries();
      } else {
        setAuthTokenGetter(null);
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Navigate based on auth state once fonts and auth are ready
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    if (!authReady) return;
    if (navigatedRef.current) return;

    navigatedRef.current = true;
    SplashScreen.hideAsync();

    if (session) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/login");
    }
  }, [fontsLoaded, fontError, authReady, session]);

  useEffect(() => {
    setupNotifications();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen === "inbox") router.push("/inbox");
      else if (screen === "captura") router.push("/(tabs)/captura");
    });
    return () => sub.remove();
  }, []);

  if ((!fontsLoaded && !fontError) || !authReady) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav session={session} />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
