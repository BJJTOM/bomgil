import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Spot } from "@/types";

export function useTrailSpots(trailId: number) {
  return useQuery<Spot[]>({
    queryKey: ["trail-spots", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${trailId}/spots/`);
      return data;
    },
    enabled: !!trailId,
  });
}
