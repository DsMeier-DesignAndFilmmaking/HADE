import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface EmptyStateProps {
  message?: string;
}

/**
 * Honest empty state — "Nothing great right now."
 * Warm, not an error. A breath, not a failure.
 */
export default function EmptyState({
  message = "Nothing jumping out right now. Check back later.",
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  text: {
    color: "#A8A29E",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
