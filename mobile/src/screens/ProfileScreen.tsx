import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { useSessionStore } from "../store/useSessionStore";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // HADE Global State
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const llmProvider = useSessionStore((s) => s.llmProvider);
  const setLLMProvider = useSessionStore((s) => s.setLLMProvider);

  // Add this state to track the unconfirmed choice
const [pendingProvider, setPendingProvider] = useState<"gemini" | "openai">(llmProvider);
  
const handleConfirmSwitch = () => {
  setLLMProvider(pendingProvider); // Commit to global store
  setDevMenuVisible(false); // Close overlay
  // Optional: Add a small haptic here to confirm the "Calibration" is locked
};

  // Local UI State
  const [incognito, setIncognito] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Hidden Calibration Trigger State
  const [devMenuVisible, setDevMenuVisible] = useState(false);
  const tapCount = useRef(0);
  const lastTap = useRef(0);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        style: "destructive", 
        onPress: () => setUser(null) 
      },
    ]);
  };

  const handleVersionTap = () => {
    const now = Date.now();
    // Reset if taps are more than 2s apart
    if (now - lastTap.current > 2000) tapCount.current = 0;
    
    lastTap.current = now;
    tapCount.current += 1;

    if (tapCount.current === 3) {
      tapCount.current = 0;
      setDevMenuVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Navigation Header */}
      <View style={[styles.navHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || user?.username?.charAt(0) || "H"}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.name || "HADE Traveler"}</Text>
          <Text style={styles.username}>@{user?.username || "traveler"}</Text>
        </View>

        {/* Account Calibration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Calibration</Text>
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert("Edit Profile", "Feature coming soon.")}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
            <Text style={styles.rowValue}>→</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Incognito Mode</Text>
            <Switch
              value={incognito}
              onValueChange={setIncognito}
              trackColor={{ false: "#1C1917", true: "#F59E0B" }}
              thumbColor={incognito ? "#FAFAF8" : "#A8A29E"}
            />
          </View>
        </View>

        {/* Engine Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engine Preferences</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Discovery Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#1C1917", true: "#F59E0B" }}
            />
          </View>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("TrustNetwork" as never)}>
            <Text style={styles.rowLabel}>Manage Trust Network</Text>
            <Text style={styles.rowValue}>{user?.username === "daniel_meier" ? "3 Contacts" : "→"}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer & Hidden Trigger */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
            <Text style={styles.versionText}>HADE v1.0.0-alpha · Prototyping the Future</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

{/* Engine Bypass Overlay (Terminal Style) */}
{devMenuVisible && (
  <View style={styles.devOverlay}>
    <View style={styles.devSheet}>
      <Text style={styles.devTitle}>SYSTEM CALIBRATION</Text>
      
      <TouchableOpacity 
        style={styles.devRow} 
        onPress={() => setPendingProvider('gemini')}
      >
        <Text style={styles.devLabel}>Force Gemini (Atmospheric)</Text>
        {pendingProvider === 'gemini' && <Text style={styles.devCheck}>SELECT</Text>}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.devRow} 
        onPress={() => setPendingProvider('openai')}
      >
        <Text style={styles.devLabel}>Force OpenAI (Logical)</Text>
        {pendingProvider === 'openai' && <Text style={styles.devCheck}>SELECT</Text>}
      </TouchableOpacity>

      {/* NEW: Confirmation Action */}
      <TouchableOpacity 
        style={[
          styles.confirmButton, 
          pendingProvider === llmProvider && styles.confirmDisabled
        ]} 
        onPress={handleConfirmSwitch}
        disabled={pendingProvider === llmProvider}
      >
        <Text style={styles.confirmButtonText}>COMMIT CALIBRATION</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setDevMenuVisible(false)} style={styles.closeDev}>
        <Text style={styles.closeDevText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#1C1917",
  },
  navTitle: { color: "#FAFAF8", fontSize: 16, fontWeight: "700" },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: { color: "#FAFAF8", fontSize: 32, marginTop: -4 },
  content: { padding: 24 },
  header: { alignItems: "center", marginBottom: 40, marginTop: 20 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1C1917",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#262626",
  },
  avatarText: { color: "#F59E0B", fontSize: 32, fontWeight: "800" },
  displayName: { color: "#FAFAF8", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  username: { color: "#57534E", fontSize: 16, marginTop: 4 },
  section: { marginBottom: 32 },
  sectionTitle: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 18,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowLabel: { color: "#FAFAF8", fontSize: 16, fontWeight: "600" },
  rowValue: { color: "#A8A29E", fontSize: 14 },
  footer: { marginTop: 20, alignItems: "center" },
  signOutButton: { padding: 16, width: "100%", alignItems: "center" },
  signOutText: { color: "#EF4444", fontSize: 16, fontWeight: "700" },
  versionText: { color: "#262626", fontSize: 11, marginTop: 24, fontWeight: "600" },
  
  // Dev Mode Overlay Styles
  devOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  devSheet: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  devTitle: { 
    color: '#F59E0B', 
    fontWeight: '900', 
    marginBottom: 24, 
    fontSize: 13, 
    letterSpacing: 2,
    textAlign: 'center'
  },
  devRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#262626'
  },
  confirmButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
  },
  confirmDisabled: {
    backgroundColor: '#262626',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#0D0D0D',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  devCheck: { 
    color: '#F59E0B', 
    fontSize: 12, 
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  devLabel: { color: '#FAFAF8', fontSize: 15, fontWeight: '500' },

  closeDev: { marginTop: 32, alignItems: 'center' },
  closeDevText: { color: '#57534E', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' }
});