import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { Message, Notification, PaginatedResponse, ApiResponse, Conversation } from '../types';
import { useEffect } from 'react';
import { getSocket, onSocketReady } from './socket';
import { useAuthStore } from '../store/authStore';

export const chatKeys = {
  all: ['chats'] as const,
  list: () => [...chatKeys.all, 'list'] as const,
  messages: (chatId: string) => [...chatKeys.all, 'messages', chatId] as const,
};

// Fetch active chat list
export function useChatsQuery() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  return useQuery<Conversation[]>({
    queryKey: chatKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Conversation[]>>('/messages/conversations');
      const conversations = res.data.data;
      // Inject `participant` helper from the participants array
      return conversations.map((conv) => ({
        ...conv,
        participant:
          conv.participant ??
          conv.participants?.find((p) => p.userId !== currentUserId)?.user,
      }));
    },
  });
}

// Fetch messages for a specific chat
export function useMessagesQuery(chatId: string) {
  return useQuery<Message[]>(
    {
      queryKey: chatKeys.messages(chatId),
      enabled: !!chatId,
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<PaginatedResponse<Message>>>(`/messages/conversations/${chatId}`);
        return res.data.data.data;
      },
    }
  );
}

// Send a message
export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation<Message, Error, { chatId: string; content: string }>({
    mutationFn: async ({ chatId, content }) => {
      const res = await apiClient.post<ApiResponse<Message>>(`/messages/conversations/${chatId}`, { content });
      return res.data.data;
    },
    onMutate: async ({ chatId, content }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId: chatId,
        content,
        createdAt: new Date().toISOString(),
        senderId: useAuthStore.getState().user?.id ?? '',
      } as any;
      queryClient.setQueryData<Message[]>(chatKeys.messages(chatId), (old) =>
        old ? [optimistic, ...old] : [optimistic]
      );
      return { optimisticId: optimistic.id, chatId };
    },
    onSuccess: (data, { chatId }, context: any) => {
      // Replace optimistic message with real one (socket may have already inserted it)
      queryClient.setQueryData<Message[]>(chatKeys.messages(chatId), (old) => {
        if (!old) return [data];
        const withoutOptimistic = old.filter(m => m.id !== context?.optimisticId);
        if (withoutOptimistic.some(m => m.id === data.id)) return withoutOptimistic;
        return [data, ...withoutOptimistic];
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
    onError: (_err, { chatId }, context: any) => {
      queryClient.setQueryData<Message[]>(chatKeys.messages(chatId), (old) =>
        old ? old.filter(m => m.id !== context?.optimisticId) : old
      );
    },
  });
}

// Start or get conversation with user
export function useStartConversationMutation() {
  const queryClient = useQueryClient();
  return useMutation<Conversation, Error, { participantId: string }>({
    mutationFn: async ({ participantId }) => {
      const res = await apiClient.post<ApiResponse<Conversation>>('/messages/conversations', { participantId });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
export function useNotificationsQuery() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications');
      return res.data.data.data;
    },
  });
}

export function useUnreadCountQuery() {
  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
      return res.data.data.count;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// Listen to real-time notifications
export function useNotificationSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
        if (!old) return [notification];
        if (old.some((n) => n.id === notification.id)) return old;
        return [notification, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    };

    socket.on('notification:new', handleNew);
    return () => { socket.off('notification:new', handleNew); };
  }, [queryClient]);
}

// Listen to real-time chat messages
export function useChatSocket(conversationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleNewMessage = (payload: any) => {
      const message: Message = payload?.message ?? payload;

      if (conversationId && message.conversationId === conversationId) {
        queryClient.setQueryData<Message[]>(chatKeys.messages(conversationId), (old) => {
          if (!old) return [message];
          if (old.some(m => m.id === message.id)) return old;
          return [message, ...old];
        });
      }

      queryClient.setQueryData<Conversation[]>(chatKeys.list(), (old) => {
        if (!old) return old;
        return old.map(conv => {
          if (conv.id === message.conversationId) {
            return { ...conv, lastMessage: message, lastMessageAt: message.createdAt };
          }
          return conv;
        }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
      });
    };

    // Subscribe immediately if socket is already connected, otherwise wait
    const subscribe = (s: ReturnType<typeof getSocket>) => {
      if (!s) return;
      s.off('chat:message', handleNewMessage);
      s.on('chat:message', handleNewMessage);
    };

    subscribe(getSocket());
    const unsub = onSocketReady(subscribe);

    return () => {
      unsub();
      getSocket()?.off('chat:message', handleNewMessage);
    };
  }, [conversationId, queryClient]);
}
