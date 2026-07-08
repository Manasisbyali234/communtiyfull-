import { Request, Response } from 'express';
import { communitiesService } from '../services/communities.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { CommunityMemberRole } from '@prisma/client';

export const communitiesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await communitiesService.list({ ...(req.query as any), userId: req.user.id });
    res.json(new ApiResponse(200, result));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const community = await communitiesService.create(req.user.id, req.body as { name: string; description?: string; category: string; isPrivate?: boolean; avatarUrl?: string; bannerUrl?: string; feedPostPrompts?: string[] });
    res.status(201).json(new ApiResponse(201, community, 'Community created'));
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const community = await communitiesService.getById(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, community));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const community = await communitiesService.update(req.params['id'], req.user.id, req.body as Partial<{ name: string; description: string; avatarUrl: string; bannerUrl: string; category: string; isPrivate: boolean }>);
    res.json(new ApiResponse(200, community, 'Community updated'));
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.delete(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, null, 'Community deleted'));
  }),

  join: asyncHandler(async (req: Request, res: Response) => {
    const result = await communitiesService.join(req.params['id'], req.user.id);
    const msg = result.status === 'PENDING' ? 'Join request sent' : 'Joined successfully';
    res.json(new ApiResponse(200, result, msg));
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.leave(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, null, 'Left community'));
  }),

  getMembers: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await communitiesService.getMembers(req.params['id'], cursor, limit ? parseInt(limit) : 20);
    res.json(new ApiResponse(200, result));
  }),

  getPendingMembers: asyncHandler(async (req: Request, res: Response) => {
    const result = await communitiesService.getPendingMembers(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, result));
  }),

  updateMemberRole: asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.body as { role: CommunityMemberRole };
    const result = await communitiesService.updateMemberRole(req.params['id'], req.user.id, req.params['uid'], role);
    res.json(new ApiResponse(200, result, 'Role updated'));
  }),

  removeMember: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.removeMember(req.params['id'], req.user.id, req.params['uid']);
    res.json(new ApiResponse(200, null, 'Member removed'));
  }),

  approveMember: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.approveMember(req.params['id'], req.user.id, req.params['uid']);
    res.json(new ApiResponse(200, null, 'Member approved'));
  }),

  rejectMember: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.rejectMember(req.params['id'], req.user.id, req.params['uid']);
    res.json(new ApiResponse(200, null, 'Member rejected'));
  }),

  inviteMember: asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.body as { userId: string };
    await communitiesService.inviteMember(req.params['id'], req.user.id, userId);
    res.json(new ApiResponse(200, null, 'Invite sent'));
  }),

  acceptInvite: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.acceptInvite(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, null, 'Invite accepted'));
  }),

  declineInvite: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.declineInvite(req.params['id'], req.user.id);
    res.json(new ApiResponse(200, null, 'Invite declined'));
  }),

  getMyInvites: asyncHandler(async (req: Request, res: Response) => {
    const invites = await communitiesService.getMyInvites(req.user.id);
    res.json(new ApiResponse(200, invites));
  }),

  getRules: asyncHandler(async (req: Request, res: Response) => {
    const rules = await communitiesService.getRules(req.params['id']);
    res.json(new ApiResponse(200, rules));
  }),

  addRule: asyncHandler(async (req: Request, res: Response) => {
    const rule = await communitiesService.addRule(req.params['id'], req.user.id, req.body as { title: string; description?: string });
    res.status(201).json(new ApiResponse(201, rule, 'Rule added'));
  }),

  updateRule: asyncHandler(async (req: Request, res: Response) => {
    const rule = await communitiesService.updateRule(req.params['id'], req.params['rid'], req.user.id, req.body as { title?: string; description?: string; order?: number });
    res.json(new ApiResponse(200, rule, 'Rule updated'));
  }),

  deleteRule: asyncHandler(async (req: Request, res: Response) => {
    await communitiesService.deleteRule(req.params['id'], req.params['rid'], req.user.id);
    res.json(new ApiResponse(200, null, 'Rule deleted'));
  }),

  getPosts: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await communitiesService.getCommunityPosts(req.params['id'], cursor, limit ? parseInt(limit) : 20);
    res.json(new ApiResponse(200, result));
  }),
};
