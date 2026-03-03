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
import { sendOtp, updateUserMetadata, verifyOtp } from "../services/auth";
import { postAuthSync } from "../services/api";
import { useSessionStore } from "../store/useSessionStore";

type Step = "phone" | "otp" | "profile";

export default function AuthScreen(): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const [step, setStep] = useState<Step>(isAuthenticated ? "profile" : "phone");
  const [isNewUser, setIsNewUser] = useState(false);
  const [phone, setPhone] = useState("+1");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
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
      setError(err instanceof Error ? err.message : "Failed to send code");
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

      if (isNewUser && username.trim()) {
        // New user already filled in profile fields — sync immediately
        const trimmedUsername = username.trim().toLowerCase();
        const trimmedName = name.trim();
        await updateUserMetadata({
          username: trimmedUsername,
          displayName: trimmedName || trimmedUsername,
        });
        const resp = await postAuthSync({
          username: trimmedUsername,
          name: trimmedName || undefined,
        });
        if (resp.data) {
          useSessionStore.getState().setUser(resp.data);
        }
      } else {
        setStep("profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (): Promise<void> => {
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedUsername) {
      setError("Pick a username");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateUserMetadata({
        username: trimmedUsername,
        displayName: trimmedName || trimmedUsername,
      });

      const resp = await postAuthSync({
        username: trimmedUsername,
        name: trimmedName || undefined,
      });
      if (resp.data) {
        useSessionStore.getState().setUser(resp.data);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("409")
      ) {
        setError("That username is taken — try another");
      } else {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const subtitle = (): string => {
    if (step === "phone" && isNewUser) return "Create your account";
    switch (step) {
      case "phone":
        return "Sign in with your phone number";
      case "otp":
        return "Enter the code we sent you";
      case "profile":
        return "Pick a username to get started";
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
          <Text style={styles.subtitle}>{subtitle()}</Text>
        </View>

        {step === "phone" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone number</Text>
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
            {isNewUser && (
              <>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="username"
                  placeholderTextColor="#57534E"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Username"
                />
                <Text style={styles.inputLabel}>Display name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name (optional)"
                  placeholderTextColor="#57534E"
                  autoCapitalize="words"
                  accessibilityLabel="Display name"
                />
              </>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={loading || phone.length < 4 || (isNewUser && !username.trim())}
              accessibilityRole="button"
              accessibilityLabel={isNewUser ? "Create account" : "Sign in"}
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.buttonText}>
                  {isNewUser ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setIsNewUser(!isNewUser);
                setError(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.backLink}>
                {isNewUser ? "Already have an account? Sign in" : "Create a new account"}
              </Text>
            </Pressable>
          </View>
        )}

        {step === "otp" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Verification code</Text>
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
              <Text style={styles.backLink}>
                {isNewUser ? "Go back" : "Use a different number"}
              </Text>
            </Pressable>
          </View>
        )}

        {step === "profile" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#57534E"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Username"
            />
            <Text style={styles.inputLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name (optional)"
              placeholderTextColor="#57534E"
              autoCapitalize="words"
              accessibilityLabel="Display name"
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSync}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Finish setup"
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.buttonText}>Let{"\u2019"}s go</Text>
              )}
            </Pressable>
          </View>
        )}

        {error !== null && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {__DEV__ && (
          <Text style={styles.devHint}>
            Dev mode — Supabase Phone OTP
          </Text>
        )}
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
  inputLabel: {
    color: "#A8A29E",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: -8,
  },
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
