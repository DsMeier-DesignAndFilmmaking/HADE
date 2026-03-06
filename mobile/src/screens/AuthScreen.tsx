import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  emailSignIn,
  emailSignUp,
  sendOtp,
  updateUserMetadata,
  verifyOtp,
} from "../services/auth";
import { postAuthSync } from "../services/api";
import { useSessionStore } from "../store/useSessionStore";
import { supabase } from "../lib/supabase";
import type { User } from "../types";

// ─── Types ───────────────────────────────────────────────────
type AuthMode = "welcome" | "create" | "signin";
type CreateStep = "form" | "done";
type SignInMethod = "phone" | "email";
type SignInStep = "credentials" | "otp";

interface AuthScreenProps {
  onBypass: () => void;
}

/**
 * Build a local User from Supabase auth metadata.
 * Fallback when the backend /auth/sync is unreachable.
 */
function buildLocalUser(supaUser: {
  id: string;
  user_metadata?: Record<string, any>;
  phone?: string;
  email?: string;
}): User {
  const meta = supaUser.user_metadata ?? {};
  return {
    id: supaUser.id,
    username: meta.username ?? null,
    name: meta.display_name ?? meta.username ?? "User",
    email: supaUser.email ?? null,
    home_city: "",
    onboarding_complete: false,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
  };
}

/**
 * Try backend sync, fall back to Supabase metadata.
 * Returns true if user was resolved.
 */
async function syncOrFallback(
  syncParams: Record<string, string>,
): Promise<boolean> {
  // 1. Try backend
  try {
    const resp = await postAuthSync(syncParams);
    if (resp.data) {
      useSessionStore.getState().setUser(resp.data);
      return true;
    }
  } catch {
    console.warn("[Auth] Backend sync unreachable — using Supabase metadata");
  }

  // 2. Fallback to Supabase metadata
  try {
    const {
      data: { user: supaUser },
    } = await supabase.auth.getUser();
    if (supaUser) {
      const localUser = buildLocalUser(supaUser);
      // Merge in any params we tried to sync
      if (syncParams.username) localUser.username = syncParams.username;
      if (syncParams.name) localUser.name = syncParams.name;
      useSessionStore.getState().setUser(localUser);
      return true;
    }
  } catch {
    console.warn("[Auth] Supabase getUser also failed");
  }
  return false;
}

// ═════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════

export default function AuthScreen({
  onBypass,
}: AuthScreenProps): React.JSX.Element {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const user = useSessionStore((s) => s.user);

  const [mode, setMode] = useState<AuthMode>("welcome");

  // — Create Account state —
  const [createStep, setCreateStep] = useState<CreateStep>("form");
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  // — Sign In state —
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("phone");
  const [signInStep, setSignInStep] = useState<SignInStep>("credentials");
  const [phone, setPhone] = useState("+1");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [otp, setOtp] = useState("");

  // — Shared —
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputRef = useRef<TextInput>(null);

  // Fade-in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auto-focus OTP
  useEffect(() => {
    if (signInStep === "otp") {
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [signInStep]);

  // After email sign-in, auto-resolve user
  useEffect(() => {
    if (isAuthenticated && !user && mode === "signin" && signInMethod === "email") {
      syncOrFallback({}).finally(() => setLoading(false));
    }
  }, [isAuthenticated, user, mode, signInMethod]);

  // ─── Validation ─────────────────────────────────────────────
  const isEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhoneValid = phone.replace(/\D/g, "").length >= 10;

  const canCreateAccount =
    createName.trim().length > 0 &&
    createUsername.trim().length > 0 &&
    isEmailValid(createEmail) &&
    createPassword.length >= 6;

  // ─── Create Account ─────────────────────────────────────────
  const handleCreateAccount = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const name = createName.trim();
    const uname = createUsername.trim().toLowerCase();

    try {
      // Create Supabase user with email+password + metadata in one call
      const { needsConfirmation } = await emailSignUp(
        createEmail.trim(),
        createPassword,
        { displayName: name, username: uname },
      );

      if (needsConfirmation) {
        // Email confirmation is enabled in Supabase Dashboard.
        // Tell user to check email, then sign in afterward.
        setError(
          "Account created. Check your email to confirm, then sign in.",
        );
        setLoading(false);
        return;
      }

      // Session returned immediately — sync to backend (or fallback)
      await syncOrFallback({ username: uname, name });
    } catch (err: any) {
      const msg = err.message ?? "Something went wrong";
      if (msg.toLowerCase().includes("already registered")) {
        setError("An account with this email already exists. Try signing in.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign In: Phone OTP ─────────────────────────────────────
  const handleSendOtp = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await sendOtp(phone);
      setSignInStep("otp");
    } catch (err: any) {
      setError(err.message ?? "Failed to send code");
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
      // After verify, isAuthenticated flips → try sync
      await syncOrFallback({});
    } catch (err: any) {
      setError(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await sendOtp(phone);
    } catch (err: any) {
      setError(err.message ?? "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign In: Email ─────────────────────────────────────────
  const handleEmailSignIn = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await emailSignIn(signInEmail.trim(), signInPassword);
      // useEffect will handle sync after isAuthenticated flips
    } catch (err: any) {
      setError(err.message ?? "Invalid email or password");
      setLoading(false);
    }
  };

  // ─── Navigation ─────────────────────────────────────────────
  const goBack = () => {
    setError(null);
    if (mode === "signin" && signInStep === "otp") {
      setSignInStep("credentials");
      setOtp("");
    } else {
      setMode("welcome");
      setCreateStep("form");
      setSignInStep("credentials");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER: WELCOME
  // ═══════════════════════════════════════════════════════════
  if (mode === "welcome") {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.welcomeContent, { opacity: fadeAnim }]}>
          <View>
            <Text style={styles.welcomeLogo}>HADE</Text>
            <Text style={styles.welcomeTagline}>
              The city is on your side tonight.
            </Text>
          </View>

          <View style={styles.welcomeActions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setMode("create");
                setError(null);
              }}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setMode("signin");
                setError(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                I already have an account
              </Text>
            </Pressable>

            <Pressable style={styles.bypassButton} onPress={onBypass}>
              <Text style={styles.bypassText}>Developer Bypass</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: CREATE ACCOUNT
  // ═══════════════════════════════════════════════════════════
  if (mode === "create") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={12}>
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Create your account</Text>
            <Text style={styles.headerSubtitle}>
              Set up your profile to get started
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display name</Text>
              <TextInput
                style={styles.input}
                value={createName}
                onChangeText={setCreateName}
                placeholder="How friends see you"
                placeholderTextColor="#57534E"
                autoCapitalize="words"
                textContentType="name"
                autoFocus
              />

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={createUsername}
                onChangeText={(t) =>
                  setCreateUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder="unique_handle"
                placeholderTextColor="#57534E"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={createEmail}
                onChangeText={setCreateEmail}
                placeholder="you@email.com"
                placeholderTextColor="#57534E"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />

              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={createPassword}
                onChangeText={setCreatePassword}
                placeholder="Min 6 characters"
                placeholderTextColor="#57534E"
                secureTextEntry
                textContentType="newPassword"
              />

              <Pressable
                style={[
                  styles.actionButton,
                  (loading || !canCreateAccount) && styles.actionButtonDisabled,
                ]}
                onPress={handleCreateAccount}
                disabled={loading || !canCreateAccount}
              >
                {loading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.actionButtonText}>Create Account</Text>
                )}
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: SIGN IN
  // ═══════════════════════════════════════════════════════════
  const signInTitle =
    signInStep === "otp" ? "Verify your number" : "Welcome back";
  const signInSubtitle =
    signInStep === "otp"
      ? `Code sent to ${phone}`
      : signInMethod === "phone"
        ? "Sign in with your phone number"
        : "Sign in with your email";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{signInTitle}</Text>
          <Text style={styles.headerSubtitle}>{signInSubtitle}</Text>

          {/* Method tabs — only on credentials step */}
          {signInStep === "credentials" && (
            <View style={styles.tabs}>
              <Pressable
                style={[
                  styles.tab,
                  signInMethod === "phone" && styles.tabActive,
                ]}
                onPress={() => {
                  setSignInMethod("phone");
                  setError(null);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    signInMethod === "phone" && styles.tabTextActive,
                  ]}
                >
                  Phone
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  signInMethod === "email" && styles.tabActive,
                ]}
                onPress={() => {
                  setSignInMethod("email");
                  setError(null);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    signInMethod === "email" && styles.tabTextActive,
                  ]}
                >
                  Email
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── PHONE CREDENTIALS ─────────────────────── */}
          {signInStep === "credentials" && signInMethod === "phone" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor="#57534E"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoFocus
              />
              <Pressable
                style={[
                  styles.actionButton,
                  (loading || !isPhoneValid) && styles.actionButtonDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={loading || !isPhoneValid}
              >
                {loading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.actionButtonText}>Send Code</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ─── EMAIL CREDENTIALS ─────────────────────── */}
          {signInStep === "credentials" && signInMethod === "email" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={signInEmail}
                onChangeText={setSignInEmail}
                placeholder="you@email.com"
                placeholderTextColor="#57534E"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoFocus
              />
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={signInPassword}
                onChangeText={setSignInPassword}
                placeholder="Your password"
                placeholderTextColor="#57534E"
                secureTextEntry
                textContentType="password"
              />
              <Pressable
                style={[
                  styles.actionButton,
                  (loading ||
                    !isEmailValid(signInEmail) ||
                    signInPassword.length < 6) &&
                    styles.actionButtonDisabled,
                ]}
                onPress={handleEmailSignIn}
                disabled={
                  loading ||
                  !isEmailValid(signInEmail) ||
                  signInPassword.length < 6
                }
              >
                {loading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.actionButtonText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ─── OTP VERIFICATION ──────────────────────── */}
          {signInStep === "otp" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>6-digit code</Text>
              <TextInput
                ref={otpInputRef}
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, "").slice(0, 6);
                  setOtp(digits);
                  if (digits.length === 6) {
                    setTimeout(() => handleVerifyOtp(), 200);
                  }
                }}
                placeholder="000000"
                placeholderTextColor="#57534E"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />

              <Pressable
                style={[
                  styles.actionButton,
                  (loading || otp.length < 6) && styles.actionButtonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.actionButtonText}>Verify</Text>
                )}
              </Pressable>

              <View style={styles.otpLinks}>
                <Pressable onPress={handleResendOtp} disabled={loading}>
                  <Text
                    style={[styles.linkText, loading && styles.linkDisabled]}
                  >
                    Resend code
                  </Text>
                </Pressable>
                <Pressable onPress={goBack}>
                  <Text style={styles.linkText}>Different number</Text>
                </Pressable>
              </View>

              {__DEV__ && (
                <Text style={styles.devHint}>Dev: OTP is always 000000</Text>
              )}
            </View>
          )}

          {/* ─── ERROR ─────────────────────────────────── */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  flex: { flex: 1 },

  /* ── Welcome ─────────────────────────────────── */
  welcomeContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  welcomeLogo: {
    color: "#F59E0B",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
  },
  welcomeTagline: {
    color: "#78716C",
    fontSize: 20,
    lineHeight: 28,
    marginTop: 12,
    fontStyle: "italic",
  },
  welcomeActions: { gap: 14 },
  primaryButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  primaryButtonText: { color: "#000000", fontSize: 17, fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#FAFAF8", fontSize: 16, fontWeight: "600" },
  bypassButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#0D0D0D",
  },
  bypassText: {
    color: "#57534E",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* ── Header ──────────────────────────────────── */
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  backArrow: {
    color: "#FAFAF8",
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 36,
    marginBottom: 16,
  },
  headerTitle: {
    color: "#FAFAF8",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: { color: "#78716C", fontSize: 15, marginTop: 4 },

  /* ── Tabs ────────────────────────────────────── */
  tabs: {
    flexDirection: "row",
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#F59E0B" },
  tabText: { color: "#57534E", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#000000" },

  /* ── Content ─────────────────────────────────── */
  scrollContent: { padding: 24, paddingBottom: 60 },
  inputGroup: { gap: 20 },
  inputLabel: {
    color: "#78716C",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderRadius: 12,
    padding: 18,
    color: "#FAFAF8",
    fontSize: 16,
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },

  /* ── Action Button ───────────────────────────── */
  actionButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    marginTop: 4,
  },
  actionButtonDisabled: { opacity: 0.35 },
  actionButtonText: { color: "#000000", fontSize: 16, fontWeight: "800" },

  /* ── Links ───────────────────────────────────── */
  linkText: { color: "#3B82F6", fontSize: 14 },
  linkDisabled: { opacity: 0.4 },
  otpLinks: { flexDirection: "row", justifyContent: "space-between" },

  /* ── Error ───────────────────────────────────── */
  errorBox: {
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  errorText: { color: "#EF4444", fontSize: 14, textAlign: "center" },

  /* ── Dev ─────────────────────────────────────── */
  devHint: { color: "#57534E", fontSize: 12, textAlign: "center", marginTop: 8 },
});
