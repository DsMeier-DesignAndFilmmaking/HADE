import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "../services/supabase/types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
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
