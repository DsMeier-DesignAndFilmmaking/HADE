import React, { useState, useRef } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView, 
  Animated,
  ActivityIndicator
} from "react-native";
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import { useSessionStore } from "../store/useSessionStore";
import { postAuthSync } from "../services/api";
import { UserUpdate } from "../types";

type OnboardingStep = "vision" | "location" | "trust" | "ready";

export default function OnboardingScreen(): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>("vision");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Transition helper for smooth UX
  const nextStep = (target: OnboardingStep) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(target);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleLocationRequest = async () => {
    setLoading(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setLoading(false);
      nextStep("trust");
    }
  };

  const handleContactsRequest = async () => {
    setLoading(true);
    try {
      await Contacts.requestPermissionsAsync();
    } finally {
      setLoading(false);
      nextStep("ready");
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      const payload = { onboarding_complete: true } as any;
      
      // Attempt to sync with backend
      const resp = await postAuthSync(payload);
      
      if (resp.data) {
        useSessionStore.getState().setUser(resp.data);
      }
    } catch (err) {
      console.warn("Backend sync failed, applying local bypass fallback...");
      
      // FALLBACK: If API fails, manually update the local state 
      // so the UI still transitions to the DecideScreen.
      const currentUser = useSessionStore.getState().user;
      if (currentUser) {
        useSessionStore.getState().setUser({
          ...currentUser,
          onboarding_complete: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case "vision":
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.eyebrow}>HADE v1.0</Text>
            <Text style={styles.title}>The city is on your side.</Text>
            <Text style={styles.description}>
              We replaced infinite scrolling with one confident answer. No search. No regret. Just the next move.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => nextStep("location")}>
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        );

      case "location":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}><Text style={styles.iconText}>📍</Text></View>
            <Text style={styles.title}>Enable your city eyesight.</Text>
            <Text style={styles.description}>
              HADE needs to know where you're standing to find the one spot that's right for this exact moment.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleLocationRequest} disabled={loading}>
              {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.buttonText}>Allow Location</Text>}
            </TouchableOpacity>
            {/* AMBER UPDATE: Skip option for low-friction flow */}
            <TouchableOpacity onPress={() => nextStep("trust")}>
              <Text style={styles.skipText}>I'll decide where I am later</Text>
            </TouchableOpacity>
          </View>
        );

      case "trust":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}><Text style={styles.iconText}>🤝</Text></View>
            <Text style={styles.title}>Build your trust network.</Text>
            <Text style={styles.description}>
              A recommendation from a friend is worth 1,000 stranger reviews. Connect contacts to see where your people go.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleContactsRequest} disabled={loading}>
               {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.buttonText}>Sync Contacts</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nextStep("ready")}>
              <Text style={styles.skipText}>Keep my network private for now</Text>
            </TouchableOpacity>
          </View>
        );

      case "ready":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}><Text style={styles.iconText}>✨</Text></View>
            <Text style={styles.title}>Ready to decide?</Text>
            <Text style={styles.description}>
              You’re 90 seconds away from your next great spontaneous discovery.
            </Text>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={completeOnboarding}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#0D0D0D" /> : <Text style={styles.buttonText}>Enter HADE</Text>}
            </TouchableOpacity>

            {/* DEV TOOL: Restart onboarding loop for design tweaking */}
            {__DEV__ && (
              <TouchableOpacity onPress={() => setStep("vision")} style={styles.devRestart}>
                <Text style={styles.devRestartText}>↻ Restart Animation Loop</Text>
              </TouchableOpacity>
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressHeader}>
        {["vision", "location", "trust", "ready"].map((s) => (
          <View 
            key={s} 
            style={[styles.progressSegment, step === s && styles.progressActive]} 
          />
        ))}
      </View>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {renderContent()}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  flex: { flex: 1 },
  progressHeader: { flexDirection: "row", paddingHorizontal: 24, gap: 6, marginTop: 12 },
  progressSegment: { flex: 1, height: 3, backgroundColor: "#1C1917", borderRadius: 2 },
  progressActive: { 
    backgroundColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  stepContainer: { flex: 1, padding: 32, justifyContent: "center" },
  eyebrow: { color: "#F59E0B", fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginBottom: 16, textTransform: "uppercase" },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#1C1917", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  iconText: { fontSize: 32 },
  title: { color: "#FAFAF8", fontSize: 38, fontWeight: "800", lineHeight: 44, letterSpacing: -1 },
  description: { color: "#A8A29E", fontSize: 18, lineHeight: 28, marginTop: 20, marginBottom: 48 },
  primaryButton: { backgroundColor: "#F59E0B", paddingVertical: 20, borderRadius: 16, alignItems: "center", minHeight: 64, justifyContent: "center" },
  buttonText: { color: "#0D0D0D", fontSize: 18, fontWeight: "700" },
  skipText: { color: "#57534E", textAlign: "center", marginTop: 24, fontWeight: "600", fontSize: 15 },
  devRestart: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#1C1917', paddingTop: 20 },
  devRestartText: { color: "#444", textAlign: 'center', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }
});