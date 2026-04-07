import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Trail {
  id: number;
  author: {
    id: number;
    nickname: string;
    profile_image: string | null;
  };
  title: string;
  region: string;
  country: string;
  distance_km: string;
  estimated_minutes: number;
  difficulty: "easy" | "moderate" | "hard";
  cover_image: string;
  tags: { id: number; name: string }[];
  best_season: string;
  view_count: number;
  like_count: number;
  is_liked: boolean;
  created_at: string;
}

export function useTrails(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["trails", params],
    queryFn: async () => {
      const { data } = await api.get("/trails/", { params });
      return data;
    },
  });
}

export function useTrail(id: number) {
  return useQuery({
    queryKey: ["trail", id],
    queryFn: async () => {
      const { data } = await api.get(`/trails/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function usePopularTrails() {
  return useQuery({
    queryKey: ["trails", "popular"],
    queryFn: async () => {
      const { data } = await api.get("/trails/popular/");
      return data;
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trailId: number) => {
      const { data } = await api.post(`/trails/${trailId}/like/`);
      return data;
    },
    onSuccess: (_data, trailId) => {
      queryClient.invalidateQueries({ queryKey: ["trails"] });
      queryClient.invalidateQueries({ queryKey: ["trail", trailId] });
    },
  });
}
