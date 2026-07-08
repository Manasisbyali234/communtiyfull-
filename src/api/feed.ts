import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_BASE_URL } from './client';
import { Post, Comment, User, PaginatedResponse, ApiResponse } from '../types';
import { useAuthStore } from '../store/authStore';

const getBase = () => API_BASE_URL.replace('/api/v1', '');

const toAbs = (url?: string): string | undefined => {
  if (!url) return undefined;
  // Relative path → prepend backend base
  if (url.startsWith('/')) return `${getBase()}${url}`;
  // S3 direct URL → rewrite through backend media proxy
  const s3Match = url.match(/https?:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/(.+)/);
  if (s3Match) return `${getBase()}/api/v1/media/proxy/${encodeURIComponent(s3Match[1])}`;
  // localhost URL → rewrite to current dynamic host
  if (url.includes('localhost')) return url.replace(/http:\/\/localhost(:\d+)?/, getBase());
  return url;
};

export const feedKeys = {
  all: ['feed'] as const,
  posts: () => [...feedKeys.all, 'posts'] as const,
  communityPosts: (communityId: string) => [...feedKeys.posts(), { communityId }] as const,
  userPosts: (userId: string) => [...feedKeys.posts(), { userId }] as const,
  savedPosts: () => [...feedKeys.posts(), 'saved'] as const,
  post: (id: string) => [...feedKeys.all, 'post', id] as const,
  comments: (postId: string) => [...feedKeys.all, 'comments', postId] as const,
};

export const userKeys = {
  all: ['users'] as const,
  user: (id: string) => [...userKeys.all, id] as const,
};

export function useUserQuery(userId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<User | null>({
    queryKey: userKeys.user(userId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<User>>(`/users/${userId}`);
      return res.data.data;
    },
    enabled: !!userId && isAuthenticated,
  });
}


function normalizePost(p: any): Post {
  const rawUrls: string[] = p.mediaUrls ?? [];
  const absUrls = rawUrls.map((u: string) => toAbs(u) ?? u);
  return {
    ...p,
    author: {
      ...p.author,
      avatarUrl: toAbs(p.author?.avatarUrl) ?? p.author?.avatarUrl,
    },
    mediaUrls: absUrls,
    mediaUrl: toAbs(p.mediaUrl) ?? toAbs(absUrls[0]) ?? undefined,
    images: absUrls.length > 1 ? absUrls : (p.images?.map((u: string) => toAbs(u) ?? u) ?? undefined),
    videoUrl: toAbs(p.videoUrl) ?? p.videoUrl ?? undefined,
    tags: p.tags ?? p.hashtags?.map((h: any) => h.hashtag?.name ?? h.name) ?? [],
    isLiked: p.isLiked ?? (p.likes?.length > 0),
    isBookmarked: p.isBookmarked ?? (p.bookmarks?.length > 0),
    community: p.community
      ? {
          ...p.community,
          avatarUrl: toAbs(p.community.avatarUrl) ?? p.community.avatarUrl,
          bannerUrl: toAbs(p.community.bannerUrl) ?? p.community.bannerUrl,
          membersCount: p.community.membersCount ?? p.community.memberCount ?? 0,
          isJoined: p.community.isJoined ?? false,
        }
      : undefined,
  };
}

// Fetch all feed posts — falls back to trending if personal feed is empty
export function usePostsQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Post[]>({
    queryKey: feedKeys.posts(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    queryFn: async () => {
      const [feedRes, trendingRes] = await Promise.all([
        apiClient.get<ApiResponse<PaginatedResponse<Post>>>('/posts/feed'),
        apiClient.get<ApiResponse<PaginatedResponse<Post>>>('/posts/trending'),
      ]);
      const feedPosts: any[] = feedRes.data.data.data ?? [];
      if (feedPosts.length > 0) return feedPosts.map(normalizePost);
      return (trendingRes.data.data.data ?? []).map(normalizePost);
    },
  });
}

// Fetch a single post
export function usePostQuery(postId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Post | null>({
    queryKey: feedKeys.post(postId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Post>>(`/posts/${postId}`);
      return normalizePost(res.data.data);
    },
    enabled: !!postId && isAuthenticated,
  });
}

// Fetch posts within a specific community
export function useCommunityPostsQuery(communityId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Post[]>({
    queryKey: feedKeys.communityPosts(communityId),
    enabled: !!communityId && isAuthenticated,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Post>>>(`/communities/${communityId}/posts`);
      return (res.data.data.data ?? []).map(normalizePost);
    },
  });
}

// Fetch posts by a user
export function useUserPostsQuery(userId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Post[]>({
    queryKey: feedKeys.userPosts(userId),
    enabled: !!userId && isAuthenticated,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Post>>>(`/users/${userId}/posts`);
      return (res.data.data.data ?? []).map(normalizePost);
    },
  });
}

// Fetch saved posts
export function useSavedPostsQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Post[]>({
    queryKey: feedKeys.savedPosts(),
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Post>>>('/posts/saved');
      return res.data.data.data;
    },
  });
}

// Create a post
export function useCreatePostMutation() {
  const queryClient = useQueryClient();
  return useMutation<Post, Error, { content: string; communityId?: string; mediaType?: string; mediaUrl?: string; videoUrl?: string; videoFileName?: string; mimeType?: string; fileSize?: number; tags?: string[] }>({
    mutationFn: async (newPost) => {
      const res = await apiClient.post<ApiResponse<Post>>('/posts', {
        content: newPost.content || '',
        communityId: newPost.communityId || undefined,
        mediaUrls: newPost.mediaUrl ? [newPost.mediaUrl] : undefined,
        mediaType: newPost.mediaType,
        videoUrl: newPost.videoUrl || undefined,
        videoFileName: newPost.videoFileName || undefined,
        mimeType: newPost.mimeType || undefined,
        fileSize: newPost.fileSize || undefined,
        tags: newPost.tags,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: feedKeys.posts() });
      if (data.communityId) {
        queryClient.invalidateQueries({ queryKey: feedKeys.communityPosts(data.communityId) });
      }
    },
  });
}

// Like post mutation
export function useLikePostMutation() {
  const queryClient = useQueryClient();
  return useMutation<Post | null, Error, string>({
    mutationFn: async (postId) => {
      const res = await apiClient.post<ApiResponse<Post>>(`/posts/${postId}/like`);
      return res.data.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.posts() });
      const prev = queryClient.getQueryData<Post[]>(feedKeys.posts());
      queryClient.setQueryData<Post[]>(feedKeys.posts(), (old) =>
        old?.map((p) => p.id === postId ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 } : p)
      );
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(feedKeys.posts(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.posts() });
    },
  });
}

// Bookmark/Save post mutation
export function useSavePostMutation() {
  const queryClient = useQueryClient();
  return useMutation<Post | null, Error, string>({
    mutationFn: async (postId) => {
      const res = await apiClient.post<ApiResponse<Post>>(`/posts/${postId}/bookmark`);
      return res.data.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.posts() });
      const prev = queryClient.getQueryData<Post[]>(feedKeys.posts());
      queryClient.setQueryData<Post[]>(feedKeys.posts(), (old) =>
        old?.map((p) => p.id === postId ? { ...p, isBookmarked: !p.isBookmarked } : p)
      );
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(feedKeys.posts(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.posts() });
    },
  });
}

// Fetch comments for a post
export function usePostCommentsQuery(postId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Comment[]>({
    queryKey: feedKeys.comments(postId),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Comment>>>(`/posts/${postId}/comments`);
      return res.data.data.data;
    },
    enabled: !!postId && isAuthenticated,
  });
}

// Add comment to a post
export function useAddCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation<Comment, Error, { postId: string; content: string }>({
    mutationFn: async ({ postId, content }) => {
      const res = await apiClient.post<ApiResponse<Comment>>(`/posts/${postId}/comments`, { content });
      return res.data.data;
    },
    onMutate: async ({ postId, content }) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.comments(postId) });
      const prevComments = queryClient.getQueryData<Comment[]>(feedKeys.comments(postId));
      const { user } = useAuthStore.getState();
      const optimistic: Comment = {
        id: `temp-${Date.now()}`,
        postId,
        authorId: user?.id ?? '',
        author: user as User,
        content,
        likesCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (old = []) => [optimistic, ...old]);
      // Optimistically bump commentsCount on the post
      queryClient.setQueryData<Post[]>(feedKeys.posts(), (old) =>
        old?.map((p) => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p)
      );
      return { prevComments };
    },
    onError: (_err, { postId }, ctx: any) => {
      if (ctx?.prevComments) queryClient.setQueryData(feedKeys.comments(postId), ctx.prevComments);
    },
    onSuccess: (data) => {
      // Replace optimistic entry with real server data
      queryClient.setQueryData<Comment[]>(feedKeys.comments(data.postId), (old = []) =>
        old.map((c) => c.id.startsWith('temp-') ? data : c)
      );
      queryClient.invalidateQueries({ queryKey: feedKeys.posts() });
      queryClient.invalidateQueries({ queryKey: feedKeys.post(data.postId) });
    },
  });
}
