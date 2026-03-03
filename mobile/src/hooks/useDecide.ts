import { useQuery } from "@tanstack/react-query";
import { postDecide } from "../services/api";
import type { DecideResponse, Intent } from "../types";

interface UseDecideParams {
  lat: number | null;
  lng: number | null;
  intent?: Intent;
  group_size?: number;
}

export function useDecide({ lat, lng, intent, group_size }: UseDecideParams) {
  return useQuery<DecideResponse | null>({
    queryKey: ["decide", lat, lng, intent, group_size],
    queryFn: async () => {
      if (lat === null || lng === null) return null;
      const response = await postDecide({
        geo: { lat, lng },
        intent,
        group_size,
      });
      return response.data;
    },
    enabled: lat !== null && lng !== null,
  });
}
