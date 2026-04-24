import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Spot } from "@/types";

export function useTrailSpots(trailId: number) {
  return useQuery<Spot[]>({
    queryKey: ["trail-spots", trailId],
    queryFn: async () => {
      // _silent: deleted/stale trail 404s shouldn't toast — the spot
      // section just hides itself when the array is empty.
      const { data } = await api.get(`/trails/${trailId}/spots/`, {
        _silent: true,
      } as any);
      return data;
    },
    enabled: Number.isFinite(trailId) && trailId > 0,
    retry: false,
  });
}
