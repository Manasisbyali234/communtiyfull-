import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { blocksService } from './blocks.service';

const CACHE_TTL = 600; // 10 minutes

async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;
  const result = await fn();
  await redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL);
  return result;
}

export const exploreService = {
  async getTrendingPosts(userId: string, limit = 20) {
    const blockedIds = await blocksService.getBlockedIds(userId);
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    return withCache(`explore:trending_posts:${limit}`, () =>
      prisma.post.findMany({
        where: {
          deletedAt: null,
          isDraft: false,
          scheduledAt: null,
          createdAt: { gte: since },
          authorId: { notIn: blockedIds },
        },
        select: {
          id: true, content: true, mediaUrls: true, mediaType: true,
          likesCount: true, commentsCount: true, createdAt: true,
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          community: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ likesCount: 'desc' }, { commentsCount: 'desc' }],
        take: limit,
      }),
    );
  },

  async getTrendingCommunities(limit = 10) {
    return withCache(`explore:trending_communities:${limit}`, () =>
      prisma.community.findMany({
        where: { isPrivate: false },
        orderBy: { memberCount: 'desc' },
        take: limit,
        select: { id: true, name: true, slug: true, avatarUrl: true, memberCount: true, category: true, description: true },
      }),
    );
  },

  async getSuggestedUsers(userId: string, limit = 20) {
    return withCache(`explore:suggested_users:${userId}:${limit}`, async () => {
      // Users followed by people you follow (2nd degree connections)
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);

      const select = {
        id: true, username: true, displayName: true, avatarUrl: true,
        isVerified: true, bio: true, role: true,
        _count: { select: { followers: true } },
      };

      if (!followingIds.length) {
        // Fallback: most followed users excluding self
        return prisma.user.findMany({
          where: { id: { not: userId }, deletedAt: null },
          orderBy: { followers: { _count: 'desc' } },
          take: limit,
          select,
        });
      }

      const secondDegree = await prisma.follow.findMany({
        where: {
          followerId: { in: followingIds },
          followingId: { notIn: [...followingIds, userId] },
        },
        select: { followingId: true },
      });

      const candidateIds = [...new Set(secondDegree.map((f) => f.followingId))].slice(0, limit * 2);

      if (!candidateIds.length) {
        // Fallback if no 2nd-degree connections found
        return prisma.user.findMany({
          where: { id: { notIn: [...followingIds, userId] }, deletedAt: null },
          orderBy: { followers: { _count: 'desc' } },
          take: limit,
          select,
        });
      }

      return prisma.user.findMany({
        where: { id: { in: candidateIds }, deletedAt: null },
        take: limit,
        select,
      });
    });
  },

  async getSuggestedCommunities(userId: string, limit = 10) {
    // Communities in categories the user already engages with
    const memberships = await prisma.communityMember.findMany({
      where: { userId },
      include: { community: { select: { category: true } } },
    });

    const categories = [...new Set(memberships.map((m) => m.community.category))];
    const joinedIds = memberships.map((m) => m.communityId);

    if (!categories.length) {
      return prisma.community.findMany({
        where: { isPrivate: false, id: { notIn: joinedIds } },
        orderBy: { memberCount: 'desc' },
        take: limit,
        select: { id: true, name: true, slug: true, avatarUrl: true, memberCount: true, category: true, description: true },
      });
    }

    return prisma.community.findMany({
      where: {
        isPrivate: false,
        id: { notIn: joinedIds },
        category: { in: categories },
      },
      orderBy: { memberCount: 'desc' },
      take: limit,
      select: { id: true, name: true, slug: true, avatarUrl: true, memberCount: true, category: true, description: true },
    });
  },

  async getTrendingHashtags(limit = 20) {
    return withCache(`explore:trending_hashtags:${limit}`, () =>
      prisma.hashtag.findMany({
        orderBy: { postsCount: 'desc' },
        take: limit,
        select: { id: true, name: true, postsCount: true },
      }),
    );
  },

  async getPostsByHashtag(hashtagName: string, userId: string, cursor?: string, limit = 20) {
    const blockedIds = await blocksService.getBlockedIds(userId);
    const tag = hashtagName.replace(/^#/, '').toLowerCase();

    const hashtag = await prisma.hashtag.findUnique({ where: { name: tag } });
    if (!hashtag) return { items: [], nextCursor: null, hasMore: false };

    const posts = await prisma.postHashtag.findMany({
      where: { hashtagId: hashtag.id },
      include: {
        post: {
          include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          where: { deletedAt: null, isDraft: false, authorId: { notIn: blockedIds } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit).map((ph) => ph.post).filter(Boolean);
    const nextCursor = hasMore ? posts[limit - 1]?.id : null;

    return { items, nextCursor, hasMore };
  },
};
