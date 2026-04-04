import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { WalkPlan, CompanionRequest, CompanionReview, ChatRoom, ChatMessage } from "@/types";

export function useWalkPlans(params?: Record<string, string>) {
  return useQuery<WalkPlan[]>({
    queryKey: ["walk-plans", params],
    queryFn: async () => {
      const { data } = await api.get("/walk-plans/", { params });
      return data.results ?? data;
    },
  });
}

export function useWalkPlan(id: number) {
  return useQuery<WalkPlan>({
    queryKey: ["walk-plan", id],
    queryFn: async () => (await api.get(`/walk-plans/${id}/`)).data,
    enabled: !!id,
  });
}

export function useTrailWalkPlans(trailId: number) {
  return useQuery<WalkPlan[]>({
    queryKey: ["trail-walk-plans", trailId],
    queryFn: async () => {
      const { data } = await api.get("/walk-plans/", { params: { trail: trailId } });
      return data.results ?? data;
    },
    enabled: !!trailId,
  });
}

export function useMyWalkPlans() {
  return useQuery<WalkPlan[]>({
    queryKey: ["my-walk-plans"],
    queryFn: async () => (await api.get("/me/walk-plans/")).data,
  });
}

export function useCreateWalkPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => (await api.post("/walk-plans/", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["walk-plans"] }),
  });
}

export function useRequestCompanion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, message }: { planId: number; message: string }) =>
      (await api.post(`/walk-plans/${planId}/request_companion/`, { message })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["walk-plans"] }),
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(`/companion-requests/${requestId}/accept/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-walk-plans"] }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(`/companion-requests/${requestId}/reject/`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-walk-plans"] }),
  });
}

export function useChatRooms() {
  return useQuery<ChatRoom[]>({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      try {
        return (await api.get("/chat-rooms/")).data;
      } catch {
        return [];
      }
    },
    retry: false,
  });
}

export function useChatMessages(roomId: number) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", roomId],
    queryFn: async () => (await api.get(`/chat-rooms/${roomId}/messages/`)).data,
    enabled: !!roomId,
    refetchInterval: 10000, // polling every 10s
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, content }: { roomId: number; content: string }) =>
      (await api.post(`/chat-rooms/${roomId}/messages/send/`, { content })).data,
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["chat-messages", vars.roomId] }),
  });
}

export function useCompanionReviews(nickname: string) {
  return useQuery<CompanionReview[]>({
    queryKey: ["companion-reviews", nickname],
    queryFn: async () => (await api.get(`/users/${nickname}/companion-reviews/`)).data,
    enabled: !!nickname,
  });
}
