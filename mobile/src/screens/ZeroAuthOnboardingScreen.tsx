import React, { useState, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { useSessionStore } from "../store/useSessionStore";
import { postAuthSync } from "../services/api";
import { supabase } from "../lib/supabase";
import type { Intent } from "../types";

const { width } = Dimensions.get("window");

// ─── Design tokens: "Modern McGee" warm cream palette ───────────────────────
const C = {
  bg:       '#F9F7F2', // Linen
  surface:  '#FFFFFF',
  ink:      '#1A1A1A', // Deep Matte Ink
  inkMuted: '#6B6B6B',
  inkFaint: '#A8A29E',
  accent:   '#F59E0B', // HADE amber — brand continuity
  border:   '#E8E5E0',
  radius:   { card: 20, button: 14, pill: 100 },
} as const;

// ─── Vibe → Intent mapping (existing Intent type — no schema changes) ────────
const VIBES: Array<{ label: string; icon: string; intent: Intent; desc: string }> = [
  { label: "Quick Fuel",    icon: "⚡", intent: "eat",      desc: "Food, coffee, a fast hit" },
  { label: "Social Energy", icon: "🔥", intent: "scene",    desc: "People, noise, the move" },
  { label: "Deep Focus",    icon: "🎯", intent: "chill",    desc: "Quiet, calm, unhurried" },
  { label: "Hidden Gem",    icon: "💎", intent: "anything", desc: "Surprise me" },
];

const GROUPS = [
  { label: "Solo",         size: 1 },
  { label: "Date Night",   size: 2 },
  { label: "With Friends", size: 4 },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function ZeroAuthOnboardingScreen(): React.JSX.Element {
  const setLocation  = useSessionStore((s) => s.setLocation);
  const setIntent    = useSessionStore((s) => s.setIntent);
  const setGroupSize = useSessionStore((s) => s.setGroupSize);

  const [step,          setStep]          = useState<0 | 1 | 2>(0);
  const [selectedVibe,  setSelectedVibe]  = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [locLoading,    setLocLoading]    = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Fade out → update state → fade in
  const transition = (fn: () => void): void => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => {
      fn();
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }).start();
    });
  };

  const advance = (): void => {
    transition(() => setStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s)));
  };

  // ─── Step 0: Location ───────────────────────────────────────────────────
  const handleUseLocation = async (): Promise<void> => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      // Permission denied or timeout — proceed without location
      // Decide screen will re-prompt when needed
    } finally {
      setLocLoading(false);
      advance();
    }
  };

  // ─── Step 1: Vibe (tap-to-advance, no explicit CTA) ─────────────────────
  const handleVibeSelect = (index: number): void => {
    setSelectedVibe(index);
    setIntent(VIBES[index].intent);
    // Brief visual feedback before advancing
    setTimeout(() => advance(), 180);
  };

  // ─── Step 2: Group ───────────────────────────────────────────────────────
  const handleGroupSelect = (index: number): void => {
    setSelectedGroup(index);
    setGroupSize(GROUPS[index].size);
  };

  // ─── Completion: try backend sync, fall back to local guest user ─────────
  const completeZeroAuth = async (): Promise<void> => {
    if (selectedGroup === null) return;
    setLoading(true);
    try {
      // postAuthSync injects Bearer token via Axios interceptor.
      // Anonymous Supabase JWTs are valid — backend upserts profile keyed on JWT sub.
      // Same calling pattern as OnboardingScreen.completeOnboarding().
      const result = await postAuthSync({ onboarding_complete: true } as any);
      if (result?.data) {
        useSessionStore.getState().setUser(result.data);
        return; // App.tsx reacts: showHome = true → DecideScreen
      }
      throw new Error("No user data in response");
    } catch {
      // Fallback: build minimal guest User from the anonymous Supabase session.
      // This satisfies the hasUser check in App.tsx without requiring a backend call.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        useSessionStore.getState().setUser({
          id:                 session.user.id,
          name:               "Guest",
          username:           null,
          email:              null,
          home_city:          "",
          onboarding_complete: true,
          created_at:         session.user.created_at,
          last_active:        new Date().toISOString(),
        } as any);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Progress bar ────────────────────────────────────────────────────────
  const renderProgress = (): React.JSX.Element => (
    <View style={styles.progressBar}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
        />
      ))}
    </View>
  );

  // ─── Step renderers ──────────────────────────────────────────────────────
  const renderStep = (): React.JSX.Element => {
    switch (step) {
      // ── Location ──
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>📍</Text>
            <Text style={styles.stepHeading}>Where are you tonight?</Text>
            <Text style={styles.stepCaption}>
              HADE uses your location for real-time city signals.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleUseLocation}
              disabled={locLoading}
            >
              {locLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Use My Location</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostButton} onPress={advance}>
              <Text style={styles.ghostButtonText}>I'll set it later</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Vibe ──
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>✦</Text>
            <Text style={styles.stepHeading}>What's the energy?</Text>
            <Text style={styles.stepCaption}>Tap to continue.</Text>

            <View style={styles.vibeGrid}>
              {VIBES.map((vibe, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.vibeCard, selectedVibe === i && styles.vibeCardSelected]}
                  onPress={() => handleVibeSelect(i)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.vibeIcon}>{vibe.icon}</Text>
                  <Text style={[styles.vibeLabel, selectedVibe === i && styles.vibeLabelSelected]}>
                    {vibe.label}
                  </Text>
                  <Text style={styles.vibeDesc}>{vibe.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── Group ──
      case 2:
      default:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>👥</Text>
            <Text style={styles.stepHeading}>Who's with you?</Text>
            <Text style={styles.stepCaption}>HADE calibrates for your group.</Text>

            <View style={styles.groupList}>
              {GROUPS.map((g, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.groupPill, selectedGroup === i && styles.groupPillSelected]}
                  onPress={() => handleGroupSelect(i)}
                >
                  <Text
                    style={[
                      styles.groupPillText,
                      selectedGroup === i && styles.groupPillTextSelected,
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                selectedGroup === null && styles.primaryButtonDisabled,
              ]}
              onPress={completeZeroAuth}
              disabled={selectedGroup === null || loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Let's Go</Text>
              )}
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderProgress()}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const CARD_W = (width - 48 - 12) / 2; // 2 columns with 24px side padding and 12px gap

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  progressBar: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  progressSegmentActive: {
    backgroundColor: C.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  stepIcon: {
    fontSize: 40,
    marginBottom: 20,
  },
  stepHeading: {
    fontSize: 32,
    fontWeight: "800",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    fontStyle: "italic",
    color: C.ink,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 10,
  },
  stepCaption: {
    fontSize: 16,
    color: C.inkMuted,
    lineHeight: 22,
    marginBottom: 36,
  },

  // ── Primary CTA ──
  primaryButton: {
    backgroundColor: C.accent,
    borderRadius: C.radius.button,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // ── Ghost CTA ──
  ghostButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostButtonText: {
    color: C.inkMuted,
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Vibe grid ──
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  vibeCard: {
    width: CARD_W,
    backgroundColor: C.surface,
    borderRadius: C.radius.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  vibeCardSelected: {
    borderColor: C.accent,
    backgroundColor: "#FFFBEB",
  },
  vibeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  vibeLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 4,
  },
  vibeLabelSelected: {
    color: "#92400E",
  },
  vibeDesc: {
    fontSize: 12,
    color: C.inkFaint,
    lineHeight: 16,
  },

  // ── Group pills ──
  groupList: {
    gap: 10,
    marginBottom: 32,
  },
  groupPill: {
    backgroundColor: C.surface,
    borderRadius: C.radius.pill,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 18,
    alignItems: "center",
  },
  groupPillSelected: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  groupPillText: {
    fontSize: 16,
    fontWeight: "700",
    color: C.inkMuted,
  },
  groupPillTextSelected: {
    color: "#000000",
  },
});
