/**
 * useCompanions — React Query hooks for the Walk Plans / Companion
 * Matching feature. Mirrors the web `useCompanions` hook so the two
 * clients hit the exact same backend endpoints.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { CompanionRequest, WalkPlan } from '../types';

type PlanFilters = {
  date?: string;
  region?: string;
  trail_type?: string;
};

export function useWalkPlans(filters: PlanFilters = {}) {
  return useQuery<WalkPlan[]>({
    queryKey: ['walk-plans', filters],
    queryFn: async () => {
      const { data } = await api.get('/walk-plans/', { params: filters });
      return (data.results ?? data) as WalkPlan[];
    },
  });
}

export function useMyWalkPlans() {
  return useQuery<WalkPlan[]>({
    queryKey: ['my-walk-plans'],
    queryFn: async () => {
      const { data } = await api.get('/me/walk-plans/');
      return (data.results ?? data) as WalkPlan[];
    },
  });
}

export function useCreateWalkPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      trail: number;
      planned_date: string;
      planned_time: string | null;
      pace: string;
      max_companions: number;
      preferred_gender: string;
      preferred_age_range: string;
      message: string;
    }) => (await api.post('/walk-plans/', body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['walk-plans'] });
      qc.invalidateQueries({ queryKey: ['my-walk-plans'] });
    },
  });
}

export function useRequestCompanion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      message,
    }: {
      planId: number;
      message: string;
    }) =>
      (await api.post(`/walk-plans/${planId}/request_companion/`, { message }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['walk-plans'] }),
  });
}

export function usePlanRequests(planId: number, enabled: boolean) {
  return useQuery<CompanionRequest[]>({
    queryKey: ['plan-requests', planId],
    queryFn: async () =>
      (await api.get(`/walk-plans/${planId}/requests/`)).data,
    enabled: enabled && !!planId,
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(`/companion-requests/${requestId}/accept/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-walk-plans'] });
      qc.invalidateQueries({ queryKey: ['plan-requests'] });
    },
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post(`/companion-requests/${requestId}/reject/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-walk-plans'] });
      qc.invalidateQueries({ queryKey: ['plan-requests'] });
    },
  });
}

export const PACE_LABELS: Record<
  string,
  { emoji: string; label: string }
> = {
  slow: { emoji: '🌸', label: '느긋하게' },
  moderate: { emoji: '🚶', label: '보통' },
  fast: { emoji: '💨', label: '빠르게' },
};
