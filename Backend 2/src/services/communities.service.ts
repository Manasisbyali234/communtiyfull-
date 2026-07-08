import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { slugify, slugifyWithSuffix } from '../utils/slugify';
import { buildCursorArgs, buildCursorPage } from '../utils/pagination';
import { CommunityMemberRole, CommunityMemberStatus } from '@prisma/client';
import { POST_SELECT } from './posts.service';
import { notificationsService } from './notifications.service';

export const communitiesService = {
  async list(params: { cursor?: string; limit?: number; category?: string; search?: string; sort?: 'popular' | 'newest'; userId?: string }) {
    const { cursor, limit = 20, category, search, sort = 'newest', userId } = params;
    const args = buildCursorArgs({ cursor, limit });

    const communities = await prisma.community.findMany({
      ...args,
      where: {
        ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      orderBy: sort === 'popular' ? { memberCount: 'desc' } : { createdAt: 'desc' },
      include: userId ? { members: { where: { userId, status: CommunityMemberStatus.ACTIVE }, select: { userId: true } } } : undefined,
    });

    const page = buildCursorPage(communities as any[], limit);
    return {
      ...page,
      data: page.data.map((c: any) => {
        const { members, ...rest } = c;
        return { ...rest, isJoined: userId ? (members?.length ?? 0) > 0 : false };
      }),
    };
  },

  async create(creatorId: string, data: { name: string; description?: string; category: string; isPrivate?: boolean; avatarUrl?: string; bannerUrl?: string; feedPostPrompts?: string[] }) {
    let slug = slugify(data.name);
    const existing = await prisma.community.findUnique({ where: { slug } });
    if (existing) slug = slugifyWithSuffix(data.name, Date.now().toString(36));

    return prisma.community.create({
      data: {
        ...data,
        slug,
        memberCount: 1,
        members: { create: { userId: creatorId, role: CommunityMemberRole.ADMIN, status: CommunityMemberStatus.ACTIVE } },
      },
    });
  },

  async getById(id: string, userId: string) {
    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) throw ApiError.notFound('Community not found');

    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId } },
    });

    const rules = await prisma.communityRule.findMany({
      where: { communityId: id },
      orderBy: { order: 'asc' },
    });

    return { ...community, isJoined: !!membership && membership.status === CommunityMemberStatus.ACTIVE, memberRole: membership?.role ?? null, memberStatus: membership?.status ?? null, rules, feedPostPrompts: community.feedPostPrompts ?? [] };
  },

  async update(communityId: string, userId: string, data: Partial<{ name: string; description: string; avatarUrl: string; bannerUrl: string; category: string; isPrivate: boolean }>) {
    await this.requireRole(communityId, userId, [CommunityMemberRole.ADMIN]);
    return prisma.community.update({ where: { id: communityId }, data });
  },

  async delete(communityId: string, userId: string) {
    await this.requireRole(communityId, userId, [CommunityMemberRole.ADMIN]);
    await prisma.community.delete({ where: { id: communityId } });
  },

  async join(communityId: string, userId: string) {
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw ApiError.notFound('Community not found');

    const existingMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (existingMember) {
      if (existingMember.status === CommunityMemberStatus.ACTIVE) throw ApiError.conflict('Already a member');
      if (existingMember.status === CommunityMemberStatus.PENDING) throw ApiError.conflict('Join request already pending');
    }

    const status = community.isPrivate ? CommunityMemberStatus.PENDING : CommunityMemberStatus.ACTIVE;

    await prisma.communityMember.create({ data: { communityId, userId, status } });

    if (!community.isPrivate) {
      await prisma.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });

      // Notify community admins
      const admins = await prisma.communityMember.findMany({
        where: { communityId, role: CommunityMemberRole.ADMIN, status: CommunityMemberStatus.ACTIVE },
        select: { userId: true },
      });
      const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      for (const admin of admins) {
        if (admin.userId !== userId) {
          await notificationsService.create({
            recipientId: admin.userId,
            type: 'COMMUNITY_JOIN',
            actorId: userId,
            entityId: communityId,
            entityType: 'Community',
            body: `${joiner?.displayName ?? 'Someone'} joined ${community.name}.`,
          });
        }
      }
    }

    return { status };
  },

  async leave(communityId: string, userId: string) {
    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) return;

    await prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
    if (member.status === CommunityMemberStatus.ACTIVE) {
      await prisma.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
    }
  },

  async getPendingMembers(communityId: string, requesterId: string) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    const members = await prisma.communityMember.findMany({
      where: { communityId, status: CommunityMemberStatus.PENDING },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => ({ ...m.user, joinedAt: m.joinedAt }));
  },

  async approveMember(communityId: string, requesterId: string, targetUserId: string) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: targetUserId } } });
    if (!member || member.status !== CommunityMemberStatus.PENDING) throw ApiError.notFound('Pending member not found');

    await prisma.$transaction([
      prisma.communityMember.update({
        where: { communityId_userId: { communityId, userId: targetUserId } },
        data: { status: CommunityMemberStatus.ACTIVE },
      }),
      prisma.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } }),
    ]);
  },

  async rejectMember(communityId: string, requesterId: string, targetUserId: string) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    await prisma.communityMember.updateMany({
      where: { communityId, userId: targetUserId, status: CommunityMemberStatus.PENDING },
      data: { status: CommunityMemberStatus.REJECTED },
    });
  },

  async getMembers(communityId: string, cursor?: string, limit = 20) {
    const args = buildCursorArgs({ cursor, limit });
    const members = await prisma.communityMember.findMany({
      ...args,
      where: { communityId, status: CommunityMemberStatus.ACTIVE },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    const items = members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt }));
    return buildCursorPage(items, limit);
  },

  async updateMemberRole(communityId: string, requesterId: string, targetUserId: string, role: CommunityMemberRole) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN]);
    return prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { role },
    });
  },

  async removeMember(communityId: string, requesterId: string, targetUserId: string) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: targetUserId } } });
    if (!member) throw ApiError.notFound('Member not found');

    await prisma.$transaction([
      prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId: targetUserId } } }),
      ...(member.status === CommunityMemberStatus.ACTIVE
        ? [prisma.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } })]
        : []),
    ]);
  },

  async getCommunityPosts(communityId: string, cursor?: string, limit = 20) {
    const args = buildCursorArgs({ cursor, limit });
    const posts = await prisma.post.findMany({
      ...args,
      where: { communityId, deletedAt: null, isDraft: false },
      select: POST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return buildCursorPage(posts, limit);
  },

  // ── Community Rules ──────────────────────────────────────────────────────────
  async getRules(communityId: string) {
    return prisma.communityRule.findMany({ where: { communityId }, orderBy: { order: 'asc' } });
  },

  async addRule(communityId: string, requesterId: string, data: { title: string; description?: string }) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    const count = await prisma.communityRule.count({ where: { communityId } });
    return prisma.communityRule.create({ data: { communityId, ...data, order: count } });
  },

  async updateRule(communityId: string, ruleId: string, requesterId: string, data: { title?: string; description?: string; order?: number }) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);
    const rule = await prisma.communityRule.findFirst({ where: { id: ruleId, communityId } });
    if (!rule) throw ApiError.notFound('Rule not found');
    return prisma.communityRule.update({ where: { id: ruleId }, data });
  },

  async deleteRule(communityId: string, ruleId: string, requesterId: string) {
    await this.requireRole(communityId, requesterId, [CommunityMemberRole.ADMIN]);
    const rule = await prisma.communityRule.findFirst({ where: { id: ruleId, communityId } });
    if (!rule) throw ApiError.notFound('Rule not found');
    await prisma.communityRule.delete({ where: { id: ruleId } });
  },

  // ── Community Invites ────────────────────────────────────────────────────────
  async inviteMember(communityId: string, senderId: string, recipientId: string) {
    await this.requireRole(communityId, senderId, [CommunityMemberRole.ADMIN, CommunityMemberRole.MODERATOR]);

    const target = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!target) throw ApiError.notFound('User not found');

    const alreadyMember = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId: recipientId } } });
    if (alreadyMember && alreadyMember.status === CommunityMemberStatus.ACTIVE) throw ApiError.conflict('User is already a member');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.communityInvite.upsert({
      where: { communityId_recipientId: { communityId, recipientId } },
      create: { communityId, senderId, recipientId, expiresAt },
      update: { senderId, expiresAt, status: 'PENDING' },
    });

    const [community, sender] = await Promise.all([
      prisma.community.findUnique({ where: { id: communityId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: senderId }, select: { displayName: true } }),
    ]);
    await notificationsService.create({
      recipientId,
      type: 'COMMUNITY_INVITE',
      actorId: senderId,
      entityId: communityId,
      entityType: 'Community',
      body: `${sender?.displayName ?? 'Someone'} invited you to join ${community?.name ?? 'a community'}.`,
    });
  },

  async acceptInvite(communityId: string, userId: string) {
    const invite = await prisma.communityInvite.findUnique({
      where: { communityId_recipientId: { communityId, recipientId: userId } },
    });
    if (!invite || invite.status !== 'PENDING') throw ApiError.notFound('Invite not found');
    if (invite.expiresAt < new Date()) throw ApiError.badRequest('Invite has expired');

    await prisma.$transaction([
      prisma.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        create: { communityId, userId, status: CommunityMemberStatus.ACTIVE },
        update: { status: CommunityMemberStatus.ACTIVE },
      }),
      prisma.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } }),
      prisma.communityInvite.update({ where: { communityId_recipientId: { communityId, recipientId: userId } }, data: { status: 'ACCEPTED' } }),
    ]);
  },

  async declineInvite(communityId: string, userId: string) {
    await prisma.communityInvite.updateMany({
      where: { communityId, recipientId: userId, status: 'PENDING' },
      data: { status: 'DECLINED' },
    });
  },

  async getMyInvites(userId: string) {
    return prisma.communityInvite.findMany({
      where: { recipientId: userId, status: 'PENDING', expiresAt: { gt: new Date() } },
      include: {
        community: { select: { id: true, name: true, slug: true, avatarUrl: true } },
        sender: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async requireRole(communityId: string, userId: string, roles: CommunityMemberRole[]) {
    const member = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
    if (!member || member.status !== CommunityMemberStatus.ACTIVE || !roles.includes(member.role)) {
      throw ApiError.forbidden('Insufficient community role');
    }
  },
};
