import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { postSignal } from "../services/api";
import { useSessionStore } from "../store/useSessionStore";

/**
 * HADE CheckInScreen
 * "Signal Calibration" - Turning human presence into trust signals.
 */
export default function CheckInScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const user = useSessionStore((s) => s.user);

  const [loading, setLoading] = useState(false);
  const [vibe, setVibe] = useState<"chill" | "high-energy" | "focused">("chill");
  const [crowd, setCrowd] = useState(2); // 1: Quiet, 2: Buzzing, 3: Packed
  const [note, setNote] = useState("");

  const handleEmitSignal = async () => {
    setLoading(true);
    try {
      // Maps to SignalCreate Pydantic schema
      await postSignal({
        signal_type: "presence",
        venue_id: "current-venue-id", // To be passed via route params
        metadata: {
          vibe,
          crowd_level: crowd,
          note: note.trim(),
          emitted_by: user?.username,
        },
      } as any);

      Alert.alert("Signal Emitted", "You've calibrated this spot for the city.");
      navigation.goBack();
    } catch (err) {
      // Optimistic exit for design mode/bypass
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Contextual Sensory Input</Text>
        <Text style={styles.title}>Calibrate the vibe.</Text>
        <Text style={styles.description}>
          Your signal helps others decide if this spot matches the moment.
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Current Energy</Text>
          <View style={styles.chipRow}>
            {(["chill", "high-energy", "focused"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, vibe === v && styles.chipActive]}
                onPress={() => setVibe(v)}
              >
                <Text style={[styles.chipText, vibe === v && styles.chipTextActive]}>
                  {v.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Crowd Density</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, crowd === n && styles.chipActive]}
                onPress={() => setCrowd(n)}
              >
                <Text style={[styles.chipText, crowd === n && styles.chipTextActive]}>
                  {n === 1 ? "Quiet" : n === 2 ? "Buzzing" : "Packed"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Context Note (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 'Great playlist', 'Hidden patio is open'"
            placeholderTextColor="#57534E"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={100}
          />
        </View>

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleEmitSignal}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Emit Signal</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  content: { padding: 24, paddingBottom: 60 },
  eyebrow: { color: "#F59E0B", fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  title: { color: "#FAFAF8", fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  description: { color: "#A8A29E", fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 32 },
  section: { marginBottom: 32 },
  label: { color: "#FAFAF8", fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#262626" },
  chipActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  chipText: { color: "#57534E", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#0D0D0D" },
  input: { backgroundColor: "#1A1A1A", borderRadius: 12, padding: 18, color: "#FAFAF8", fontSize: 16, minHeight: 100, textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#F59E0B", borderRadius: 12, paddingVertical: 18, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#0D0D0D", fontSize: 18, fontWeight: "700" },
  cancelButton: { marginTop: 24, alignItems: "center" },
  cancelText: { color: "#57534E", fontSize: 14, fontWeight: "600" },
});