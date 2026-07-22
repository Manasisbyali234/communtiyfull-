import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { apiClient, API_BASE_URL } from './client';
import { ApiResponse } from '../types';
import { useAuthStore } from '../store/authStore';

export const storyKeys = {
  all: ['stories'] as const,
  feed: () => [...storyKeys.all, 'feed'] as const,
};

export interface StoryAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Story {
  id: string;
  authorId: string;
  author: StoryAuthor;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  likesCount: number;
}

export interface StoryGroup {
  user: StoryAuthor;
  stories: Story[];
  hasUnseen: boolean;
}

export function useStoryByIdQuery(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Story>({
    queryKey: [...storyKeys.all, 'single', id],
    enabled: isAuthenticated && !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Story>>(`/stories/${id}`);
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useStoriesFeedQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<StoryGroup[]>({
    queryKey: storyKeys.feed(),
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StoryGroup[]>>('/stories/feed');
      return res.data.data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateStoryMutation() {
  const queryClient = useQueryClient();
  return useMutation<Story, Error, { mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO' }>({
    mutationFn: async ({ mediaUrl, mediaType }) => {
      const res = await apiClient.post<ApiResponse<Story>>('/stories', { mediaUrl, mediaType });
      const data = res.data.data;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.feed() });
    },
  });
}

// ─── Story-specific S3 upload (stories/ folder only) ─────────────────────────
export async function uploadMediaFile(
  file: File | Blob | { uri: string; name: string; type: string },
  filename: string,
  mimeType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    formData.append('file', file as File | Blob, filename);
  } else {
    const nativeFile = file as { uri: string; name?: string; type?: string };
    formData.append('file', {
      uri: nativeFile.uri,
      name: nativeFile.name ?? filename,
      type: nativeFile.type ?? mimeType,
    } as any);
  }

  const token = useAuthStore.getState().token;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Uses the isolated story-upload endpoint — stores to stories/ in S3 only
    xhr.open('POST', `${API_BASE_URL}/story-upload/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          const url: string = json?.data?.url;
          if (!url) reject(new Error('No URL in upload response'));
          else resolve(url);
        } catch {
          reject(new Error('Invalid upload response'));
        }
      } else {
        let msg = `Upload failed: ${xhr.status} ${xhr.statusText}`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json?.message) msg = json.message;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}
