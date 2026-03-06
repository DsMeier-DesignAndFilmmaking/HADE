import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/useSessionStore";

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
