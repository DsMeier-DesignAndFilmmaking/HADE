import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useSessionStore } from "../store/useSessionStore";

/**
 * HADE Global Dev Overlay
 * Allows instant navigation between all app states during design/dev.
 * Automatically hidden in production builds via __DEV__ check.
 */
export default function DevNavOverlay(): React.JSX.Element | null {
  const navigation = useNavigation<NavigationProp<any>>();
  const [isOpen, setIsOpen] = useState(false);

  // Only render in development mode
  if (!__DEV__) return null;

  const screens = [
    { label: "Auth", name: "Auth" },
    { label: "Onboarding", name: "Onboarding" },
    { label: "Home", name: "Home" },
    { label: "Check-In", name: "CheckIn" },
    { label: "Details", name: "RecommendationDetail" },
    { label: "Trust", name: "TrustNetwork" },
    { label: "Profile", name: "Profile" },
    { label: "Debug", name: "Debug" },
  ];

  const resetOnboarding = () => {
    const user = useSessionStore.getState().user;
    if (user) {
      useSessionStore.getState().setUser({
        ...user,
        onboarding_complete: false,
      });
      navigation.navigate("Onboarding");
      setIsOpen(false);
    }
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {isOpen && (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>HADE DEV NAV</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {screens.map((s) => (
              <TouchableOpacity
                key={s.name}
                style={styles.navButton}
                onPress={() => {
                  navigation.navigate(s.name);
                  setIsOpen(false);
                }}
              >
                <Text style={styles.navButtonText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={styles.resetButton} 
            onPress={resetOnboarding}
          >
            <Text style={styles.resetButtonText}>↻ Reset Onboarding Flow</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.toggle} 
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleText}>{isOpen ? "✕" : "DEV"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  toggle: {
    backgroundColor: "#F59E0B", // Amber
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  toggleText: { color: "#0D0D0D", fontWeight: "900", fontSize: 12 },
  menu: {
    backgroundColor: "#1C1917",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    width: "94%",
    borderWidth: 1,
    borderColor: "#444",
  },
  menuTitle: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: "center"
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16
  },
  navButton: {
    backgroundColor: "#262626",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  navButtonText: { color: "#FAFAF8", fontSize: 12, fontWeight: "600" },
  resetButton: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#262626",
    alignItems: "center"
  },
  resetButtonText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  }
});