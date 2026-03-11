import 'react-native-gesture-handler'; // CRITICAL: Must be the very first import
import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from './src/lib/navigationRef';
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Fixed: Added Root View

import type { RootStackParamList } from "./src/types";
import { useSessionStore } from "./src/store/useSessionStore";
import { signInAnonymously } from "./src/services/auth";
import { supabase } from "./src/lib/supabase";

// Screens
import AuthScreen from "./src/screens/AuthScreen";
import ZeroAuthOnboardingScreen from "./src/screens/ZeroAuthOnboardingScreen";
import DecideScreen from "./src/screens/DecideScreen";
import DebugScreen from "./src/screens/DebugScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import RecommendationDetailScreen from "./src/screens/RecommendationDetailScreen";
import TrustNetworkScreen from "./src/screens/TrustNetworkScreen";
import MapSurface from "./src/screens/MapSurface";

// Components
import DevNavOverlay from "./src/components/DevNavOverlay";

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

export default function App(): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const user = useSessionStore((s) => s.user);
  const initialize = useSessionStore((s) => s.initialize);
  const authLoading = useSessionStore((s) => s.authLoading);
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
        const { data: { session } } = await supabase.auth.getSession();
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
    return () => { cancelled = true; };
  }, []);

  // Note: user sync (postAuthSync → syncOrFallback) is owned entirely by
  // AuthScreen.tsx. The isAuthenticated && !user useEffect there handles all
  // auth paths (Google, phone OTP, email). A duplicate sync here was causing
  // startup warnings and a race condition that triggered the 401 interceptor.

  const hasUser = user !== null;
  const showHome = hasUser && user.onboarding_complete;
  // Single onboarding flag — covers both anonymous sessions (no HADE user) and
  // authenticated users who have not yet completed onboarding.
  // Both paths now lead to the same Modern McGee ZeroAuth 3-step flow.
  const showOnboarding = isAuthenticated && !showHome;

  if (!authBootstrapComplete) {
    return (
      <View style={styles.bootstrapContainer}>
        <ActivityIndicator size="small" color="#F59E0B" />
      </View>
    );
  }

  // Overlay during Google OAuth handshake — prevents navigation flicker
  // while exchangeCodeForSession + backend sync are in-flight.
  if (authLoading && !user) {
    return (
      <View style={styles.bootstrapContainer}>
        <ActivityIndicator size="small" color="#F59E0B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {showHome ? (
              <Stack.Group>
                <Stack.Screen name="Home" component={DecideScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="RecommendationDetail" component={RecommendationDetailScreen} />
                <Stack.Screen
                  name="MapSurface"
                  component={MapSurface}
                  options={{ 
                    animation: "slide_from_bottom",
                    presentation: 'fullScreenModal',
                    gestureEnabled: false 
                  }}
                />
                <Stack.Screen name="TrustNetwork" component={TrustNetworkScreen} />
                <Stack.Screen name="Debug" component={DebugScreen} />
              </Stack.Group>
            ) : showOnboarding ? (
              <Stack.Screen name="Onboarding" component={ZeroAuthOnboardingScreen} />
            ) : (
              <Stack.Screen name="Auth">
                {(props) => (
                  <AuthScreen
                    {...props}
                    onBypass={() => {
                      useSessionStore.getState().setUser({
                        id: "64c235fc-008e-401a-84c4-cc7b9b134bcf",
                        username: "daniel_meier",
                        name: "Daniel",
                        onboarding_complete: true, // Bypass to home
                      } as any);
                    }}
                  />
                )}
              </Stack.Screen>
            )}
          </Stack.Navigator>
          <DevNavOverlay />
        </NavigationContainer>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bootstrapContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
});