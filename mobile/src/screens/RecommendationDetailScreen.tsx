import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { Opportunity } from "../types";
import { timeAgo, isStale } from "../utils/time";
import FreshnessIndicator from "../components/FreshnessIndicator";

const Haptics = (() => {
  try {
    return require("expo-haptics");
  } catch {
    return null;
  }
})();

function formatEventTimeRange(startsAt: string, expiresAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(expiresAt);
  const fmt = (d: Date) => {
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes();
    const ampm = d.getHours() >= 12 ? "pm" : "am";
    return m > 0 ? `${h}:${m.toString().padStart(2, "0")}${ampm}` : `${h}${ampm}`;
  };
  const today = new Date();
  const isToday = start.toDateString() === today.toDateString();
  const prefix = isToday ? "Tonight" : start.toLocaleDateString("en-US", { weekday: "long" });
  return `${prefix} at ${fmt(start)} — ends around ${fmt(end)}`;
}

/** Maps vibe_label to badge color. Amber for fire/great, Stone for chill, muted for avoid. */
function vibeBadgeColor(vibeLabel: string): string {
  const lower = vibeLabel.toLowerCase();
  if (lower.includes("great") || lower.includes("fire") || lower.includes("busy") || lower.includes("loved")) {
    return "#F59E0B";
  }
  if (lower.includes("avoid") || lower.includes("heads up")) {
    return "#78716C";
  }
  // chill / solid / default
  return "#A8A29E";
}

/**
 * HADE Recommendation Detail — "Amber & Obsidian" intent surface.
 * One hero number. One reason. One action.
 */
export default function RecommendationDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // — Pulse dot animation ——————————————————————————————
  const pulseDotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Haptic: "Decision finalized" feel
    if (Haptics?.impactAsync && Haptics?.ImpactFeedbackStyle?.Light) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // Pulse dot loop
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDotOpacity, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseDotOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseDotOpacity]);

  // — Data ———————————————————————————————————————————
  const opportunity: Opportunity = route.params?.opportunity || {
    id: "mock-123",
    venue_name: "Union Station Lodge",
    category: "Cocktails & Chill",
    eta_minutes: 12,
    distance_meters: 950,
    rationale: "The lighting is dimmed to 20% and the fireplace is active.",
    trust_attributions: [
      { user_name: "Maya", signal_summary: "Calibrated 15m ago" },
    ],
    geo: { lat: 39.7527, lng: -104.9997 },
    is_primary: true,
    event: null,
    primary_signal: null,
    address: "1701 Wynkoop St, Denver, CO 80202",
  };

  const isEvent = opportunity.event != null;
  const event = opportunity.event;
  const trustAttribution = opportunity.trust_attributions?.[0];
  const trustName = isEvent && event ? event.host_name : trustAttribution?.user_name;
  const trustSummary =
    isEvent && event ? event.interest_count_hint : trustAttribution?.signal_summary;
  const trustAvatarUrl =
    (isEvent
      ? (event as any)?.host_avatar_url ??
        (event as any)?.hostAvatarUrl ??
        (event as any)?.avatarUrl
      : (trustAttribution as any)?.avatarUrl ?? (trustAttribution as any)?.avatar_url) || null;
  const trustInitial = (trustName || "H").charAt(0).toUpperCase();
  const resolvedAddress =
    (route.params?.opportunity as any)?.address ||
    (opportunity as any)?.address ||
    opportunity.venue_name;

  const handleGo = () => {
    navigation.push("MapSurface", { opportunity });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ─── TRUST CARD ────────────────────────────────── */}
        {opportunity.primary_signal ? (
          <View style={[
            styles.trustCard,
            isStale(opportunity.primary_signal.timestamp) && styles.staleTrustCard,
          ]}>
            <View style={styles.trustHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {opportunity.primary_signal.user_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.trustMeta}>
                <View style={styles.trustTopRow}>
                  <Text style={styles.trustInfo}>
                    <Text style={styles.boldText}>
                      {opportunity.primary_signal.user_name}
                    </Text>
                    {" was here "}
                    {timeAgo(opportunity.primary_signal.timestamp)}
                  </Text>
                  {!isStale(opportunity.primary_signal.timestamp) && (
                    <Text style={styles.livePill}>LIVE</Text>
                  )}
                </View>
                <View style={styles.trustCopy}>
                  <FreshnessIndicator timestamp={opportunity.primary_signal.timestamp} />
                </View>
              </View>
            </View>
          </View>
        ) : trustName ? (
          <View style={styles.trustCard}>
            <View style={styles.trustHeader}>
              <View style={styles.avatarCircle}>
                {trustAvatarUrl ? (
                  <Image source={{ uri: trustAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarLetter}>{trustInitial}</Text>
                )}
              </View>
              <View style={styles.trustMeta}>
                <View style={styles.trustTopRow}>
                  <Text style={styles.trustInfo}>
                    <Text style={styles.boldText}>{trustName}</Text>
                    {isEvent ? " is hosting right now" : " calibrated this signal"}
                  </Text>
                  <Text style={styles.livePill}>LIVE</Text>
                </View>
                <View style={styles.trustCopy}>
                  {trustSummary ? (
                    <Text style={styles.signalSummary}>{trustSummary}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* ─── HERO METRIC — ETA ─────────────────────────── */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroNumber}>{opportunity.eta_minutes}</Text>

          <View style={styles.statusLine}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseDotOpacity }]} />
            <Text style={styles.statusText}>
              MINS TO {opportunity.venue_name.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ─── DETAILS ───────────────────────────────────── */}
        <View style={styles.details}>
          <Text style={styles.category}>{opportunity.category.toUpperCase()}</Text>

          {isEvent && event ? (
            <>
              <Text style={styles.venueName}>{event.title}</Text>
              <Text style={styles.hostedBy}>Hosted by {event.host_name}</Text>
            </>
          ) : (
            <Text style={styles.venueName}>{opportunity.venue_name}</Text>
          )}

          {/* Dynamic Vibe Badge — only when live signal exists */}
          {opportunity.primary_signal ? (
            <View
              style={[
                styles.vibeBadge,
                { borderColor: vibeBadgeColor(opportunity.primary_signal.vibe_label) },
              ]}
            >
              <View
                style={[
                  styles.vibeDot,
                  { backgroundColor: vibeBadgeColor(opportunity.primary_signal.vibe_label) },
                ]}
              />
              <Text
                style={[
                  styles.vibeBadgeText,
                  { color: vibeBadgeColor(opportunity.primary_signal.vibe_label) },
                ]}
              >
                {opportunity.primary_signal.vibe_label}
              </Text>
            </View>
          ) : null}

          {/* Rationale — the "why" in Stone */}
          <Text style={[
            styles.rationaleText,
            opportunity.primary_signal &&
              isStale(opportunity.primary_signal.timestamp) &&
              styles.staleRationale,
          ]}>
            {opportunity.primary_signal
              ? `"${opportunity.primary_signal.comment}"`
              : opportunity.rationale}
          </Text>

          {isEvent && event && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>WHEN</Text>
              <Text style={styles.timeText}>
                {formatEventTimeRange(event.starts_at, event.expires_at)}
              </Text>
            </View>
          )}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>LOCATION</Text>
            <Text style={styles.addressText}>{resolvedAddress}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── FLOATING ACTION BAR ─────────────────────────── */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.goButton}
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${opportunity.venue_name}`}
          onPress={handleGo}
        >
          <Text style={styles.goText}>Let's Go</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ── Layout ──────────────────────────────────────── */
  safeArea: { flex: 1, backgroundColor: "#000000" },
  content: { paddingBottom: 140, paddingHorizontal: 24, paddingTop: 32 },

  /* ── Hero Metric ─────────────────────────────────── */
  heroBlock: {
    marginVertical: 28,
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  heroNumber: {
    color: "#F59E0B",
    fontSize: 96,
    fontWeight: "900",
    letterSpacing: -4,
    fontVariant: ["tabular-nums"],
    lineHeight: 96,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  statusText: {
    color: "#78716C",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  /* ── Trust Card ──────────────────────────────────── */
  trustCard: {
    backgroundColor: "#0D0D0D",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  trustHeader: { flexDirection: "row", alignItems: "center" },
  trustMeta: { flex: 1, marginLeft: 16 },
  trustTopRow: { flexDirection: "row", alignItems: "center" },
  trustCopy: { marginTop: 4 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 20 },
  avatarLetter: { color: "#F59E0B", fontWeight: "800", fontSize: 14 },
  trustInfo: { color: "#78716C", fontSize: 14, flex: 1 },
  boldText: { color: "#FAFAF8", fontWeight: "700" },
  livePill: {
    color: "#22C55E",
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: "800",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  signalSummary: {
    color: "#78716C",
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  staleTrustCard: { opacity: 0.6, borderColor: "#0D0D0D" },

  /* ── Details ─────────────────────────────────────── */
  details: { marginTop: 4 },
  category: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  venueName: {
    color: "#FAFAF8",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 6,
  },
  hostedBy: {
    color: "#78716C",
    fontSize: 15,
    marginTop: 4,
  },

  /* ── Vibe Badge ──────────────────────────────────── */
  vibeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  vibeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vibeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  /* ── Rationale ───────────────────────────────────── */
  rationaleText: {
    color: "#78716C",
    fontSize: 20,
    lineHeight: 28,
    marginTop: 16,
    fontStyle: "italic",
    letterSpacing: -0.3,
  },
  staleRationale: { opacity: 0.5 },

  /* ── Section Cards ───────────────────────────────── */
  sectionCard: {
    marginTop: 20,
    backgroundColor: "#0D0D0D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 16,
  },
  sectionTitle: {
    color: "#78716C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  timeText: {
    color: "#FAFAF8",
    fontSize: 16,
    marginTop: 8,
  },
  addressText: { color: "#78716C", fontSize: 15, marginTop: 8, lineHeight: 21 },

  /* ── Action Bar ──────────────────────────────────── */
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
  },
  backButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: { color: "#FAFAF8", fontSize: 20, fontWeight: "600" },
  goButton: {
    flex: 1,
    backgroundColor: "#F59E0B",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  goText: { color: "#000000", fontSize: 16, fontWeight: "800" },
});
