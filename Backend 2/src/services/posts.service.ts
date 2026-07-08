import { prisma } from '../config/database';
import { buildCursorArgs, buildCursorPage } from '../utils/pagination';
import { ApiError } from '../utils/ApiError';
import { blocksService } from './blocks.service';
import { getQueue, QUEUE_NAMES } from '../config/bullmq';
import { notificationsService } from './notifications.service';
export const POST_SELECT = {
  id: true, content: true, mediaUrls: true, mediaType: true,
  videoUrl: true, videoFileName: true, mimeType: true, fileSize: true,
  likesCount: true, commentsCount: true, sharesCount: true,
  isDraft: true, scheduledAt: true,
  createdAt: true, updatedAt: true,
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  community: { select: { id: true, name: true, slug: true, avatarUrl: true } },
  hashtags: { select: { hashtag: { select: { id: true, name: true } } } },
};

/** Extract hashtags from post content */
function extractHashtags(content: string): string[] {
  const matches = content.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

/** Upsert hashtags and link them to a post */
async function syncHashtags(postId: string, content: string) {
  const tags = extractHashtags(content);
  if (!tags.length) return;

  // Remove old hashtag links first
  const existing = await prisma.postHashtag.findMany({
    where: { postId },
    include: { hashtag: true },
  });
  const existingNames = existing.map((ph) => ph.hashtag.name);

  const toRemove = existing.filter((ph) => !tags.includes(ph.hashtag.name));
  const toAdd = tags.filter((t) => !existingNames.includes(t));

  // Decrement old hashtag counts
  if (toRemove.length > 0) {
    await prisma.$transaction([
      prisma.postHashtag.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } }),
      ...toRemove.map((r) =>
        prisma.hashtag.update({ where: { id: r.hashtagId }, data: { postsCount: { decrement: 1 } } }),
      ),
    ]);
  }

  // Upsert and link new hashtags
  for (const tag of toAdd) {
    const hashtag = await prisma.hashtag.upsert({
      where: { name: tag },
      create: { name: tag, postsCount: 1 },
      update: { postsCount: { increment: 1 } },
    });
    await prisma.postHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      create: { postId, hashtagId: hashtag.id },
      update: {},
    });
  }
}

export const postsService = {
  async getFeed(userId: string, cursor?: string, limit = 20) {
    const blockedIds = await blocksService.getBlockedIds(userId);
    const [follows, memberships] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
      prisma.communityMember.findMany({ where: { userId }, select: { communityId: true } }),
    ]);

    const followingIds = follows.map((f) => f.followingId).filter((id) => !blockedIds.includes(id));
    const communityIds = memberships.map((m) => m.communityId);

    const args = buildCursorArgs({ cursor, limit });
    const posts = await prisma.post.findMany({
      ...args,
      where: {
        deletedAt: null,
        isDraft: false,
        scheduledAt: null,
        OR: [
          { authorId: { in: followingIds } },
          { communityId: { in: communityIds } },
          { authorId: userId },
        ],
        authorId: { notIn: blockedIds },
      },
      select: POST_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return buildCursorPage(posts, limit);
  },

  async createPost(authorId: string, data: {
    content: string;
    mediaUrls?: string[];
    mediaType?: string;
    videoUrl?: string;
    videoFileName?: string;
    mimeType?: string;
    fileSize?: number;
    communityId?: string;
    isDraft?: boolean;
    scheduledAt?: Date | null;
    tags?: string[];
  }) {
    if (data.communityId) {
      const member = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: data.communityId, userId: authorId } },
      });
      if (!member) throw ApiError.forbidden('You must be a member of this community to post');
    }

    const { tags: _tags, mediaType, ...postData } = data;
    const post = await prisma.post.create({
      data: {
        authorId,
        ...postData,
        content: postData.content ?? '',
        ...(mediaType ? { mediaType: mediaType as any } : {}),
      },
      select: POST_SELECT,
    });

    // Sync hashtags (only if publishing now)
    if (!data.isDraft && !data.scheduledAt) {
      await syncHashtags(post.id, data.content);
    }

    // Schedule publication job
    if (data.scheduledAt && !data.isDraft) {
      const delay = data.scheduledAt.getTime() - Date.now();
      if (delay > 0) {
        const queue = getQueue(QUEUE_NAMES.SCHEDULED_POST);
        await queue.add('publish', { postId: post.id }, { delay, jobId: `post:${post.id}` });
      }
    }

    return post;
  },

  async getPost(postId: string, viewerId?: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: {
        ...POST_SELECT,
        ...(viewerId ? {
          likes: { where: { userId: viewerId }, select: { id: true } },
          bookmarks: { where: { userId: viewerId }, select: { id: true } },
        } : {}),
      },
    });
    if (!post) throw ApiError.notFound('Post not found');
    return post;
  },

  async updatePost(postId: string, userId: string, data: { content?: string; isDraft?: boolean }) {
    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw ApiError.notFound('Post not found');
    if (post.authorId !== userId) throw ApiError.forbidden('You can only edit your own posts');

    const updated = await prisma.post.update({
      where: { id: postId },
      data,
      select: POST_SELECT,
    });

    if (data.content) await syncHashtags(postId, data.content);

    return updated;
  },

  async deletePost(postId: string, userId: string, role: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw ApiError.notFound('Post not found');
    if (post.authorId !== userId && role !== 'ADMIN' && role !== 'MODERATOR') {
      throw ApiError.forbidden('Not authorized to delete this post');
    }
    // Soft delete
    await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  },

  async publishDraft(postId: string, userId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null, isDraft: true, authorId: userId } });
    if (!post) throw ApiError.notFound('Draft not found');

    const updated = await prisma.post.update({
      where: { id: postId },
      data: { isDraft: false, scheduledAt: null },
      select: POST_SELECT,
    });

    await syncHashtags(postId, post.content);
    return updated;
  },

  async getDrafts(userId: string, cursor?: string, limit = 20) {
    const args = buildCursorArgs({ cursor, limit });
    const posts = await prisma.post.findMany({
      ...args,
      where: { authorId: userId, isDraft: true, deletedAt: null },
      select: POST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return buildCursorPage(posts, limit);
  },

  async likePost(postId: string, userId: string) {
    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) return; // Already liked, idempotent

    await prisma.$transaction([
      prisma.like.create({ data: { userId, postId } }),
      prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
    ]);

    if (post.authorId !== userId) {
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      await notificationsService.create({
        recipientId: post.authorId,
        type: 'LIKE',
        actorId: userId,
        entityId: postId,
        entityType: 'Post',
        body: `${actor?.displayName ?? 'Someone'} liked your post.`,
      });
    }
  },

  async unlikePost(postId: string, userId: string) {
    const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } });
    if (!existing) return;

    await prisma.$transaction([
      prisma.like.delete({ where: { userId_postId: { userId, postId } } }),
      prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } }),
    ]);
  },

  async getTrendingPosts(userId: string, cursor?: string, limit = 20) {
    const blockedIds = await blocksService.getBlockedIds(userId);
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const args = buildCursorArgs({ cursor, limit });
    const posts = await prisma.post.findMany({
      ...args,
      where: {
        deletedAt: null,
        isDraft: false,
        scheduledAt: null,
        createdAt: { gte: since },
        authorId: { notIn: blockedIds },
      },
      select: POST_SELECT,
      orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }, { createdAt: 'desc' }],
    });

    return buildCursorPage(posts, limit);
  },
};
