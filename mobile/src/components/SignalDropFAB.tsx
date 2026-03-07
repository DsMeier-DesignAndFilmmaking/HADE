import React, { useState } from "react";
import * as Location from "expo-location";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEmitSignal } from "../hooks/useSignals";
import { useDecisionStore } from "../store/useDecisionStore";
import type { Opportunity, SignalVibe } from "../types";

type SignalDropFABProps = {
  opportunity: Opportunity | null;
};

const CORE_OPTIONS: Array<{ vibe: SignalVibe; emoji: string }> = [
  { vibe: "fire", emoji: "🔥" },
  { vibe: "chill", emoji: "🧊" },
];
const Haptics = (() => {
  try {
    return require("expo-haptics");
  } catch {
    return null;
  }
})();

interface SignalSubmission {
  vibe: SignalVibe;
  venueId: string;
  fallbackGeo: { lat: number; lng: number };
}

interface OptimisticSnapshot {
  blockedVenueIds: string[];
  activeOpportunityId: string | null;
  decision: ReturnType<typeof useDecisionStore.getState>["decision"];
  lastMapViewport: ReturnType<typeof useDecisionStore.getState>["lastMapViewport"];
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  async function resolveSignalGeo(
    fallbackGeo: { lat: number; lng: number },
  ): Promise<{ lat: number; lng: number }> {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== "granted") return fallbackGeo;
  
      // 1. Check for "Fresh" Last Known Position (The High-Speed Path)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown?.coords) {
        const ageInSeconds = (Date.now() - lastKnown.timestamp) / 1000;
        // If the location is less than 60 seconds old, it's perfect for a quick signal drop
        if (ageInSeconds < 2) {
          return {
            lat: lastKnown.coords.latitude,
            lng: lastKnown.coords.longitude,
          };
        }
      }
  
      // 2. Fallback to Current Position with a Strict 5-Second Timeout
      // This prevents the "Signal Drop" from hanging if the user is in a GPS dead zone
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        // Note: timeInterval/timeout prevents the UI from locking up 
        // while the hardware tries to find a satellite.
      });
  
      return {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };
    } catch (error) {
      // If anything fails (timeout, hardware busy), we use the Opportunity's known Geo
      // ensuring the signal is at least associated with the venue.
      console.log("Location resolution timed out or failed, using fallbackGeo");
      return fallbackGeo;
    }
  }

function toUuidOrNull(value: string): string | null {
  return UUID_V4_PATTERN.test(value) ? value : null;
}

export default function SignalDropFAB({ opportunity }: SignalDropFABProps): React.JSX.Element {
  const registerSignalFeedback = useDecisionStore((s) => s.registerSignalFeedback);
  const [open, setOpen] = useState(false);
  const [sendingVibe, setSendingVibe] = useState<SignalVibe | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const emitSignal = useEmitSignal();

  const showConfirmation = (message: string) => {
    setConfirmation(message);
    setTimeout(() => setConfirmation(null), 1000);
  };
  const runUnavailableHaptic = async () => {
    if (
      Haptics?.notificationAsync &&
      Haptics?.NotificationFeedbackType?.Warning
    ) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      } catch {
        // fall through
      }
    }
    if (Haptics?.impactAsync && Haptics?.ImpactFeedbackStyle?.Light) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // no-op
      }
    }
  };

  const rollbackOptimisticState = (snapshot: OptimisticSnapshot) => {
    useDecisionStore.setState({
      blockedVenueIds: snapshot.blockedVenueIds,
      activeOpportunityId: snapshot.activeOpportunityId,
      decision: snapshot.decision,
      lastMapViewport: snapshot.lastMapViewport,
    });
  };

  const submitSignal = async ({
    vibe,
    venueId,
    fallbackGeo,
  }: SignalSubmission): Promise<void> => {
    console.log("🔥 [DEBUG] submitSignal started", { vibe, venueId }); // ADD THIS
    
    const prev = useDecisionStore.getState();
    const snapshot: OptimisticSnapshot = {
      blockedVenueIds: prev.blockedVenueIds,
      activeOpportunityId: prev.activeOpportunityId,
      decision: prev.decision,
      lastMapViewport: prev.lastMapViewport,
    };

    registerSignalFeedback(venueId, vibe);
    setOpen(false);
    setSendingVibe(vibe);
    
    // Move this logic to ONLY show success if it actually succeeds later, 
    // or keep it here but know it's "Optimistic".
    showConfirmation("Signal Shared");

    try {
      console.log("📍 [DEBUG] Resolving Geo..."); // ADD THIS
      const geo = await resolveSignalGeo(fallbackGeo);
      console.log("📡 [DEBUG] Emitting Signal to Backend...", geo); // ADD THIS
      
      await emitSignal.mutateAsync({
        venue_id: toUuidOrNull(venueId),
        geo,
        vibe,
      });
      
      console.log("✅ [DEBUG] Backend Accepted Signal!"); // ADD THIS
    } catch (error) {
      console.log("❌ [DEBUG] Signal Submission Failed:", error); // ADD THIS
      rollbackOptimisticState(snapshot);
      showConfirmation("Signal failed. Try again.");
    } finally {
      setSendingVibe(null);
    }
  };

  const handleSelect = async (vibe: SignalVibe) => {
    if (!opportunity) {
      await runUnavailableHaptic();
      showConfirmation("Select a destination first");
      setOpen(false);
      return;
    }

    void submitSignal({
      vibe,
      venueId: opportunity.id,
      fallbackGeo: opportunity.geo,
    });
  };
  const handleAvoidPress = async () => {
    if (!opportunity) {
      await runUnavailableHaptic();
      showConfirmation("Select a destination first");
      return;
    }
    await handleSelect("avoid");
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {confirmation ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{confirmation}</Text>
        </View>
      ) : null}

      {open ? (
        <View style={styles.sheet}>
          <View style={styles.optionsRow}>
            {CORE_OPTIONS.map((opt) => {
              return (
                <Pressable
                  key={opt.vibe}
                  style={[
                    styles.optionButton,
                    sendingVibe === opt.vibe && styles.optionButtonActive,
                  ]}
                  onPress={() => handleSelect(opt.vibe)}
                  disabled={sendingVibe !== null || emitSignal.isPending}
                >
                  <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                </Pressable>
              );
            })}
            {opportunity ? (
              <View key={`avoid-${opportunity.id}`}>
                <Pressable
                  style={[
                    styles.optionButton,
                    sendingVibe === "avoid" && styles.optionButtonActive,
                  ]}
                  onPress={handleAvoidPress}
                  disabled={sendingVibe !== null || emitSignal.isPending}
                >
                  <Text style={styles.optionEmoji}>⚠️</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable style={styles.fab} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.fabIcon}>✦</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    right: 20,
    bottom: 28,
    alignItems: "flex-end",
    zIndex: 1400,
    elevation: 25,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    color: "#0D0D0D",
    fontSize: 22,
    fontWeight: "900",
  },
  sheet: {
    borderRadius: 20,
    backgroundColor: "rgba(26,26,26,0.95)",
    borderWidth: 1,
    borderColor: "#262626",
    padding: 10,
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionButton: {
    width: 54,
    height: 54,
    backgroundColor: "#262626",
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  optionButtonActive: {
    opacity: 0.6,
  },
  optionEmoji: {
    fontSize: 24,
  },
  toast: {
    marginBottom: 10,
    backgroundColor: "rgba(13,13,13,0.9)",
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toastText: {
    color: "#FAFAF8",
    fontSize: 12,
    fontWeight: "700",
  },
});
