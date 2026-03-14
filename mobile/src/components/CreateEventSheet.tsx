import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import VoicePulse from "./voice/VoicePulse";
import LiveTranscript from "./voice/LiveTranscript";

interface CreateMoveSheetProps {
  visible: boolean;
  onClose: () => void;
  onDecide?: (intent: string) => void;
}

const SUGGESTIONS = [
  "Coffee",
  "Quiet Study",
  "Architecture",
  "Golden Hour Walk",
  "Patio Drinks",
  "Late Brunch",
];

const DECAY_OPTIONS = [1, 3, 6];

export default function CreateMoveSheet({
  onClose,
  onDecide,
}: CreateMoveSheetProps): React.JSX.Element {
  const [intent, setIntent] = useState("Coffee");
  const [decayHours, setDecayHours] = useState(3);
  const [isListening, setIsListening] = useState(false);

  const commitIntent = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      onDecide?.(trimmed);
    }
    onClose();
  };

  const handlePulsePressIn = () => {
    setIsListening(true);
  };

  const handlePulsePressOut = () => {
    setIsListening(false);
    commitIntent(intent);
  };

  const handleSuggestionPress = (value: string) => {
    setIntent(value);
    commitIntent(value);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.terminalLine}>$ VOICE_FIRST_MODE</Text>
          <Text style={styles.mainHeading}>SAY THE MOVE</Text>
        </View>

        <View style={styles.voiceSection}>
          <LiveTranscript text={intent} />
          <View style={styles.pulseRow}>
            <VoicePulse
              isListening={isListening}
              onPressIn={handlePulsePressIn}
              onPressOut={handlePulsePressOut}
            />
          </View>
          <Text style={styles.pulseHint}>
            {isListening ? "Release to decide" : "Hold to speak"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>INTENT CHIPS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionRow}
          >
            {SUGGESTIONS.map((item) => (
              <Pressable
                key={item}
                onPress={() => handleSuggestionPress(item)}
                style={[styles.chip, intent === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, intent === item && styles.chipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>DECAY WINDOW (HOURS)</Text>
          <View style={styles.decayRow}>
            {DECAY_OPTIONS.map((hr) => (
              <Pressable
                key={hr}
                onPress={() => setDecayHours(hr)}
                style={[styles.chip, decayHours === hr && styles.chipActive]}
              >
                <Text style={[styles.chipText, decayHours === hr && styles.chipTextActive]}>
                  {hr}H
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.footerMetrics}>
          <Text style={styles.metricText}>GEO_TAG: ACTIVE</Text>
          <Text style={styles.metricText}>TRUST_WEIGHT: 1.0</Text>
          <Text style={styles.metricText}>AUTO_PURGE: ENABLED</Text>
        </View>

        {!isListening && (
          <Pressable style={styles.broadcastButton} onPress={() => commitIntent(intent)}>
            <Text style={styles.broadcastText}>DECIDE NOW</Text>
          </Pressable>
        )}

        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
  },
  header: {
    marginBottom: 28,
  },
  terminalLine: {
    color: "#FFB800",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1.5,
    opacity: 0.75,
  },
  mainHeading: {
    color: "#F5F1E8",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 6,
  },
  voiceSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  pulseRow: {
    marginTop: 18,
    marginBottom: 16,
  },
  pulseHint: {
    color: "#B08900",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 28,
  },
  label: {
    color: "#3A3A3A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  suggestionRow: {
    flexDirection: "row",
    gap: 10,
  },
  decayRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    backgroundColor: "#0E0E0E",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1D1D1D",
  },
  chipActive: {
    backgroundColor: "#FFB800",
    borderColor: "#FFB800",
  },
  chipText: {
    color: "#6E6E6E",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  chipTextActive: {
    color: "#0A0A0A",
  },
  footerMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#0E0E0E",
    marginBottom: 32,
  },
  metricText: {
    color: "#2A2A2A",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  broadcastButton: {
    backgroundColor: "#FFB800",
    paddingVertical: 18,
    borderRadius: 6,
    alignItems: "center",
  },
  broadcastText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
  },
  cancelButton: {
    marginTop: 20,
    alignItems: "center",
    paddingBottom: 40,
  },
  cancelText: {
    color: "#2A2A2A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
