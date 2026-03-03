import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendOtp, verifyOtp } from "../services/auth";

type Step = "phone" | "otp";

export default function LoginScreen(): React.JSX.Element {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+1");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (): Promise<void> => {
    if (phone.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      await sendOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(phone, otp);
      // Navigation happens automatically via auth state change
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.title}>HADE</Text>
          <Text style={styles.subtitle}>
            {step === "phone"
              ? "Enter your phone number"
              : "Enter the verification code"}
          </Text>
        </View>

        {step === "phone" ? (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 123 4567"
              placeholderTextColor="#57534E"
              keyboardType="phone-pad"
              autoFocus
              accessibilityLabel="Phone number"
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={loading || phone.length < 4}
              accessibilityRole="button"
              accessibilityLabel="Send verification code"
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.buttonText}>Send Code</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor="#57534E"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              accessibilityLabel="Verification code"
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              accessibilityRole="button"
              accessibilityLabel="Verify code"
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.backLink}>Use a different number</Text>
            </Pressable>
          </View>
        )}

        {error !== null && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.devHint}>Dev mode: OTP is always 000000</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: { marginBottom: 32 },
  title: {
    color: "#FAFAF8",
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#A8A29E",
    fontSize: 16,
  },
  inputGroup: { gap: 16 },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 16,
    color: "#FAFAF8",
    fontSize: 18,
    letterSpacing: 1,
  },
  button: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
  },
  backLink: {
    color: "#3B82F6",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: { color: "#EF4444", fontSize: 13 },
  devHint: {
    color: "#57534E",
    fontSize: 12,
    textAlign: "center",
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
  },
});
