import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

/**
 * HADE Trust Network
 * Intimate view of "Human Sensors" and their recent signals.
 * Logic: High-texture, minimal interaction, maximum context.
 */

// Mock Data for Design/Dev Mode
const MOCK_FRIENDS = [
  {
    id: "1",
    name: "Maya",
    handle: "@mayaj",
    lastSignal: "Common Grounds",
    timeAgo: "12m",
    status: "active", 
  },
  {
    id: "2",
    name: "Soren",
    handle: "@soren_explores",
    lastSignal: "Union Station",
    timeAgo: "2h",
    status: "idle",
  },
  {
    id: "3",
    name: "Elena",
    handle: "@elena_v",
    lastSignal: "Larimer Square",
    timeAgo: "4d",
    status: "inactive",
  },
];

export default function TrustNetworkScreen(): React.JSX.Element {
  // APPLYING THE QUICK FIX: Cast hook to 'any' to bypass TS route checking during prototyping
  const navigation = useNavigation<any>();

  const renderFriend = ({ item }: { item: typeof MOCK_FRIENDS[0] }) => (
    <TouchableOpacity 
      style={styles.friendCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("Profile", { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, item.status === "active" && styles.avatarActive]}>
          <Text style={styles.avatarLetter}>{item.name.charAt(0)}</Text>
        </View>
        {item.status === "active" && <View style={styles.statusIndicator} />}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.handle}>{item.handle}</Text>
        </View>
        <Text style={styles.signalText} numberOfLines={1}>
          {item.status === "active" ? "📍 Current: " : "Last seen: "}
          <Text style={styles.locationText}>{item.lastSignal}</Text>
          <Text style={styles.timeText}> · {item.timeAgo}</Text>
        </Text>
      </View>
      
      <Text style={styles.chevron}>→</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Trust Network</Text>
        <Text style={styles.title}>Your Sensors.</Text>
        <Text style={styles.description}>
          The humans whose taste you trust to calibrate the city.
        </Text>
      </View>

      <FlatList
        data={MOCK_FRIENDS}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <TouchableOpacity style={styles.addButton} activeOpacity={0.6}>
            <Text style={styles.addButtonText}>+ Expand Network</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { padding: 32, paddingBottom: 16 },
  eyebrow: { 
    color: "#F59E0B", 
    fontSize: 12, 
    fontWeight: "800", 
    letterSpacing: 1.5, 
    textTransform: "uppercase", 
    marginBottom: 8 
  },
  title: { color: "#FAFAF8", fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  description: { color: "#A8A29E", fontSize: 16, lineHeight: 24, marginTop: 12 },
  listContent: { padding: 24, paddingBottom: 100 },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#262626",
  },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  avatarActive: {
    borderColor: "#F59E0B",
    borderWidth: 2,
  },
  avatarLetter: { color: "#FAFAF8", fontSize: 18, fontWeight: "700" },
  statusIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F59E0B",
    borderWidth: 2,
    borderColor: "#1A1A1A",
  },
  infoContainer: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#FAFAF8", fontSize: 16, fontWeight: "700" },
  handle: { color: "#57534E", fontSize: 14 },
  signalText: { color: "#A8A29E", fontSize: 13, marginTop: 4 },
  locationText: { color: "#FAFAF8", fontWeight: "600" },
  timeText: { color: "#57534E" },
  chevron: { color: "#262626", fontSize: 20, fontWeight: "600" },
  addButton: {
    marginTop: 24,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#262626",
    alignItems: "center",
  },
  addButtonText: { color: "#F59E0B", fontSize: 14, fontWeight: "700" },
});