import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { timeAgo, isStale } from "../utils/time";

interface FreshnessIndicatorProps {
  timestamp: string;
  staleThresholdMinutes?: number;
}

/**
 * Inline freshness badge for signal attribution.
 * Fresh: green dot + "Verified 12m ago"
 * Stale (>3h): gray dot + "Last signal 4h ago" + reduced opacity
 */
export default function FreshnessIndicator({
  timestamp,
  staleThresholdMinutes = 180,
}: FreshnessIndicatorProps): React.JSX.Element {
  const stale = isStale(timestamp, staleThresholdMinutes);
  const label = stale
    ? `Last signal ${timeAgo(timestamp)}`
    : `Verified ${timeAgo(timestamp)}`;

  return (
    <View
      style={[styles.container, stale && styles.staleContainer]}
      accessibilityLabel={label}
    >
      <View style={[styles.dot, stale && styles.staleDot]} />
      <Text style={[styles.text, stale && styles.staleText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  staleContainer: {
    opacity: 0.6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  staleDot: {
    backgroundColor: "#78716C",
  },
  text: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
  staleText: {
    color: "#A8A29E",
  },
});
