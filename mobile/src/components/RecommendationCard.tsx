import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Opportunity } from "../types";

interface RecommendationCardProps {
  opportunity: Opportunity;
  onGo: () => void;
  onDismiss: () => void;
}

/**
 * Primary recommendation card — venue name, category, distance,
 * trust attribution, rationale, and "Go" CTA.
 */
export default function RecommendationCard({
  opportunity,
  onGo,
  onDismiss,
}: RecommendationCardProps): React.JSX.Element {
  // TODO: Render venue name (display font), category + distance + ETA
  // TODO: Trust signal attribution ("Maya was here")
  // TODO: Rationale text
  // TODO: "Go" button (amber CTA)
  return (
    <View style={styles.card}>
      <Text style={styles.venueName}>{opportunity.venue_name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 24,
  },
  venueName: {
    color: "#FAFAF8",
    fontSize: 28,
    fontWeight: "700",
  },
});
