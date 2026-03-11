import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "../services/supabase/types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage is Expo's cross-platform adapter: uses localStorage on web,
    // native secure storage on iOS/Android. No platform split needed.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Must stay false for popup-based PKCE (WebBrowser.openAuthSessionAsync).
    // If true, Supabase JS would auto-call exchangeCodeForSession when it
    // detects ?code= in the popup redirect URL, racing with our manual call
    // and consuming the one-time code twice → "code already used" on web.
    // Only set true for redirect-based (full-page-navigation) web OAuth.
    detectSessionInUrl: false,
  },
});

let pendingGhostSignIn: Promise<Session> | null = null;

/**
 * Ensure a Supabase session exists, creating an anonymous session only when
 * no active session is present. This preserves existing OTP/email sessions.
 */
export async function ensureSupabaseSession(): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  if (data.session) {
    return data.session;
  }

  if (pendingGhostSignIn) {
    return pendingGhostSignIn;
  }

  pendingGhostSignIn = (async () => {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      throw new Error(signInError.message);
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.getSession();
    if (refreshError || !refreshed.session) {
      throw new Error(refreshError?.message ?? "Anonymous session unavailable");
    }
    return refreshed.session;
  })().finally(() => {
    pendingGhostSignIn = null;
  });

  return pendingGhostSignIn;
}
