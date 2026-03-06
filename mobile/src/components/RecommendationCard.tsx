import React from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import type { Opportunity } from "../types";
import { timeAgo, isStale } from "../utils/time";

interface RecommendationCardProps {
  opportunity: Opportunity;
  onGo: () => void;
  onDismiss: () => void;
}

function formatEventTime(startsAt: string): string {
  const date = new Date(startsAt);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
  return `AT ${h}${m}${ampm}`;
}

/**
 * HADE Primary Recommendation Card
 * Renders venue recommendations and event-backed recommendations.
 * When opportunity.event is present, adapts to show event-specific UI.
 */
export default function RecommendationCard({
  opportunity,
  onGo,
  onDismiss,
}: RecommendationCardProps): React.JSX.Element {
  const isEvent = opportunity.event != null;
  const event = opportunity.event;

  // Extract primary trust signal
  const attribution = opportunity.trust_attributions?.[0];

  return (
    <View style={styles.card}>
      {/* Category & Proximity/Time */}
      <View style={styles.metaRow}>
        <Text style={styles.category}>{opportunity.category.toUpperCase()}</Text>
        <Text style={styles.eta}>
          {isEvent && event ? formatEventTime(event.starts_at) : `${opportunity.eta_minutes} MIN AWAY`}
        </Text>
      </View>

      {/* Title: event title or venue name */}
      <Text style={styles.venueName}>
        {isEvent && event ? event.title : opportunity.venue_name}
      </Text>

      {/* Distance subtitle for events */}
      {isEvent && (
        <Text style={styles.eventDistance}>
          {opportunity.venue_name} — {opportunity.eta_minutes} min walk
        </Text>
      )}

      {/* Trust Attribution */}
      {isEvent && event ? (
        <View style={styles.trustBadge}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarLetter}>{event.host_name.charAt(0)}</Text>
          </View>
          <Text style={styles.trustText}>
            <Text style={styles.boldText}>{event.host_name}</Text>
            {" is hosting"}
            {event.interest_count_hint ? (
              <Text style={styles.mutedText}> · {event.interest_count_hint}</Text>
            ) : null}
          </Text>
        </View>
      ) : opportunity.primary_signal ? (
        <View style={[
          styles.trustBadge,
          isStale(opportunity.primary_signal.timestamp) && { opacity: 0.6 },
        ]}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarLetter}>
              {opportunity.primary_signal.user_name.charAt(0)}
            </Text>
          </View>
          <Text style={styles.trustText}>
            <Text style={styles.boldText}>{opportunity.primary_signal.user_name}</Text>
            {" was here "}
            {timeAgo(opportunity.primary_signal.timestamp)}
          </Text>
        </View>
      ) : attribution ? (
        <View style={styles.trustBadge}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarLetter}>{attribution.user_name.charAt(0)}</Text>
          </View>
          <Text style={styles.trustText}>
            <Text style={styles.boldText}>{attribution.user_name}</Text> calibrated this: &quot;{attribution.signal_summary}&quot;
          </Text>
        </View>
      ) : null}

      {/* Rationale or event note */}
      <Text style={styles.rationale}>
        &quot;{isEvent && event?.interest_count_hint ? opportunity.rationale : opportunity.rationale}&quot;
      </Text>

      {/* Action Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.goButton}
          onPress={onGo}
          activeOpacity={0.8}
        >
          <Text style={styles.goText}>{isEvent ? "I'm in" : "Go"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#262626",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  category: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  eta: {
    color: "#57534E",
    fontSize: 11,
    fontWeight: "700",
  },
  venueName: {
    color: "#FAFAF8",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  eventDistance: {
    color: "#A8A29E",
    fontSize: 13,
    marginTop: -12,
    marginBottom: 16,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#262626",
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarLetter: {
    color: "#0D0D0D",
    fontSize: 12,
    fontWeight: "900",
  },
  trustText: {
    color: "#A8A29E",
    fontSize: 13,
    flex: 1,
  },
  boldText: {
    color: "#FAFAF8",
    fontWeight: "700",
  },
  mutedText: {
    color: "#57534E",
  },
  rationale: {
    color: "#FAFAF8",
    fontSize: 17,
    lineHeight: 24,
    fontStyle: "italic",
    marginBottom: 24,
    opacity: 0.9,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: "#262626",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  dismissText: {
    color: "#A8A29E",
    fontWeight: "700",
    fontSize: 16,
  },
  goButton: {
    flex: 2,
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  goText: {
    color: "#0D0D0D",
    fontWeight: "800",
    fontSize: 16,
  },
});
