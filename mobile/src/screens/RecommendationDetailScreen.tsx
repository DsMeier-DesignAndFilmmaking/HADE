import React from "react";
import { StyleSheet, View } from "react-native";

/**
 * Expanded view of the primary recommendation.
 * Shows venue info, trust signals, map preview, and "Go" CTA.
 */
export default function RecommendationDetailScreen(): React.JSX.Element {
  // TODO: Receive opportunity via navigation params
  // TODO: Render venue detail, trust attributions, map, Go button
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
