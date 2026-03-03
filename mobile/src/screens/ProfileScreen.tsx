import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Profile and settings — account, preferences, privacy controls.
 * Minimal — not a destination screen.
 */
export default function ProfileScreen(): React.JSX.Element {
  // TODO: Display user info, privacy toggles, sign out
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
