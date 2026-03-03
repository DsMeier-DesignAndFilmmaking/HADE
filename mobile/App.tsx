import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSessionStore } from "./src/store/useSessionStore";
import { postAuthSync } from "./src/services/api";
import AuthScreen from "./src/screens/AuthScreen";
import DecideScreen from "./src/screens/DecideScreen";
import DebugScreen from "./src/screens/DebugScreen";

const Stack = createNativeStackNavigator();

export default function App(): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const user = useSessionStore((s) => s.user);
  const initialize = useSessionStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // On app relaunch with an existing Supabase session but no HADE user,
  // re-sync to restore the user profile.
  useEffect(() => {
    if (isAuthenticated && user === null) {
      postAuthSync({}).then((resp) => {
        if (resp.data) {
          useSessionStore.getState().setUser(resp.data);
        }
      }).catch(() => {
        // sync failed — user stays on AuthScreen to retry
      });
    }
  }, [isAuthenticated, user]);

  const ready = isAuthenticated && user !== null && user.onboarding_complete;

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {ready ? (
            <>
              <Stack.Screen name="Home" component={DecideScreen} />
              <Stack.Screen name="Debug" component={DebugScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
