import React, { useState } from "react";
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
// This links to your global user state
import { useSessionStore } from "../store/useSessionStore"; 
import { useNavigation } from "@react-navigation/native";
// This handles the iPhone notch/dynamic island spacing
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);

  const [incognito, setIncognito] = useState(false);
  const [notifications, setNotifications] = useState(true);

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
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || user?.username?.charAt(0) || "H"}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.name || "HADE Traveler"}</Text>
          <Text style={styles.username}>@{user?.username || "traveler"}</Text>
        </View>

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

        <View style={styles.footer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>HADE v1.0.0-alpha · Prototyping the Future</Text>
        </View>
      </ScrollView>
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
  // ... Keep all your existing styles from here down
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
});