import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";

interface CreateMoveSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function CreateMoveSheet({ onClose }: CreateMoveSheetProps): React.JSX.Element {
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState("DRINK");
  const [decayHours, setDecayHours] = useState(3);
  const [isRecording, setIsRecording] = useState(false);

  const INTENTS = ["DRINK", "EAT", "CHILL", "SCENE"];
  const DECAY_OPTIONS = [1, 3, 6];

  // Animation for the Voice Signal Pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handleVoiceCapture = () => {
    setIsRecording(!isRecording);
    // Logic for Speech-to-Text would be triggered here
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Terminal Header */}
        <View style={styles.header}>
          <Text style={styles.terminalLine}>$ SIGNAL_INITIATED...</Text>
          <Text style={styles.mainHeading}>BROADCAST A MOVE</Text>
        </View>

        {/* Primary Input Section with Voice CTA */}
        <View style={styles.inputSection}>
          <View style={styles.labelRow}>
            
            <Pressable 
              onPress={handleVoiceCapture} 
              style={[styles.voiceTrigger, isRecording && styles.voiceTriggerActive]}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={[styles.voiceIcon, isRecording && { color: '#0D0D0D' }]}>🎤</Text>
              </Animated.View>
              <Text style={[styles.voiceText, isRecording && { color: '#0D0D0D' }]}>
                {isRecording ? "LISTENING..." : "VOICE_INTENT"}
              </Text>
            </Pressable>
          </View>

          <TextInput
            style={[styles.hugeInput, isRecording && { color: '#F59E0B' }]}
            placeholder="Rooftop Negronis"
            placeholderTextColor="#262626"
            value={title}
            onChangeText={setTitle}
            maxLength={40}
            autoFocus
          />
        </View>

        {/* Intent Calibration */}
        <View style={styles.section}>
          <Text style={styles.label}>[02] SYSTEM_INTENT</Text>
          <View style={styles.chipRow}>
            {INTENTS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setIntent(item)}
                style={[styles.chip, intent === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, intent === item && styles.chipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Decay Window Calibration */}
        <View style={styles.section}>
          <Text style={styles.label}>[03] DECAY_WINDOW (HOURS)</Text>
          <View style={styles.chipRow}>
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

        {/* Footer Metrics */}
        <View style={styles.footerMetrics}>
          <Text style={styles.metricText}>GEO_TAG: ACTIVE</Text>
          <Text style={styles.metricText}>TRUST_WEIGHT: 1.0</Text>
          <Text style={styles.metricText}>AUTO_PURGE: ENABLED</Text>
        </View>

        {/* Action Button */}
        <Pressable 
          style={[styles.broadcastButton, !title && styles.broadcastDisabled]}
          onPress={onClose}
        >
          <Text style={styles.broadcastText}>GO LIVE</Text>
        </Pressable>

        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelText}>ABORT_SESSION</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 12,
  },
  header: {
    marginBottom: 40,
  },
  terminalLine: {
    color: "#F59E0B",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
    opacity: 0.6,
  },
  mainHeading: {
    color: "#FAFAF8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3,
    marginTop: 4,
  },
  inputSection: {
    marginBottom: 48,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1C1917',
  },
  voiceTriggerActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  voiceIcon: {
    fontSize: 12,
    marginRight: 6,
    color: '#F59E0B',
  },
  voiceText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  label: {
    color: "#57534E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  hugeInput: {
    color: "#FAFAF8",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.5,
    padding: 0,
  },
  section: {
    marginBottom: 32,
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    backgroundColor: "#141414",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#1C1917",
  },
  chipActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  chipText: {
    color: "#57534E",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  chipTextActive: {
    color: "#0D0D0D",
  },
  footerMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#141414",
    marginBottom: 40,
  },
  metricText: {
    color: "#262626",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  broadcastButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 22,
    borderRadius: 2,
    alignItems: "center",
  },
  broadcastDisabled: {
    backgroundColor: "#141414",
    opacity: 0.5,
  },
  broadcastText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 4,
  },
  cancelButton: {
    marginTop: 24,
    alignItems: "center",
    paddingBottom: 40,
  },
  cancelText: {
    color: "#262626",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
});