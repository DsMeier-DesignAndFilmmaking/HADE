import { supabase } from "../lib/supabase";
import { useSessionStore } from "../store/useSessionStore";

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
  // Session is set automatically via onAuthStateChange listener
}

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
