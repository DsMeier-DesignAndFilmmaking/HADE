import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Home screen — core recommendation loop.
 * Shows intent selector, then a single recommendation card.
 */
export default function DecideScreen(): React.JSX.Element {
  // TODO: useLocation() to get current position
  // TODO: useDecide() to fetch recommendation
  // TODO: Render IntentSelector → RecommendationCard or EmptyState
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
