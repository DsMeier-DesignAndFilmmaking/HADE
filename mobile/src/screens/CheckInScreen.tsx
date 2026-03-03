import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Quick signal emission — check-in at a venue.
 * Tap, optional note, done in 3 seconds.
 */
export default function CheckInScreen(): React.JSX.Element {
  // TODO: useEmitSignal() to post check-in
  // TODO: Venue confirmation + optional note input
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
