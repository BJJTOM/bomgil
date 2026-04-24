import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Review } from "@/types";

export function useTrailReviews(trailId: number) {
  return useQuery<Review[]>({
    queryKey: ["trail-reviews", trailId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/trails/${trailId}/`, {
        _silent: true,
      } as any);
      return data.results ?? data;
    },
    enabled: Number.isFinite(trailId) && trailId > 0,
    retry: false,
  });
}

export function useCreateReview(trailId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      rating: number;
      content: string;
      visited_date: string;
    }) => {
      const { data } = await api.post(`/reviews/trails/${trailId}/`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trail-reviews", trailId] });
    },
  });
}

export function useToggleHelpful() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: number) => {
      const { data } = await api.post(`/reviews/${reviewId}/helpful/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trail-reviews"] });
    },
  });
}
