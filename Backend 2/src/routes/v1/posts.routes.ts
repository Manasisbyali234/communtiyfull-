import { Router } from 'express';
import { z } from 'zod';
import { postsController } from '../../controllers/posts.controller';
import { auth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

const CreatePostSchema = z.object({
  content: z.string().max(5000).optional().default(''),
  mediaUrls: z.array(z.string().min(1)).max(10).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'AUDIO']).optional(),
  videoUrl: z.string().optional(),
  videoFileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  communityId: z.string().cuid().optional().nullable().transform(v => v || undefined),
  isDraft: z.boolean().optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  tags: z.array(z.string()).optional(),
}).refine(data => (data.content && data.content.trim().length > 0) || (data.mediaUrls && data.mediaUrls.length > 0) || !!data.videoUrl, {
  message: 'Post must have content, an image, or a video',
});

const UpdatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  isDraft: z.boolean().optional(),
});

const AddCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().cuid().optional(),
});

const UpdateCommentSchema = z.object({ content: z.string().min(1).max(2000) });

const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  parentId: z.string().cuid().nullable().optional(),
});

router.use(auth);

// ── Feed & Explore ────────────────────────────────────────────────────────────
router.get('/feed', validate({ query: CursorQuerySchema }), postsController.getFeed);
router.get('/trending', validate({ query: CursorQuerySchema }), postsController.getTrending);
router.get('/drafts', validate({ query: CursorQuerySchema }), postsController.getDrafts);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post('/', validate({ body: CreatePostSchema }), postsController.createPost);
router.get('/:id', postsController.getPost);
router.put('/:id', validate({ body: UpdatePostSchema }), postsController.updatePost);
router.delete('/:id', postsController.deletePost);
router.post('/:id/publish', postsController.publishDraft);

// ── Social ────────────────────────────────────────────────────────────────────
router.post('/:id/like', postsController.likePost);
router.delete('/:id/like', postsController.unlikePost);
router.post('/:id/bookmark', postsController.bookmarkPost);
router.delete('/:id/bookmark', postsController.unbookmarkPost);

// ── Comments ──────────────────────────────────────────────────────────────────
router.get('/:id/comments', validate({ query: CursorQuerySchema }), postsController.getComments);
router.post('/:id/comments', validate({ body: AddCommentSchema }), postsController.addComment);
router.put('/:id/comments/:cid', validate({ body: UpdateCommentSchema }), postsController.updateComment);
router.delete('/:id/comments/:cid', postsController.deleteComment);
router.post('/:id/comments/:cid/like', postsController.likeComment);

export default router;
