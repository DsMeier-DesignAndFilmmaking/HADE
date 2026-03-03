import { useMutation, useQuery } from "@tanstack/react-query";
import { getNearbySignals, postSignal } from "../services/api";
import type { Signal, SignalCreate } from "../types";

export function useNearbySignals(lat: number | null, lng: number | null) {
  return useQuery<Signal[]>({
    queryKey: ["signals-nearby", lat, lng],
    queryFn: async () => {
      if (lat === null || lng === null) return [];
      const response = await getNearbySignals({ lat, lng });
      return response.data?.signals ?? [];
    },
    enabled: lat !== null && lng !== null,
  });
}

export function useEmitSignal() {
  return useMutation({
    mutationFn: (params: SignalCreate) => postSignal(params),
  });
}
