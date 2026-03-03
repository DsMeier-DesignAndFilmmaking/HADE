/**
 * Auth helpers for HADE mobile app.
 * Uses dev auth endpoints for local development.
 * Swap to Supabase auth for production.
 */

import { useSessionStore } from "../store/useSessionStore";
import { api } from "./api";
import type { ApiResponse, User } from "../types";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

export async function sendOtp(phone: string): Promise<void> {
  await api.post<ApiResponse<{ message: string }>>("/auth/dev/send-otp", {
    phone,
  });
}

export async function verifyOtp(phone: string, token: string): Promise<User> {
  const { data } = await api.post<ApiResponse<AuthTokens>>(
    "/auth/dev/verify-otp",
    { phone, token },
  );

  const authData = data.data;
  if (!authData) {
    throw new Error("No auth data returned");
  }

  useSessionStore
    .getState()
    .setTokens(authData.access_token, authData.refresh_token);
  useSessionStore.getState().setUser(authData.user);

  return authData.user;
}

export async function signOut(): Promise<void> {
  useSessionStore.getState().clearAuth();
}

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
