import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSessionStore } from "./src/store/useSessionStore";
import { postAuthSync } from "./src/services/api";
import { signInAnonymously } from "./src/services/auth";
import { supabase } from "./src/lib/supabase";
import type { User } from "./src/types";

// Screens
import AuthScreen from "./src/screens/AuthScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import DecideScreen from "./src/screens/DecideScreen";
import DebugScreen from "./src/screens/DebugScreen";
import CheckInScreen from "./src/screens/CheckInScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import RecommendationDetailScreen from "./src/screens/RecommendationDetailScreen";
import TrustNetworkScreen from "./src/screens/TrustNetworkScreen";
import MapSurface from "./src/screens/MapSurface";

// Components
import DevNavOverlay from "./src/components/DevNavOverlay";

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

export default function App(): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const user = useSessionStore((s) => s.user);
  const initialize = useSessionStore((s) => s.initialize);
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // Zero-input bootstrap: create an anonymous Supabase session when no session exists.
  useEffect(() => {
    let cancelled = false;

    const bootstrapAnonymous = async (): Promise<void> => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          await signInAnonymously();
        }
      } catch (err) {
        console.warn("[App] Anonymous auth bootstrap failed:", err);
      } finally {
        if (!cancelled) {
          setAuthBootstrapComplete(true);
        }
      }
    };

    bootstrapAnonymous();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync user profile from backend after Supabase auth is confirmed.
  // Falls back to Supabase metadata when backend is unreachable (dev mode).
  useEffect(() => {
    if (!isAuthenticated || user !== null) return;

    const syncUser = async () => {
      // 1. Try backend
      try {
        const resp = await postAuthSync({});
        if (resp.data) {
          useSessionStore.getState().setUser(resp.data);
          return;
        }
      } catch {
        console.warn("[App] Backend sync failed — attempting Supabase metadata fallback");
      }

      // 2. Fallback: build user from Supabase auth metadata
      try {
        const { data: { user: supaUser } } = await supabase.auth.getUser();
        if (supaUser) {
          const meta = supaUser.user_metadata ?? {};
          const isAnonymous = Boolean((supaUser as { is_anonymous?: boolean }).is_anonymous);

          const localUser: User = {
            id: supaUser.id,
            username: meta.username ?? (isAnonymous ? "guest" : supaUser.phone ?? null),
            name: meta.display_name ?? meta.username ?? (isAnonymous ? "Guest" : "User"),
            email: supaUser.email ?? null,
            home_city: "",
            onboarding_complete: isAnonymous,
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString(),
          };
          useSessionStore.getState().setUser(localUser);
        }
      } catch (err) {
        console.warn("[App] Supabase metadata fallback failed:", err);
      }
    };

    syncUser();
  }, [isAuthenticated, user]);

  /**
   * REFINED NAVIGATION LOGIC
   * 1. If no user exists (real or mock) -> Auth.
   * 2. If user exists but onboarding is incomplete -> Onboarding.
   * 3. If user exists and onboarding is done -> Home stack.
   */
  const hasUser = user !== null;
  const showHome = hasUser && user.onboarding_complete;
  const showOnboarding = hasUser && !user.onboarding_complete;
  const waitingForUserSync = authBootstrapComplete && isAuthenticated && !hasUser;

  if (!authBootstrapComplete || waitingForUserSync) {
    return (
      <>
        <StatusBar style="light" />
        <QueryClientProvider client={queryClient}>
          <View style={styles.bootstrapContainer}>
            <ActivityIndicator size="small" color="#F59E0B" />
          </View>
        </QueryClientProvider>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {showHome ? (
              <Stack.Group>
                <Stack.Screen name="Home" component={DecideScreen} />
                <Stack.Screen name="CheckIn" component={CheckInScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="RecommendationDetail" component={RecommendationDetailScreen} />
                <Stack.Screen
                  name="MapSurface"
                  component={MapSurface}
                  options={{ animation: "slide_from_bottom" }}
                />
                <Stack.Screen name="TrustNetwork" component={TrustNetworkScreen} />
                <Stack.Screen name="Debug" component={DebugScreen} />
              </Stack.Group>
            ) : showOnboarding ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : (
              <Stack.Screen name="Auth">
                {(props) => (
                  <AuthScreen
                    {...props}
                    onBypass={() => {
                      // Injecting mock user with onboarding_complete: false
                      // forces the app into the Onboarding flow.
                      useSessionStore.getState().setUser({
                        id: "dev-user-id",
                        username: "daniel_meier",
                        name: "Daniel",
                        onboarding_complete: false,
                      } as any);
                    }}
                  />
                )}
              </Stack.Screen>
            )}
          </Stack.Navigator>

          {/* Floating Dev Menu: Active only in __DEV__ mode */}
          <DevNavOverlay />
        </NavigationContainer>
      </QueryClientProvider>
    </>
  );
}

const styles = StyleSheet.create({
  bootstrapContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
});
