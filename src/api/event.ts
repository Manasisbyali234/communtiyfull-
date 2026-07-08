import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient, API_BASE_URL } from './client';
import { Event, ApiResponse, PaginatedResponse } from '../types';
import { useEventStore } from '../store/eventStore';

const getBase = () => API_BASE_URL.replace('/api/v1', '');
const toAbs = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('/')) return `${getBase()}${url}`;
  const s3Match = url.match(/https?:\/\/.+?\.amazonaws\.com\/(.+)/);
  if (s3Match) return `${getBase()}/api/v1/media/proxy/${encodeURIComponent(s3Match[1])}`;
  if (url.includes('localhost')) return url.replace(/http:\/\/localhost(:\d+)?/, getBase());
  return url;
};

const normalizeEvent = (e: any): Event => ({
  ...e,
  coverUrl: toAbs(e.coverUrl),
});

export const eventKeys = {
  all: ['events'] as const,
  list: () => [...eventKeys.all, 'list'] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
};

export function useEventsQuery() {
  const localEvents = useEventStore((s) => s.localEvents);
  const removeEvent = useEventStore((s) => s.removeEvent);

  const query = useQuery<Event[]>({
    queryKey: eventKeys.list(),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PaginatedResponse<Event>>>('/events');
        const data = res.data.data.data;
        return (data ?? []).map(normalizeEvent);
      } catch {
        return [];
      }
    },
  });

  const serverData = query.data ?? [];
  const serverIds = new Set(serverData.map((e) => e.id));

  // Evict local events once the server confirms them
  useEffect(() => {
    const confirmedIds = new Set(serverData.map((e) => e.id));
    localEvents.forEach((e) => {
      if (confirmedIds.has(e.id)) removeEvent(e.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

  const newLocals = localEvents.filter((e) => !serverIds.has(e.id));
  const merged = [...newLocals, ...serverData];

  return { ...query, data: merged };
}

export function useCreateEventMutation() {
  const addLocalEvent = useEventStore((s) => s.addEvent);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      location?: string;
      startsAt: string;
      endsAt?: string;
      coverUrl?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<Event>>('/events', payload);
      return normalizeEvent(res.data.data);
    },
    onSuccess: (newEvent) => {
      addLocalEvent(newEvent);
      queryClient.invalidateQueries({ queryKey: eventKeys.list() });
    },
    onError: (_err, variables) => {
      // Backend failed — create a local-only event so it still shows in the UI
      const localEvent: Event = {
        id: `local-${Date.now()}`,
        title: variables.title,
        description: variables.description,
        location: variables.location,
        startsAt: variables.startsAt,
        endsAt: variables.endsAt,
        coverUrl: variables.coverUrl,
        rsvpCount: 0,
        creatorId: 'local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addLocalEvent(localEvent);
    },
  });
}
