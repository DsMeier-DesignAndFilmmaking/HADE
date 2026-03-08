import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  ScrollView,
  Keyboard,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "../services/auth";
import { useSessionStore } from "../store/useSessionStore";
import { useDecisionStore } from "../store/useDecisionStore";
import { postDecide, postMoment } from "../services/api";
import type { DecideResponse, Opportunity, Intent } from "../types";

import { useLocation } from "../hooks/useLocation";

import RecommendationCard from "../components/RecommendationCard";
import CreateEventSheet from "../components/CreateEventSheet";

const Haptics = (() => {
  try {
    return require("expo-haptics");
  } catch {
    return null;
  }
})();

export default function DecideScreen(): React.JSX.Element {
  const { location } = useLocation();
  const user = useSessionStore((s) => s.user);
  const navigation = useNavigation<any>();

  // Corrected store hook names to avoid TS errors
  const setDecisionAsync = useDecisionStore((s) => s.setDecisionAsync);
  const clearDecision = useDecisionStore((s) => s.clearDecision);

  const [signingOut, setSigningOut] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [decision, setDecision] = useState<DecideResponse | null>(null);
  const [emptyState, setEmptyState] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const mapHeight = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);

  const primary: Opportunity | undefined = decision?.primary;

  const handleSignOut = (): void => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

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
      
      // 1. Check the hook's location, but keep Denver as the final fallback
      const lat = location?.latitude || 39.7541;
      const lng = location?.longitude || -104.9998;

      console.log(`[HADE DEBUG] Triggering decide at: ${lat}, ${lng}`);

      setLoading(true);
      setEmptyState(false);
      setDecision(null);

      try {
        const response = await postDecide({
          geo: { lat, lng }, 
          intent: selectedIntent,
          group_size: 1,
        });

        if (response.status !== "ok" || !response.data?.primary) {
          setEmptyState(true);
          clearDecision();
        } else {
          // Cast to any just for this log line
          const responseData = response.data as any;
          console.log(`[HADE ENGINE] Brain: ${responseData.provider || 'Unknown'}`);
          
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
      }
    },
    [setDecisionAsync, clearDecision, location] // CRITICAL: 'location' must be in the dependency array
  );

  const handleIntentSelection = (val: Intent) => {
    setIntent(val);
    triggerDecision(val);
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
          <Pressable onPress={handleSignOut} disabled={signingOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>{signingOut ? "…" : "Sign out"}</Text>
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

              <Pressable onPress={() => setShowCreateEvent(true)} style={styles.hostLink}>
                <Text style={styles.hostLinkText}>Or host something yourself</Text>
              </Pressable>
            </View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={styles.loadingText}>Synthesizing the city...</Text>
            </View>
          )}

          {primary && !loading && (
            <View style={styles.recommendationWrapper}>
              <RecommendationCard
                opportunity={primary}
                onGo={runMediumHaptic}
                onDismiss={handleDismiss}
                onDetails={runMediumHaptic}
              />
              <Animated.View style={[styles.mapPreview, { height: mapHeight }]}>
                <MapView
                  ref={mapRef}
                  style={styles.mapInner}
                  userInterfaceStyle="dark"
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
            </View>
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
  signOutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#1A1A1A" },
  signOutText: { color: "#78716C", fontSize: 11, fontWeight: "600" },
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
  loadingContainer: { alignItems: "center", justifyContent: 'center' },
  loadingText: { color: "#A8A29E", fontSize: 16, fontWeight: "600", marginTop: 24 },
  recommendationWrapper: { flex: 1 },
  emptyCard: { backgroundColor: "#1A1A1A", padding: 32, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#262626" },
  emptyTitle: { color: "#FAFAF8", fontSize: 18, fontWeight: "700", textAlign: "center", lineHeight: 24 },
  resetButton: { marginTop: 24, padding: 12 },
  resetButtonText: { color: "#F59E0B", fontWeight: "700" },
  hostLink: { alignItems: "center", marginTop: 32, padding: 8 },
  hostLinkText: { color: "#57534E", fontSize: 14, fontWeight: "600", textDecorationLine: 'underline' },
  mapPreview: { marginTop: 16, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#262626" },
  mapInner: { flex: 1 },
});