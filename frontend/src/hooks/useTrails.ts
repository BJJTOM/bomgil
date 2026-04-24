import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
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

/**
 * Cursor-paginated infinite list. Hand the rendered element an
 * IntersectionObserver target at the bottom of the grid to trigger
 * fetchNextPage().
 */
export function useInfiniteTrails(params?: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: ["trails", "infinite", params],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      // Cursor pagination: subsequent pages are full URLs returned by
      // the DRF `next` field. Strip everything up to `?` and let axios
      // send the query-string verbatim so we don't lose the cursor.
      if (pageParam) {
        const qs = String(pageParam).split("?")[1] || "";
        const { data } = await api.get(`/trails/?${qs}`);
        return data;
      }
      const { data } = await api.get("/trails/", { params });
      return data;
    },
    getNextPageParam: (lastPage: { next?: string | null }) => lastPage?.next ?? null,
  });
}

export function useTrail(id: number) {
  return useQuery({
    queryKey: ["trail", id],
    queryFn: async () => {
      // `_silent` — the detail page already renders an inline
      // "코스를 찾을 수 없어요" card when `trail` is null, so a 404
      // from a deleted/stale bookmark doesn't need to also explode
      // in the global axios toast.
      const { data } = await api.get(`/trails/${id}/`, {
        _silent: true,
      } as any);
      return data;
    },
    enabled: Number.isFinite(id) && id > 0,
    retry: false,
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
