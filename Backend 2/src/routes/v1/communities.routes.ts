import { Router } from 'express';
import { z } from 'zod';
import { communitiesController } from '../../controllers/communities.controller';
import { auth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

const CreateCommunitySchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  category: z.string().min(1),
  isPrivate: z.boolean().default(false),
  avatarUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  feedPostPrompts: z.array(z.string().max(200)).optional(),
});

const UpdateCommunitySchema = CreateCommunitySchema.partial();

const UpdateRoleSchema = z.object({
  role: z.enum(['MEMBER', 'MODERATOR', 'ADMIN']),
});

const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['popular', 'newest']).optional(),
});

const RuleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  order: z.number().optional(),
});

const InviteSchema = z.object({ userId: z.string().cuid() });

router.use(auth);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/', validate({ query: CursorQuerySchema }), communitiesController.list);
router.post('/', validate({ body: CreateCommunitySchema }), communitiesController.create);
router.get('/invites', communitiesController.getMyInvites);
router.get('/:id', communitiesController.get);
router.put('/:id', validate({ body: UpdateCommunitySchema }), communitiesController.update);
router.delete('/:id', communitiesController.delete);

// ── Membership ────────────────────────────────────────────────────────────────
router.post('/:id/join', communitiesController.join);
router.delete('/:id/join', communitiesController.leave);
router.get('/:id/members', validate({ query: CursorQuerySchema }), communitiesController.getMembers);
router.get('/:id/pending', communitiesController.getPendingMembers);
router.put('/:id/members/:uid/role', validate({ body: UpdateRoleSchema }), communitiesController.updateMemberRole);
router.delete('/:id/members/:uid', communitiesController.removeMember);
router.post('/:id/members/:uid/approve', communitiesController.approveMember);
router.post('/:id/members/:uid/reject', communitiesController.rejectMember);

// ── Invites ───────────────────────────────────────────────────────────────────
router.post('/:id/invites', validate({ body: InviteSchema }), communitiesController.inviteMember);
router.post('/:id/invites/accept', communitiesController.acceptInvite);
router.post('/:id/invites/decline', communitiesController.declineInvite);

// ── Rules ─────────────────────────────────────────────────────────────────────
router.get('/:id/rules', communitiesController.getRules);
router.post('/:id/rules', validate({ body: RuleSchema }), communitiesController.addRule);
router.put('/:id/rules/:rid', validate({ body: RuleSchema.partial() }), communitiesController.updateRule);
router.delete('/:id/rules/:rid', communitiesController.deleteRule);

// ── Posts ─────────────────────────────────────────────────────────────────────
router.get('/:id/posts', validate({ query: CursorQuerySchema }), communitiesController.getPosts);

export default router;
