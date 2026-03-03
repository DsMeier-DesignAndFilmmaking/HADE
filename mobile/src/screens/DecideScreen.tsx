import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "../services/auth";
import { useSessionStore } from "../store/useSessionStore";

/**
 * Home screen — core recommendation loop.
 * Shows intent selector, then a single recommendation card.
 */
export default function DecideScreen(): React.JSX.Element {
  const user = useSessionStore((s) => s.user);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = (): void => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            setSigningOut(false);
            Alert.alert("Error", "Could not sign out. Try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={styles.signOutButton}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={[styles.signOutText, signingOut && styles.disabled]}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>You're in. HADE is ready.</Text>
        {user && (
          <View style={styles.userInfo}>
            {user.name ? (
              <Text style={styles.displayName}>{user.name}</Text>
            ) : null}
            {user.username ? (
              <Text style={styles.username}>@{user.username}</Text>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: {
    color: "#FAFAF8",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.4,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  heading: {
    color: "#FAFAF8",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  userInfo: {
    marginTop: 16,
    alignItems: "center",
    gap: 4,
  },
  displayName: {
    color: "#FAFAF8",
    fontSize: 18,
    fontWeight: "600",
  },
  username: {
    color: "#A8A29E",
    fontSize: 15,
  },
});