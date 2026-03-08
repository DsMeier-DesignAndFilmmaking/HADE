import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { Opportunity } from "../types";
import { timeAgo, isStale } from "../utils/time";

const { width } = Dimensions.get("window");

interface Props {
  opportunity: Opportunity;
  onGo: () => void;
  onDismiss: () => void;
  onDetails: () => void; // Added to satisfy DecideScreen
}

export default function RecommendationCard({ 
  opportunity, 
  onGo, 
  onDismiss, 
  onDetails 
}: Props): React.JSX.Element {
  const navigation = useNavigation<any>();
  const signal = opportunity.primary_signal;

  const handleGoInternal = () => {
    onGo();
    navigation.navigate("MapSurface", { opportunity });
  };

  const handleDetailsInternal = () => {
    onDetails();
    navigation.navigate("RecommendationDetail", { 
      opportunity,
      isEvent: !!opportunity.event 
    });
  };

  return (
    <View style={styles.card}>
      {/* Metadata */}
      <View style={styles.metaRow}>
        <Text style={styles.category}>{opportunity.category.toUpperCase()}</Text>
        <Text style={styles.eta}>{opportunity.eta_minutes}M AWAY</Text>
      </View>

      {/* Rationale-as-Headline */}
      <Text style={styles.rationaleHeadline}>
        {opportunity.rationale}
      </Text>

      {/* Venue Name Subtext */}
      <Text style={styles.venueSubtext}>
        {opportunity.venue_name}
      </Text>

      {/* Trust Attribution */}
      {signal && (
        <View style={[styles.trustBadge, isStale(signal.timestamp) && { opacity: 0.5 }]}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarLetter}>{signal.user_name.charAt(0)}</Text>
          </View>
          <Text style={styles.trustText}>
            <Text style={styles.boldText}>{signal.user_name}</Text>
            {` confirmed the vibe ${timeAgo(signal.timestamp)}`}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
          <Text style={styles.secondaryText}>Not now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleDetailsInternal}>
          <Text style={styles.secondaryText}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.goButton} onPress={handleGoInternal}>
          <Text style={styles.goText}>GO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: "#141414", 
    borderRadius: 28, 
    padding: 24, 
    width: width - 48,
    alignSelf: 'center',
    borderWidth: 1, 
    borderColor: "#262626",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  category: { color: "#F59E0B", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  eta: { color: "#78716C", fontSize: 12, fontWeight: "700" },
  rationaleHeadline: { color: "#FAFAF8", fontSize: 26, fontWeight: "800", letterSpacing: -0.8, lineHeight: 32, marginBottom: 12 },
  venueSubtext: { color: "#A8A29E", fontSize: 16, fontWeight: "600", marginBottom: 24 },
  trustBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(38, 38, 38, 0.4)", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 28, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.05)" },
  avatarMini: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarLetter: { color: "#0D0D0D", fontSize: 12, fontWeight: "900" },
  trustText: { color: "#D6D3D1", fontSize: 13, flex: 1, lineHeight: 18 },
  boldText: { color: "#FAFAF8", fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, backgroundColor: "#1C1C1C", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262626" },
  secondaryText: { color: "#78716C", fontWeight: "700", fontSize: 14 },
  goButton: { flex: 2, backgroundColor: "#F59E0B", paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  goText: { color: "#0D0D0D", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
});