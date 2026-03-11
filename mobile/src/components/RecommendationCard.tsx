import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { Opportunity } from "../types";
import { timeAgo, isStale } from "../utils/time";

const { width } = Dimensions.get("window");

interface Props {
  opportunity: Opportunity;
  onGo: () => void;
  onDismiss: () => void;
  onDetails: () => void;
}

export default function RecommendationCard({ 
  opportunity, 
  onGo, 
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
      <View style={styles.metaRow}>
        <Text style={styles.category}>{opportunity.category.toUpperCase()}</Text>
        <Text style={styles.eta}>{opportunity.eta_minutes}M AWAY</Text>
      </View>

      <Text style={styles.rationaleHeadline}>
        {opportunity.rationale}
      </Text>

      <Text style={styles.venueSubtext}>
        {opportunity.venue_name}
      </Text>

      {signal ? (
        <View style={[styles.trustBadge, isStale(signal.timestamp) && { opacity: 0.5 }]}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarLetter}>{signal.user_name.charAt(0)}</Text>
          </View>
          <Text style={styles.trustText}>
            <Text style={styles.boldText}>{signal.user_name}</Text>
            {` confirmed the vibe ${timeAgo(signal.timestamp)}`}
          </Text>
        </View>
      ) : (
        <View style={styles.trustBadge}>
          <Text style={styles.trustFallbackText}>
            New discovery in {(opportunity as any).neighborhood || 'Denver'}
          </Text>
        </View>
      )}

      {/* REFINED DUAL ACTION BAR */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleDetailsInternal}
        >
          <Text style={styles.secondaryText}>Info</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleGoInternal}
        >
          <Text style={styles.primaryText}>Let's Go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: "#111111", 
    borderRadius: 32, 
    padding: 24, 
    width: width - 32, 
    alignSelf: 'center',
    borderWidth: 1, 
    borderColor: "#222",
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  category: { color: "#F59E0B", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  eta: { color: "#78716C", fontSize: 11, fontWeight: "600" },
  rationaleHeadline: { 
    color: "#FAFAF8", 
    fontSize: 24, 
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }), 
    lineHeight: 32, 
    marginBottom: 8 
  },
  venueSubtext: { color: "#A8A29E", fontSize: 15, fontWeight: "500", marginBottom: 24 },
  trustBadge: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#1A1A1A", 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 32 
  },
  avatarMini: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center", marginRight: 8 },
  avatarLetter: { color: "#000", fontSize: 10, fontWeight: "900" },
  trustText: { color: "#A8A29E", fontSize: 12, flex: 1 },
  boldText: { color: "#FFF" },
  trustFallbackText: { color: "#78716C", fontSize: 12, fontStyle: 'italic' },
  
  actionRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12, // Physical gap breaks the toggle illusion
  },
  secondaryButton: {
    flex: 1, // Balanced width
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryText: { 
    color: "#FAFAF8", 
    fontSize: 15, 
    fontWeight: "600" 
  },
  primaryButton: {
    flex: 2, // Gives the primary action more visual "weight"
    backgroundColor: "#F59E0B",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // Slight shadow to lift it off the card
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: { 
    color: "#000", 
    fontWeight: "800", 
    fontSize: 15 
  },
});