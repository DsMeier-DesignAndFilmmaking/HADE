import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSessionStore } from "./src/store/useSessionStore";
import LoginScreen from "./src/screens/LoginScreen";
import DebugScreen from "./src/screens/DebugScreen";

const Stack = createNativeStackNavigator();

export default function App(): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <Stack.Screen name="Debug" component={DebugScreen} />
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
