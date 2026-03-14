import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  Keyboard,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useSessionStore } from "../store/useSessionStore";
import { useDecisionStore } from "../store/useDecisionStore";
import { postDecide, postMoment } from "../services/api";
import type { DecideResponse, Opportunity, Intent } from "../types";

import { useLocation } from "../hooks/useLocation";

import RecommendationCard from "../components/RecommendationCard";
import CreateEventSheet from "../components/CreateEventSheet";
import PivotSheet, { type PivotType } from "../components/PivotSheet";
import BottomSheet from "@gorhom/bottom-sheet";

const Haptics = (() => {
  try {
    return require("expo-haptics");
  } catch {
    return null;
  }
})();

// Cycling "thinking" copy — cycles every 3s while the AI pipeline is running
const THINKING_LABELS = [
  "Consulting the city...",
  "Synthesizing local signals...",
  "Checking with the neighbors...",
  "Finding your spot...",
] as const;

// Pivot-specific thinking labels — shown when user recalibrates from a rejected card
const PIVOT_THINKING_LABELS: Record<PivotType, readonly string[]> = {
  energy:   ["Finding a quieter corner...", "Scanning for calmer spaces...", "Tuning the frequency..."],
  distance: ["Looking closer to your spot...", "Scanning within 500m...", "Finding what's right here..."],
  vibe:     ["Recalibrating for a new vibe...", "Reading the room differently...", "Finding a new frequency..."],
};

// Memory-aware labels — shown when the engine has rejection history to learn from
const MEMORY_THINKING_LABELS = [
  "Learning your rhythm...",
  "Refining the search...",
  "Filtering the noise...",
] as const;

export default function DecideScreen(): React.JSX.Element {
  const { location } = useLocation();
  const user = useSessionStore((s) => s.user);

  const llmProvider = useSessionStore((s) => s.llmProvider);

  const navigation = useNavigation<any>();

  // Corrected store hook names to avoid TS errors
  const setDecisionAsync = useDecisionStore((s) => s.setDecisionAsync);
  const clearDecision = useDecisionStore((s) => s.clearDecision);

  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [decision, setDecision] = useState<DecideResponse | null>(null);
  const [emptyState, setEmptyState] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Pivot recalibration state
  const [pivotType, setPivotType] = useState<PivotType | null>(null);
  const pivotTypeRef = useRef<PivotType | null>(null);  // ref for stale-closure-safe access inside triggerDecision
  const pivotSheetRef = useRef<BottomSheet>(null);

  // Rejection memory — accumulates venues the user has pivoted away from this session.
  // Uses a parallel ref so triggerDecision always reads the latest value (no stale closure).
  const [rejectedVenues, setRejectedVenues] = useState<Array<{ venue_id: string; venue_name: string; pivot_reason: string }>>([]);
  const rejectedVenuesRef = useRef<Array<{ venue_id: string; venue_name: string; pivot_reason: string }>>([]);

  // Card fade — prevents "flash of empty state" between rejected card and new card
  const cardOpacity = useRef(new Animated.Value(1)).current;

  // Thinking label cycling — resets on each new request
  // Uses pivot-specific labels when a pivot is active
  const [thinkingIndex, setThinkingIndex] = useState(0);
  useEffect(() => {
    if (!loading) {
      setThinkingIndex(0);
      return;
    }
    // Label priority: pivot-specific > memory-aware (has rejections) > generic
    const activeLabels = pivotType
      ? PIVOT_THINKING_LABELS[pivotType]
      : rejectedVenues.length > 0
        ? MEMORY_THINKING_LABELS
        : THINKING_LABELS;
    const interval = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % activeLabels.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading, pivotType, rejectedVenues.length]);

  const mapHeight = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);

  const primary: Opportunity | undefined = decision?.primary;

  const handleReset = useCallback(() => {
    Animated.timing(mapHeight, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setDecision(null);
    clearDecision(); // Uses corrected store method
    setEmptyState(false);
    setIntent(null);
    setLoading(false);
    setDismissing(false);
    // Clear rejection memory on full reset — user is starting a fresh session
    setRejectedVenues([]);
    rejectedVenuesRef.current = [];
  }, [clearDecision, mapHeight]);

  const handleDismiss = useCallback(async () => {
    if (dismissing) return;
    const currentDecision = decision;
    if (!currentDecision?.primary) {
      handleReset();
      return;
    }

    setDismissing(true);
    try {
      await postMoment({
        context_state_id: currentDecision.context_state_id,
        opportunity_id: currentDecision.primary.id,
        action: "DISMISSED",
      });
    } catch {
      // Best-effort analytics
    } finally {
      handleReset();
    }
  }, [decision, dismissing, handleReset]);

  const animateMapToOpportunity = (opp: Opportunity) => {
    Animated.timing(mapHeight, {
      toValue: 240,
      duration: 400,
      useNativeDriver: false,
    }).start(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: opp.geo.lat,
          longitude: opp.geo.lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        600,
      );
    });
  };

  const runMediumHaptic = async () => {
    if (!Haptics?.impactAsync) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // no-op
    }
  };

  const triggerDecision = useCallback(
    async (selectedIntent: Intent) => {
      Keyboard.dismiss();

      const lat = location?.latitude || 35.6595; 
      const lng = location?.longitude || 139.7005;

      if (!location) {
        console.warn("[HADE] Location not ready, using Tokyo fallback");
      } else {
        console.log(`[HADE] Denver Signal: ${lat}, ${lng}`);
      }

      // Read active pivot and rejection history from refs (avoids stale closure)
      const activePivot = pivotTypeRef.current;
      const activeRejections = rejectedVenuesRef.current;

      setLoading(true);
      setEmptyState(false);
      setDecision(null);

      // Build pivot-specific API params — OpenAI/Gemini prompt logic untouched
      const pivotParams: { energy_level?: string; radius_meters?: number } = {};
      if (activePivot === "energy")   pivotParams.energy_level  = "chill";
      if (activePivot === "distance") pivotParams.radius_meters = 500;

      try {
        const response = await postDecide({
          geo: { lat, lng },
          intent: selectedIntent,
          group_size: 1,
          provider: llmProvider,
          ...pivotParams,
          ...(activeRejections.length > 0 && { rejection_history: activeRejections }),
        });

        if (response.status !== "ok" || !response.data?.primary) {
          // ... handle empty
        } else {
          // The response now contains the actual provider used by the backend
          const responseData = response.data as any;
          console.log(`[HADE ENGINE] Brain Active: ${responseData.provider}`);
          
          setDecision(response.data);
          await setDecisionAsync(response.data);
          
          // This expands the map and focuses on the recommendation in Glendale
          animateMapToOpportunity(response.data.primary);
          runMediumHaptic();
        }
      } catch (error) {
        console.error("API Error:", error);
        setEmptyState(true);
        clearDecision();
      } finally {
        setLoading(false);
        // Clear pivot after use so next normal request has no stale params
        pivotTypeRef.current = null;
        setPivotType(null);
        // Restore card opacity if not already 1 (e.g. pivot fade completed)
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }
    },
    [location, llmProvider, setDecisionAsync, clearDecision, cardOpacity]
  );

  const handleIntentSelection = (val: Intent) => {
    setIntent(val);
    triggerDecision(val);
  };

  // Pivot recalibration — called from PivotSheet
  const handlePivot = (type: PivotType) => {
    const currentIntent = intent;

    if (type === "vibe") {
      // "Change the vibe" → fade out card, reset to intent chip view
      Animated.timing(cardOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        handleReset();
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
      return;
    }

    if (!currentIntent) return; // safety guard

    // Record the rejected venue BEFORE triggering — ref is read synchronously in triggerDecision
    if (primary) {
      const rejection = { venue_id: primary.id, venue_name: primary.venue_name, pivot_reason: type };
      const updated = [...rejectedVenuesRef.current, rejection];
      rejectedVenuesRef.current = updated;
      setRejectedVenues(updated);
    }

    // Set pivot type synchronously via ref before triggerDecision reads it
    pivotTypeRef.current = type;
    setPivotType(type); // triggers pivot-specific thinking labels

    // Soft fade: old card out → trigger new fetch → card fades back in (inside triggerDecision finally)
    Animated.timing(cardOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      triggerDecision(currentIntent);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="always">
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <Pressable onPress={() => navigation.navigate("Profile")} style={styles.profileButton}>
              <View style={styles.avatarContainer}>
                {(user as any)?.avatarUrl ? (
                  <Image source={{ uri: (user as any).avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarPlaceholder}>
                    {(user?.name || "E").charAt(0).toUpperCase()}
                  </Text>
                )}
                <View style={styles.statusIndicator} />
              </View>
            </Pressable>
            <View style={styles.userTextContainer}>
              <Text style={styles.displayName}>{user?.name || "Explorer"}</Text>
              <Text style={styles.username}>@{user?.username || "hade_user"}</Text>
            </View>
          </View>
          {/* Balanced right tap — navigates to Profile/Settings */}
          <Pressable
            onPress={() => navigation.navigate("Profile")}
            style={styles.settingsButton}
            hitSlop={12}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {!primary && !loading && !emptyState && (
            <View>
              <Text style={styles.prompt}>
                The city is on your side.{"\n"}What's the move?
              </Text>

              <View style={styles.intentGrid}>
                {(["eat", "drink", "chill", "scene"] as Intent[]).map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => handleIntentSelection(val)}
                    style={[styles.intentChip, intent === val && styles.intentChipActive]}
                    hitSlop={12}
                  >
                    <Text style={[styles.intentText, intent === val && styles.intentTextActive]}>
                      {val.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

            </View>
          )}

          {loading && (() => {
            const activeLabels = pivotType
              ? PIVOT_THINKING_LABELS[pivotType]
              : rejectedVenues.length > 0
                ? MEMORY_THINKING_LABELS
                : THINKING_LABELS;
            return (
              <View style={styles.thinkingCard}>
                <Text style={styles.thinkingLabel}>
                  {activeLabels[thinkingIndex % activeLabels.length]}
                </Text>
              </View>
            );
          })()}

          {primary && !loading && (
            <Animated.View style={[styles.recommendationWrapper, { opacity: cardOpacity }]}>
              <RecommendationCard
                opportunity={primary}
                contextStateId={decision?.context_state_id ?? ""}
                onGo={runMediumHaptic}
                onDismiss={handleDismiss}
                onDetails={runMediumHaptic}
              />

              {/* "Not the move?" — contextual pivot trigger */}
              <Pressable
                style={styles.pivotTrigger}
                onPress={() => pivotSheetRef.current?.expand()}
                hitSlop={16}
              >
                <Text style={styles.pivotTriggerText}>Not the move?</Text>
              </Pressable>

              <Animated.View style={[styles.mapPreview, { height: mapHeight }]}>
              <MapView
                  ref={mapRef}
                  style={styles.mapInner}
                  userInterfaceStyle="dark"
                  showsUserLocation={true} // Add this to see your blue dot in Denver
                  scrollEnabled={false}
                  initialRegion={{
                    latitude: primary.geo.lat,
                    longitude: primary.geo.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <Marker
                    coordinate={{ latitude: primary.geo.lat, longitude: primary.geo.lng }}
                    pinColor="#F59E0B"
                  />
                </MapView>
              </Animated.View>
            </Animated.View>
          )}

          {emptyState && !loading && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing great right now. Check back around 7.</Text>
              <Pressable style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Back to start</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <CreateEventSheet visible={showCreateEvent} onClose={() => setShowCreateEvent(false)} />

      {/* Pivot recalibration sheet — "Not the move?" */}
      <PivotSheet sheetRef={pivotSheetRef} onPivot={handlePivot} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, alignItems: "center" },
  profileSection: { flexDirection: "row", alignItems: "center" },
  userTextContainer: { marginLeft: 12 },
  displayName: { color: "#FAFAF8", fontWeight: "800", fontSize: 16 },
  username: { color: "#57534E", fontSize: 12 },
  settingsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  settingsIcon: { color: "#57534E", fontSize: 16 },
  profileButton: { width: 48, height: 48 },
  avatarContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#262626", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#F59E0B" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 24 },
  avatarPlaceholder: { color: "#F59E0B", fontWeight: "800", fontSize: 18 },
  statusIndicator: { position: "absolute", bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981", borderWidth: 2, borderColor: "#0D0D0D" },
  body: { flex: 1, justifyContent: "center", padding: 24 },
  prompt: { color: "#FAFAF8", fontSize: 32, fontWeight: "800", marginBottom: 32, letterSpacing: -1, lineHeight: 38 },
  intentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  intentChip: { backgroundColor: "#121212", paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: "#262626", minWidth: '45%' },
  intentChipActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  intentText: { color: "#FAFAF8", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  intentTextActive: { color: "#0D0D0D" },
  thinkingCard: {
    backgroundColor: "#F9F7F2",
    borderRadius: 28,
    padding: 48,
    marginHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  thinkingLabel: {
    color: "#1A1A1A",
    fontSize: 22,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  recommendationWrapper: { flex: 1 },
  pivotTrigger: { alignItems: "center", paddingVertical: 14 },
  // #78716C (warm gray) is readable on #0D0D0D dark background; spec #1A1A1A is for the sheet interior
  pivotTriggerText: { color: "#78716C", fontSize: 14, fontFamily: Platform.select({ ios: "Georgia", android: "serif" }), fontStyle: "italic", textDecorationLine: "underline" },
  emptyCard: { backgroundColor: "#1A1A1A", padding: 32, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#262626" },
  emptyTitle: { color: "#FAFAF8", fontSize: 18, fontWeight: "700", textAlign: "center", lineHeight: 24 },
  resetButton: { marginTop: 24, padding: 12 },
  resetButtonText: { color: "#F59E0B", fontWeight: "700" },
  hostLink: { alignItems: "center", marginTop: 32, padding: 8 },
  hostLinkText: { color: "#57534E", fontSize: 14, fontWeight: "600", textDecorationLine: 'underline' },
  mapPreview: { marginTop: 16, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#262626" },
  mapInner: { flex: 1 },
});