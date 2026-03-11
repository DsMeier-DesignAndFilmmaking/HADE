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
import BottomSheet from "@gorhom/bottom-sheet";
import { useSessionStore } from "../store/useSessionStore";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthGateSheet from "../components/AuthGateSheet";

export default function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // HADE Global State
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const supabaseSession = useSessionStore((s) => s.supabaseSession);
  const llmProvider = useSessionStore((s) => s.llmProvider);
  const setLLMProvider = useSessionStore((s) => s.setLLMProvider);

  // Anonymous upgrade
  const isAnonymous = supabaseSession?.user?.is_anonymous ?? true; // Default to true for UX testing
  const authGateRef = useRef<BottomSheet>(null);

  // Calibration State
  const [pendingProvider, setPendingProvider] = useState<"gemini" | "openai">(llmProvider);
  const [devMenuVisible, setDevMenuVisible] = useState(false);
  const tapCount = useRef(0);
  const lastTap = useRef(0);

  // Local UI State
  const [incognito, setIncognito] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleConfirmSwitch = () => {
    setLLMProvider(pendingProvider);
    setDevMenuVisible(false);
  };

  const handleVersionTap = () => {
    const now = Date.now();
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
        <Text style={styles.navTitle}>SETTINGS</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header - Visual differentiation for Guest */}
        <View style={styles.header}>
          <View style={[
            styles.avatarPlaceholder, 
            isAnonymous && styles.avatarPlaceholderGuest
          ]}>
            <Text style={[styles.avatarText, isAnonymous && styles.avatarTextGuest]}>
              {isAnonymous ? "?" : (user?.name?.charAt(0) || "H")}
            </Text>
            {!isAnonymous && <View style={styles.activeSignalBadge} />}
          </View>
          <Text style={styles.displayName}>
            {isAnonymous ? "Spontaneous Explorer" : (user?.name || "HADE Traveler")}
          </Text>
          <Text style={styles.username}>
            {isAnonymous ? "Temporary Session" : `@${user?.username || "traveler"}`}
          </Text>
        </View>

        {/* Anonymous Upgrade CTA */}
        {isAnonymous && (
          <TouchableOpacity
            style={styles.upgradeCard}
            onPress={() => authGateRef.current?.expand()}
            activeOpacity={0.9}
          >
            <View style={styles.upgradeHeader}>
              <Text style={styles.upgradeTitle}>Save your city instincts</Text>
              <View style={styles.liveIndicator} />
            </View>
            <Text style={styles.upgradeBody}>
              Your current signals are device-only. Create an account to unlock your Trust Network and preserve your history.
            </Text>
            <Text style={styles.upgradeCTA}>Sync Profile →</Text>
          </TouchableOpacity>
        )}

        {/* System Integrity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Integrity</Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Signal Decay</Text>
              <Text style={styles.rowSubLabel}>Prioritizing data under 2h old</Text>
            </View>
            <Text style={styles.statusValue}>ACTIVE</Text>
          </View>
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

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity 
            style={styles.row} 
            onPress={() => navigation.navigate("TrustNetwork" as never)}
          >
            <View>
              <Text style={styles.rowLabel}>Trust Network</Text>
              <Text style={styles.rowSubLabel}>
                {isAnonymous ? "Connect contacts to see signals" : "Managing 12 trusted signals"}
              </Text>
            </View>
            <Text style={styles.rowValue}>→</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Push Intelligence</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#1C1917", true: "#F59E0B" }}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {!isAnonymous && (
            <TouchableOpacity style={styles.signOutButton} onPress={() => Alert.alert("Sign Out")}>
              <Text style={styles.signOutText}>End Session</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
            <Text style={styles.versionText}>HADE ENGINE v1.0.4-ALPHA</Text>
            <Text style={styles.mottoText}>THE CITY IS ON YOUR SIDE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AuthGateSheet
        sheetRef={authGateRef}
        featureLabel="your full trust network"
        onNavigateToAuth={() => {}}
      />

      {/* Engine Bypass Overlay */}
      {devMenuVisible && (
        <View style={styles.devOverlay}>
          <View style={styles.devSheet}>
            <Text style={styles.devTitle}>ENGINE CALIBRATION</Text>
            
            <TouchableOpacity style={styles.devRow} onPress={() => setPendingProvider('gemini')}>
              <Text style={styles.devLabel}>Gemini (Atmospheric)</Text>
              {pendingProvider === 'gemini' && <Text style={styles.devCheck}>SELECT</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.devRow} onPress={() => setPendingProvider('openai')}>
              <Text style={styles.devLabel}>OpenAI (Logical)</Text>
              {pendingProvider === 'openai' && <Text style={styles.devCheck}>SELECT</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.confirmButton, pendingProvider === llmProvider && styles.confirmDisabled]} 
              onPress={handleConfirmSwitch}
              disabled={pendingProvider === llmProvider}
            >
              <Text style={styles.confirmButtonText}>COMMIT CALIBRATION</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setDevMenuVisible(false)} style={styles.closeDev}>
              <Text style={styles.closeDevText}>Back to Surface</Text>
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
  navTitle: { 
    color: "#FAFAF8", 
    fontSize: 12, 
    fontWeight: "900", 
    letterSpacing: 2,
    textTransform: 'uppercase' 
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: { color: "#FAFAF8", fontSize: 24, fontWeight: '300' },
  content: { padding: 24 },
  header: { alignItems: "center", marginBottom: 40, marginTop: 10 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  avatarPlaceholderGuest: {
    borderColor: "#262626",
    borderStyle: 'dashed',
  },
  activeSignalBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#0D0D0D'
  },
  avatarText: { color: "#F59E0B", fontSize: 36, fontWeight: "800" },
  avatarTextGuest: { color: "#57534E" },
  displayName: { color: "#FAFAF8", fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  username: { color: "#57534E", fontSize: 14, marginTop: 4, fontWeight: '600' },
  
  upgradeCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#262626",
  },
  upgradeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  upgradeTitle: { color: "#FAFAF8", fontSize: 16, fontWeight: "800" },
  liveIndicator: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#F59E0B', 
    marginLeft: 8,
    shadowColor: '#F59E0B',
    shadowRadius: 4,
    shadowOpacity: 0.5
  },
  upgradeBody: { color: "#A8A29E", fontSize: 14, lineHeight: 20, marginBottom: 16 },
  upgradeCTA: { color: "#F59E0B", fontSize: 14, fontWeight: "800" },

  section: { marginBottom: 32 },
  sectionTitle: {
    color: "#57534E",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#141414",
    padding: 18,
    borderRadius: 14,
    marginBottom: 8,
  },
  rowLabel: { color: "#FAFAF8", fontSize: 15, fontWeight: "700" },
  rowSubLabel: { color: "#57534E", fontSize: 12, marginTop: 2 },
  rowValue: { color: "#57534E", fontSize: 18 },
  statusValue: { color: "#10B981", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  footer: { marginTop: 20, alignItems: "center", paddingBottom: 40 },
  signOutButton: { marginBottom: 24 },
  signOutText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
  versionText: { color: "#262626", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  mottoText: { color: "#1A1A1A", fontSize: 9, fontWeight: "800", marginTop: 4 },

  devOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  devSheet: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  devTitle: { 
    color: '#F59E0B', 
    fontWeight: '900', 
    marginBottom: 24, 
    fontSize: 14, 
    letterSpacing: 2,
    textAlign: 'center'
  },
  devRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: '#262626'
  },
  devLabel: { color: '#FAFAF8', fontSize: 15, fontWeight: '600' },
  devCheck: { color: '#F59E0B', fontWeight: '900', fontSize: 12 },
  confirmButton: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.3 },
  confirmButtonText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
  closeDev: { marginTop: 32, alignItems: 'center' },
  closeDevText: { color: '#57534E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }
});