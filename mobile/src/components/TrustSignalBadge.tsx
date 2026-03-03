import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TrustAttribution } from "../types";

interface TrustSignalBadgeProps {
  attribution: TrustAttribution;
}

/**
 * Trust signal attribution badge — e.g., "Maya was here 2h ago".
 */
export default function TrustSignalBadge({
  attribution,
}: TrustSignalBadgeProps): React.JSX.Element {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{attribution.signal_summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: "#3B82F6",
    fontSize: 14,
  },
});
