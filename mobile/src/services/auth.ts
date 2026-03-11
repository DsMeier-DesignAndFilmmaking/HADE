import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/useSessionStore";

// Required for auth sessions to close correctly when returning from OAuth browser
WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Phone auth — OTP (requires SMS provider like Twilio for non-test numbers)
// ---------------------------------------------------------------------------

export async function sendOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
}

export async function verifyOtp(
  phone: string,
  token: string,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error) throw new Error(error.message);
}

export async function signInAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Google OAuth — PKCE flow via Supabase + expo-web-browser
// ---------------------------------------------------------------------------

/**
 * Opens the Google consent screen in the system browser using the PKCE flow.
 *
 * PKCE requires an explicit code exchange step: after the browser redirects
 * back to `hade://auth/callback?code=XXX`, we must call
 * `exchangeCodeForSession` to trade the code for a real session. Without this
 * call the auth code is silently discarded and no session is ever created.
 *
 * We also eagerly hydrate the Zustand store so the Axios interceptor in
 * `api.ts` can read the access token synchronously in the same call stack as
 * `syncOrFallback()` — `onAuthStateChange` is async and may lag behind.
 */
/**
 * Returns the OAuth callback URI for the current runtime environment.
 *   iPhone Simulator / Physical Device → hade://auth/callback
 *   Expo Web (http://10.0.0.145:<port>)  → http://10.0.0.145:<port>/auth/callback
 *
 * This URL must be registered in:
 *   Supabase → Authentication → URL Configuration → Redirect URLs
 */
function getRedirectUri(): string {
  const uri = Linking.createURL("auth/callback");
  if (__DEV__) {
    console.log("[OAuth] Redirect URI →", uri);
  }
  return uri;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectUri = getRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw new Error(error.message);
  if (!data.url) throw new Error("No OAuth URL returned from Supabase");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  // 'cancel' means the user dismissed the browser — not an error worth surfacing
  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled");
  }

  // Parse Supabase/Google error from the callback URL BEFORE exchanging.
  // If hade://auth/callback is not in Supabase's Allowed Redirect URLs,
  // Supabase immediately returns ?error=redirect_uri_not_allowed without ever
  // showing Google's consent screen — this is the "sheet flashes and closes"
  // symptom on iOS. Surface the error description so it's diagnosable.
  const callbackUrl = new URL(result.url);
  const oauthError = callbackUrl.searchParams.get("error");
  const oauthErrorDesc = callbackUrl.searchParams.get("error_description");
  if (oauthError) {
    throw new Error(
      oauthErrorDesc
        ? oauthErrorDesc.replace(/\+/g, " ")
        : oauthError,
    );
  }

  // PKCE: exchange the auth code in the redirect URL for a Supabase session.
  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(result.url);
  if (sessionError) throw new Error(sessionError.message);

  // Eagerly push the session into Zustand so syncOrFallback() can read the
  // access token immediately without waiting for onAuthStateChange to fire.
  if (sessionData.session) {
    useSessionStore.getState().setSession(sessionData.session);
  }
}

// ---------------------------------------------------------------------------
// Email auth — password-based (works immediately, no SMS needed)
// ---------------------------------------------------------------------------

/**
 * Create a new account with email + password.
 * Optionally embeds displayName + username in user_metadata at creation
 * so there's no separate updateUser call needed.
 *
 * When Supabase has "Confirm email" disabled (recommended for dev),
 * a session is returned immediately. When enabled, the user must
 * confirm via email first — we return { needsConfirmation: true }.
 */
export async function emailSignUp(
  email: string,
  password: string,
  profile?: { displayName: string; username: string },
): Promise<{ needsConfirmation: boolean }> {
  const options: Record<string, any> = {};
  if (profile) {
    options.data = {
      display_name: profile.displayName,
      username: profile.username,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options,
  });
  if (error) throw new Error(error.message);

  // No session = email confirmation is enabled in Supabase Dashboard
  if (!data.session) {
    return { needsConfirmation: true };
  }

  return { needsConfirmation: false };
}

export async function emailSignIn(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Shared — works with all auth methods
// ---------------------------------------------------------------------------

export async function updateUserMetadata(params: {
  username: string;
  displayName: string;
}): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { display_name: params.displayName, username: params.username },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  useSessionStore.getState().clearAuth();
}

export function getAccessToken(): string | null {
  return useSessionStore.getState().supabaseSession?.access_token ?? null;
}
