import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ActivityTrack, ActivityStats } from "@/types";

export function useActivities(params?: Record<string, string>) {
  return useQuery<ActivityTrack[]>({
    queryKey: ["activities", params],
    queryFn: async () => {
      const { data } = await api.get("/activities/", { params });
      return data.results ?? data;
    },
  });
}

export function useActivity(id: number | string) {
  return useQuery<ActivityTrack>({
    queryKey: ["activity", id],
    queryFn: async () => {
      const { data } = await api.get(`/activities/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useActivityStats() {
  return useQuery<ActivityStats>({
    queryKey: ["activity-stats"],
    queryFn: async () => {
      const { data } = await api.get("/activities/my_stats/");
      return data;
    },
  });
}

export function useTrailActivities(trailId: number | string) {
  return useQuery<ActivityTrack[]>({
    queryKey: ["trail-activities", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/activities/trail/${trailId}/`, {
        _silent: true,
      } as any);
      return data.results ?? data;
    },
    enabled: (() => {
      if (!trailId) return false;
      const n = Number(trailId);
      return Number.isFinite(n) && n > 0;
    })(),
    retry: false,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post("/activities/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity-stats"] });
    },
  });
}

export function useCreateActivityJSON() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      track_points: { lat: number; lng: number; ele?: number | null; time?: string | null }[];
      source: string;
      title?: string;
      trail?: number;
      story?: number;
      total_steps?: number;
      calories_burned?: number;
      distance_km?: string;
      duration_minutes?: number;
      started_at?: string;
      finished_at?: string;
      elevation_gain_m?: number;
    }) => {
      const { data: result } = await api.post("/activities/", data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity-stats"] });
    },
  });
}
