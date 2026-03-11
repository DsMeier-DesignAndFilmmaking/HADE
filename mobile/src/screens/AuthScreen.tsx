import React, { useCallback, useEffect, useRef, useState } from "react";
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
  signInWithGoogle,
  updateUserMetadata,
  verifyOtp,
} from "../services/auth";
import { postAuthSync } from "../services/api";
import { useSessionStore } from "../store/useSessionStore";
import { supabase } from "../lib/supabase";
import type { User } from "../types";

// ─── Design tokens ────────────────────────────────────────────
// "Modern McGee" — warm cream, layered surfaces, amber accent.
const C = {
  bg:          "#F7F4F0",   // warm cream background
  surface:     "#FFFFFF",   // white card / input surface
  surfaceAlt:  "#F0EDE8",   // slightly darker cream (secondary surfaces)
  border:      "#E7E4DF",   // warm light gray border
  borderStrong:"#D6D3D1",   // stronger border (focused inputs, dividers)
  text:        "#1C1917",   // warm near-black (primary text)
  textMuted:   "#78716C",   // warm gray (secondary text)
  textFaint:   "#A8A29E",   // placeholder / caption
  accent:      "#F59E0B",   // HADE amber CTA
  accentText:  "#000000",   // text on amber buttons
  link:        "#3B82F6",   // blue links
  error:       "#DC2626",   // error text
  errorBg:     "#FEF2F2",   // error toast background
  errorBorder: "#FECACA",   // error toast border
  infoBg:      "#FFFBEB",   // info toast background (amber-tinted)
  infoBorder:  "#FDE68A",   // info toast border
  infoText:    "#92400E",   // info toast text
} as const;

// ─── Error message mapping ────────────────────────────────────
// Translates cryptic Supabase / Google OAuth errors into copy
// a non-technical user can act on. Returns "" for silent cases.
const AUTH_ERROR_MAP: Array<[string, string]> = [
  ["redirect uri not allowed",   "Config error: add hade://auth/callback to Supabase Redirect URLs."],
  ["redirect_uri_not_allowed",   "Config error: add hade://auth/callback to Supabase Redirect URLs."],
  ["redirect_uri_mismatch",      "Config error: add the Supabase callback URL to Google Cloud Console."],
  ["invalid request",            "Sign-in request was invalid — please try again."],
  ["access_denied",              "Access denied — please try signing in again."],
  ["email not confirmed",        "Check your email and confirm your account first."],
  ["invalid login credentials",  "Email or password is incorrect."],
  ["user already registered",    "An account with this email already exists. Sign in instead."],
  ["google sign-in was cancelled", ""],  // silent — user dismissed intentionally
];

function mapAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  for (const [key, friendly] of AUTH_ERROR_MAP) {
    if (lower.includes(key)) return friendly;
  }
  return raw; // pass unknown errors through unchanged
}

// ─── Types ────────────────────────────────────────────────────
type AuthMode = "welcome" | "create" | "signin";
type CreateStep = "form" | "done";
type SignInMethod = "phone" | "email";
type SignInStep = "credentials" | "otp";
type ToastType = "error" | "info";

interface AuthScreenProps {
  onBypass: () => void;
}

// ─── Pure helpers (no component state) ───────────────────────

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
    // Supabase populates Google OAuth metadata as full_name / name.
    // display_name is never set by Google — checking it last prevents silent "User" fallback.
    name: meta.full_name ?? meta.name ?? meta.display_name ?? meta.username ?? "User",
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
  const setAuthLoading = useSessionStore((s) => s.setAuthLoading);

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

  const otpInputRef = useRef<TextInput>(null);

  // ─── Toast system ─────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const toastY = useRef(new Animated.Value(-120)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastY, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [toastY]);

  const showToast = useCallback(
    (raw: string, type: ToastType = "error") => {
      const message = mapAuthError(raw);
      if (!message) return; // empty = intentionally silent
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, type });
      toastY.setValue(-120);
      Animated.spring(toastY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
      toastTimer.current = setTimeout(dismissToast, 5000);
    },
    [toastY, dismissToast],
  );

  // ─── Animations ───────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auto-focus OTP
  useEffect(() => {
    if (signInStep === "otp") {
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  }, [signInStep]);

  // Auto-resolve user after any auth state change (Google, email, phone)
  useEffect(() => {
    if (isAuthenticated && !user) {
      syncOrFallback({}).finally(() => setLoading(false));
    }
  }, [isAuthenticated, user]);

  // ─── Validation ───────────────────────────────────────────
  const isEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isPhoneValid = phone.replace(/\D/g, "").length >= 10;

  const canCreateAccount =
    createName.trim().length > 0 &&
    createUsername.trim().length > 0 &&
    isEmailValid(createEmail) &&
    createPassword.length >= 6;

  // ─── Create Account ───────────────────────────────────────
  const handleCreateAccount = async (): Promise<void> => {
    setLoading(true);
    const name = createName.trim();
    const uname = createUsername.trim().toLowerCase();

    try {
      const { needsConfirmation } = await emailSignUp(
        createEmail.trim(),
        createPassword,
        { displayName: name, username: uname },
      );

      if (needsConfirmation) {
        showToast("Account created. Check your email to confirm, then sign in.", "info");
        setLoading(false);
        return;
      }

      await syncOrFallback({ username: uname, name });
    } catch (err: any) {
      showToast(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign In: Phone OTP ───────────────────────────────────
  const handleSendOtp = async (): Promise<void> => {
    setLoading(true);
    try {
      await sendOtp(phone);
      setSignInStep("otp");
    } catch (err: any) {
      showToast(err.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    if (otp.length < 6) return;
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      await syncOrFallback({});
    } catch (err: any) {
      showToast(err.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    setLoading(true);
    try {
      await sendOtp(phone);
    } catch (err: any) {
      showToast(err.message ?? "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign In: Email ───────────────────────────────────────
  const handleEmailSignIn = async (): Promise<void> => {
    setLoading(true);
    try {
      await emailSignIn(signInEmail.trim(), signInPassword);
      // useEffect handles sync after isAuthenticated flips
    } catch (err: any) {
      showToast(err.message ?? "Invalid email or password");
      setLoading(false);
    }
  };

  // ─── Google SSO ───────────────────────────────────────────
  const handleGoogleSignIn = async (): Promise<void> => {
    setLoading(true);
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      await syncOrFallback({});
    } catch (err: any) {
      // mapAuthError returns "" for "Google sign-in was cancelled" → silent
      showToast(err.message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  // ─── Navigation ───────────────────────────────────────────
  const goBack = () => {
    dismissToast();
    if (mode === "signin" && signInStep === "otp") {
      setSignInStep("credentials");
      setOtp("");
    } else {
      setMode("welcome");
      setCreateStep("form");
      setSignInStep("credentials");
    }
  };

  // ─── Toast JSX ────────────────────────────────────────────
  const toastJSX = toast ? (
    <Animated.View
      style={[
        styles.toast,
        toast.type === "error" ? styles.toastError : styles.toastInfo,
        { transform: [{ translateY: toastY }] },
      ]}
    >
      <Text style={[styles.toastIcon, toast.type === "error" ? styles.toastIconError : styles.toastIconInfo]}>
        {toast.type === "error" ? "⚠" : "ℹ"}
      </Text>
      <Text
        style={[styles.toastText, toast.type === "error" ? styles.toastTextError : styles.toastTextInfo]}
        numberOfLines={3}
      >
        {toast.message}
      </Text>
      <Pressable onPress={dismissToast} hitSlop={12}>
        <Text style={[styles.toastDismiss, toast.type === "error" ? styles.toastTextError : styles.toastTextInfo]}>
          ✕
        </Text>
      </Pressable>
    </Animated.View>
  ) : null;

  // ═══════════════════════════════════════════════════════════
  // RENDER: WELCOME
  // ═══════════════════════════════════════════════════════════
  if (mode === "welcome") {
    return (
      <SafeAreaView style={styles.container}>
        {toastJSX}
        <Animated.View style={[styles.welcomeContent, { opacity: fadeAnim }]}>

          {/* ── Brand mark ── */}
          <View style={styles.brandBlock}>
            <Text style={styles.welcomeLogo}>HADE</Text>
            <Text style={styles.welcomeTagline}>
              The city is on your side tonight.
            </Text>
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Actions ── */}
          <View style={styles.welcomeActions}>

            {/* Google — primary path */}
            <Pressable
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.textMuted} />
              ) : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            {/* OR separator */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            {/* Create account — amber CTA */}
            <Pressable
              style={styles.primaryButton}
              onPress={() => { dismissToast(); setMode("create"); }}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </Pressable>

            {/* Sign in — text link only */}
            <Pressable
              style={styles.signInLink}
              onPress={() => { dismissToast(); setMode("signin"); }}
            >
              <Text style={styles.signInLinkText}>Already have an account? <Text style={styles.signInLinkAccent}>Sign in</Text></Text>
            </Pressable>

            {/* Dev bypass */}
            {__DEV__ && (
              <Pressable style={styles.bypassButton} onPress={onBypass}>
                <Text style={styles.bypassText}>Developer Bypass</Text>
              </Pressable>
            )}
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
        {toastJSX}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backLabel}>Back</Text>
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
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Display name</Text>
                <TextInput
                  style={styles.input}
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder="How friends see you"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="words"
                  textContentType="name"
                  autoFocus
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={createUsername}
                  onChangeText={(t) =>
                    setCreateUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="unique_handle"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={createEmail}
                  onChangeText={setCreateEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={createPassword}
                  onChangeText={setCreatePassword}
                  placeholder="Min 6 characters"
                  placeholderTextColor={C.textFaint}
                  secureTextEntry
                  textContentType="newPassword"
                />
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  (loading || !canCreateAccount) && styles.buttonDisabled,
                ]}
                onPress={handleCreateAccount}
                disabled={loading || !canCreateAccount}
              >
                {loading ? (
                  <ActivityIndicator color={C.accentText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </Pressable>
            </View>
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
      {toastJSX}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{signInTitle}</Text>
          <Text style={styles.headerSubtitle}>{signInSubtitle}</Text>

          {/* Method tabs — only on credentials step */}
          {signInStep === "credentials" && (
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, signInMethod === "phone" && styles.tabActive]}
                onPress={() => { setSignInMethod("phone"); dismissToast(); }}
              >
                <Text style={[styles.tabText, signInMethod === "phone" && styles.tabTextActive]}>
                  Phone
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, signInMethod === "email" && styles.tabActive]}
                onPress={() => { setSignInMethod("email"); dismissToast(); }}
              >
                <Text style={[styles.tabText, signInMethod === "email" && styles.tabTextActive]}>
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
          {/* ─── PHONE CREDENTIALS ─── */}
          {signInStep === "credentials" && signInMethod === "phone" && (
            <View style={styles.inputGroup}>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Phone number</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={C.textFaint}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoFocus
                />
              </View>
              <Pressable
                style={[
                  styles.primaryButton,
                  (loading || !isPhoneValid) && styles.buttonDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={loading || !isPhoneValid}
              >
                {loading ? (
                  <ActivityIndicator color={C.accentText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Code</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ─── EMAIL CREDENTIALS ─── */}
          {signInStep === "credentials" && signInMethod === "email" && (
            <View style={styles.inputGroup}>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={signInEmail}
                  onChangeText={setSignInEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={C.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoFocus
                />
              </View>
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={signInPassword}
                  onChangeText={setSignInPassword}
                  placeholder="Your password"
                  placeholderTextColor={C.textFaint}
                  secureTextEntry
                  textContentType="password"
                />
              </View>
              <Pressable
                style={[
                  styles.primaryButton,
                  (loading || !isEmailValid(signInEmail) || signInPassword.length < 6) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleEmailSignIn}
                disabled={loading || !isEmailValid(signInEmail) || signInPassword.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color={C.accentText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* ─── OTP VERIFICATION ─── */}
          {signInStep === "otp" && (
            <View style={styles.inputGroup}>
              <View style={styles.inputBlock}>
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
                  placeholderTextColor={C.textFaint}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  (loading || otp.length < 6) && styles.buttonDisabled,
                ]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
              >
                {loading ? (
                  <ActivityIndicator color={C.accentText} />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify</Text>
                )}
              </Pressable>

              <View style={styles.otpLinks}>
                <Pressable onPress={handleResendOtp} disabled={loading}>
                  <Text style={[styles.linkText, loading && styles.linkDisabled]}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  /* ── Toast ─────────────────────────────────────── */
  toast: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  toastError: {
    backgroundColor: C.errorBg,
    borderColor: C.errorBorder,
  },
  toastInfo: {
    backgroundColor: C.infoBg,
    borderColor: C.infoBorder,
  },
  toastIcon: { fontSize: 16 },
  toastIconError: { color: C.error },
  toastIconInfo: { color: C.infoText },
  toastText: { flex: 1, fontSize: 13, lineHeight: 18 },
  toastTextError: { color: C.error },
  toastTextInfo: { color: C.infoText },
  toastDismiss: { fontSize: 14, fontWeight: "700", opacity: 0.6 },

  /* ── Welcome ────────────────────────────────────── */
  welcomeContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 48,
  },
  brandBlock: {
    flex: 1,
    justifyContent: "center",
  },
  welcomeLogo: {
    color: C.text,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  welcomeTagline: {
    color: C.textMuted,
    fontSize: 18,
    lineHeight: 26,
    marginTop: 10,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 32,
  },
  welcomeActions: { gap: 12 },

  // Google button — white surface card
  googleButton: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    // Elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleG: {
    fontSize: 16,
    fontWeight: "900",
    color: "#4285F4",
    letterSpacing: -0.5,
  },
  googleButtonText: {
    color: C.text,
    fontSize: 16,
    fontWeight: "600",
  },

  // OR separator
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: {
    color: C.textFaint,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // Primary CTA — amber
  primaryButton: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: C.accentText,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // Sign-in text link
  signInLink: { alignItems: "center", paddingVertical: 8 },
  signInLinkText: { color: C.textMuted, fontSize: 14 },
  signInLinkAccent: { color: C.accent, fontWeight: "700" },

  // Dev bypass
  bypassButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bypassText: {
    color: C.textFaint,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // Shared disabled state
  buttonDisabled: { opacity: 0.38 },

  /* ── Header (form screens) ─────────────────────── */
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  backArrow: { color: C.textMuted, fontSize: 18 },
  backLabel: { color: C.textMuted, fontSize: 14, fontWeight: "500" },
  headerTitle: {
    color: C.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: { color: C.textMuted, fontSize: 14, marginTop: 4 },

  /* ── Tabs ───────────────────────────────────────── */
  tabs: {
    flexDirection: "row",
    backgroundColor: C.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.textMuted, fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: C.accentText },

  /* ── Content ────────────────────────────────────── */
  scrollContent: { padding: 24, paddingBottom: 60 },
  inputGroup: { gap: 16 },
  inputBlock: { gap: 6 },
  inputLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 16,
    color: C.text,
    fontSize: 16,
    // Subtle card elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },

  /* ── Links ──────────────────────────────────────── */
  linkText: { color: C.link, fontSize: 14 },
  linkDisabled: { opacity: 0.4 },
  otpLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },

  /* ── Dev ────────────────────────────────────────── */
  devHint: {
    color: C.textFaint,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
