import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TextInput,
  Image,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "../services/auth";
import { useSessionStore } from "../store/useSessionStore";
import { useDecisionStore } from "../store/useDecisionStore";
import { postDecide } from "../services/api";
import type { DecideResponse, Opportunity, Intent } from "../types";

import RecommendationCard from "../components/RecommendationCard";
import CreateEventSheet from "../components/CreateEventSheet";

const MicIcon = () => <Text style={{ fontSize: 20 }}>🎙️</Text>;
const SearchIcon = () => <Text style={{ fontSize: 16 }}>🔍</Text>;
const Haptics = (() => {
  try {
    return require("expo-haptics");
  } catch {
    return null;
  }
})();

export default function DecideScreen(): React.JSX.Element {
  const user = useSessionStore((s) => s.user);
  const navigation = useNavigation<any>();
  const setStoredDecisionAsync = useDecisionStore((s) => s.setDecisionAsync);
  const clearStoredDecision = useDecisionStore((s) => s.clearDecision);
  const activeOpportunityId = useDecisionStore((s) => s.activeOpportunityId);

  const [signingOut, setSigningOut] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<DecideResponse | null>(null);
  const [emptyState, setEmptyState] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const mapHeight = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);

  const primary: Opportunity | undefined = decision?.primary;

  const MOCK_SUCCESS: Opportunity = {
    id: "dev-mock-1",
    venue_name: "Union Station Lodge",
    category: "Cocktails & Chill",
    eta_minutes: 12,
    distance_meters: 850,
    is_primary: true,
    geo: { lat: 39.7541, lng: -104.9998 },
    rationale: "The lighting is dimmed to 20% and the fireplace is active.",
    trust_attributions: [{ user_name: "Maya", signal_summary: "Calibrated 15m ago" }],
    event: null,
    primary_signal: {
      user_name: "Alex",
      timestamp: new Date(Date.now() - 15 * 60_000).toISOString(),
      vibe_label: "Busy/Great",
      comment: "The miso ramen is unreal tonight.",
    },
  };

  const MOCK_FALLBACKS: Opportunity[] = [
    {
      id: "dev-mock-2",
      venue_name: "Ratio Beerworks",
      category: "Drinks",
      eta_minutes: 8,
      distance_meters: 600,
      is_primary: false,
      geo: { lat: 39.7558, lng: -104.9942 },
      rationale: "Quiet patio night, good for a wind-down.",
      trust_attributions: [],
      event: null,
      primary_signal: null,
    },
    {
      id: "dev-mock-3",
      venue_name: "Nocturne Jazz",
      category: "Scene",
      eta_minutes: 14,
      distance_meters: 1100,
      is_primary: false,
      geo: { lat: 39.7525, lng: -105.0015 },
      rationale: "Live set starts at 9.",
      trust_attributions: [],
      event: null,
      primary_signal: null,
    },
  ];

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

  const handleReset = () => {
    Animated.timing(mapHeight, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setDecision(null);
    clearStoredDecision();
    setEmptyState(false);
    setIntent(null);
    setSearchQuery("");
    setLoading(false);
  };

  const animateMapToOpportunity = (opp: Opportunity) => {
    Animated.timing(mapHeight, {
      toValue: 200,
      duration: 400,
      useNativeDriver: false,
    }).start(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: opp.geo.lat,
          longitude: opp.geo.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        600,
      );
    });
  };

  const handleVoicePress = () => {
    setIsListening(!isListening);
  };

  const runMediumHaptic = async () => {
    if (!Haptics?.impactAsync || !Haptics?.ImpactFeedbackStyle?.Medium) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // no-op: haptics should never block primary action
    }
  };

  const triggerDecision = useCallback(async () => {
    if (!intent && !searchQuery) return;
    await runMediumHaptic();

    setLoading(true);
    setEmptyState(false);
    setDecision(null);

    if (__DEV__) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const mockResponse: DecideResponse = {
        primary: MOCK_SUCCESS,
        fallbacks: MOCK_FALLBACKS,
        context_state_id: "dev-session-123",
      };
      setDecision(mockResponse);
      await setStoredDecisionAsync(mockResponse);
      animateMapToOpportunity(MOCK_SUCCESS);
      navigation.navigate("RecommendationDetail", { opportunity: mockResponse.primary });
      setLoading(false);
      return;
    }

    try {
      const response = await postDecide({
        geo: { lat: 39.7541, lng: -104.9998 },
        intent: intent || (searchQuery as any),
        group_size: 1,
      });

      if (response.status !== "ok" || !response.data?.primary) {
        setEmptyState(true);
        clearStoredDecision();
      } else {
        setDecision(response.data);
        await setStoredDecisionAsync(response.data);
        animateMapToOpportunity(response.data.primary);
        navigation.navigate("RecommendationDetail", { opportunity: response.data.primary });
      }
    } catch {
      setEmptyState(true);
      clearStoredDecision();
    } finally {
      setLoading(false);
    }
  }, [intent, searchQuery, MOCK_SUCCESS, clearStoredDecision, navigation, setStoredDecisionAsync]);

  useEffect(() => {
    const currentPrimaryId = decision?.primary?.id;
    if (!currentPrimaryId) return;
    if (activeOpportunityId === currentPrimaryId) return;

    Animated.timing(mapHeight, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setDecision(null);
  }, [activeOpportunityId, decision?.primary?.id, mapHeight]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER SECTION: Avatar & Name Left, Sign Out Right */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Pressable 
            onPress={() => navigation.navigate("Profile")} 
            style={styles.profileButton}
          >
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
        {/* STATE 1: INTENT & SEARCH */}
        {!primary && !loading && !emptyState && (
          <View>
            <Text style={styles.prompt}>What are you up for?</Text>

            <View style={styles.searchContainer}>
              <View style={styles.searchInner}>
                <SearchIcon />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Ask for anything..."
                  placeholderTextColor="#57534E"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <Pressable 
                  onPress={handleVoicePress} 
                  style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                >
                  <MicIcon />
                </Pressable>
              </View>
            </View>

            <View style={styles.intentGrid}>
              {(["eat", "drink", "chill", "scene"] as Intent[]).map((val) => (
                <Pressable
                  key={val}
                  onPress={() => { setIntent(val); setSearchQuery(""); }}
                  style={[styles.intentChip, intent === val && styles.intentChipActive]}
                >
                  <Text style={[styles.intentText, intent === val && styles.intentTextActive]}>
                    {val.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionArea}>
              {(intent || searchQuery.length > 0) && (
                <Pressable onPress={triggerDecision} style={styles.confirmIntent}>
                  <Text style={styles.confirmText}>
                    {isListening ? "Listening..." : "Decide"}
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => setShowCreateEvent(true)} style={styles.hostLink}>
              <Text style={styles.hostLinkText}>Or host something yourself</Text>
            </Pressable>
          </View>
        )}

        {/* STATE 2: LOADING */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Thinking…</Text>
            <ActivityIndicator size="small" color="#F59E0B" style={{ marginTop: 16 }} />
          </View>
        )}

        {/* STATE 3: SUCCESS */}
        {primary && !loading && (
          <>
            <RecommendationCard
              opportunity={primary}
              onGo={() => navigation.navigate("RecommendationDetail", { opportunity: primary })}
              onDismiss={handleReset}
            />

            {/* Inline Map Preview — auto-focuses on primary, shows fallbacks faded */}
            <Animated.View style={[styles.mapPreview, { height: mapHeight }]}>
              <MapView
                ref={mapRef}
                style={styles.mapInner}
                userInterfaceStyle="dark"
                showsUserLocation
                showsPointsOfInterest={false}
                showsIndoors={false}
                showsBuildings={false}
                showsTraffic={false}
                rotateEnabled={false}
                pitchEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                initialRegion={{
                  latitude: primary.geo.lat,
                  longitude: primary.geo.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                {/* Primary "HADE Pulse" marker */}
                <Marker
                  coordinate={{ latitude: primary.geo.lat, longitude: primary.geo.lng }}
                  title={primary.venue_name}
                  pinColor="#F59E0B"
                />

                {/* Fallback markers — faded for spatial context */}
                {decision?.fallbacks.map((fb) => (
                  <Marker
                    key={fb.id}
                    coordinate={{ latitude: fb.geo.lat, longitude: fb.geo.lng }}
                    title={fb.venue_name}
                    pinColor="#F59E0B"
                    opacity={0.35}
                  />
                ))}
              </MapView>
            </Animated.View>
          </>
        )}

        {/* STATE 4: EMPTY */}
        {emptyState && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing amazing nearby right now.</Text>
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Back to start</Text>
            </Pressable>
          </View>
        )}
      </View>

      <CreateEventSheet visible={showCreateEvent} onClose={() => setShowCreateEvent(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    alignItems: "center" 
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  userTextContainer: {
    marginLeft: 12,
  },
  displayName: { color: "#FAFAF8", fontWeight: "800", fontSize: 16 },
  username: { color: "#57534E", fontSize: 12 },
  signOutButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#1A1A1A" },
  signOutText: { color: "#78716C", fontSize: 11, fontWeight: "600" },
  
  // AVATAR STYLES
  profileButton: {
    width: 48,
    height: 48,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#262626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    position: "relative",
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 24 },
  avatarPlaceholder: { color: "#F59E0B", fontWeight: "800", fontSize: 18 },
  statusIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0D0D0D",
  },

  body: { flex: 1, justifyContent: "center", padding: 24 },
  prompt: { color: "#FAFAF8", fontSize: 32, fontWeight: "800", marginBottom: 24, letterSpacing: -1 },
  searchContainer: { marginBottom: 20 },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 64,
    borderWidth: 1,
    borderColor: "#262626",
  },
  searchInput: { flex: 1, color: "#FAFAF8", fontSize: 18, fontWeight: "500", marginLeft: 12 },
  voiceButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#262626", justifyContent: "center", alignItems: "center" },
  voiceButtonActive: { backgroundColor: "#F59E0B" },
  intentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  intentChip: { backgroundColor: "#121212", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: "#262626" },
  intentChipActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  intentText: { color: "#78716C", fontWeight: "700", fontSize: 12 },
  intentTextActive: { color: "#0D0D0D" },
  actionArea: { marginTop: 32, height: 60, justifyContent: 'center' },
  confirmIntent: { backgroundColor: "#F59E0B", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  confirmText: { color: "#0D0D0D", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  loadingContainer: { alignItems: "center" },
  loadingText: { color: "#FAFAF8", fontSize: 18, fontWeight: "600" },
  emptyCard: { backgroundColor: "#1A1A1A", padding: 32, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#262626" },
  emptyTitle: { color: "#A8A29E", fontSize: 16, fontWeight: "600", textAlign: "center" },
  resetButton: { marginTop: 24, padding: 12 },
  resetButtonText: { color: "#F59E0B", fontWeight: "700" },
  hostLink: { alignItems: "center", marginTop: 16, padding: 8 },
  hostLinkText: { color: "#A8A29E", fontSize: 13, fontWeight: "500" },
  mapPreview: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
  },
  mapInner: {
    flex: 1,
  },
});
