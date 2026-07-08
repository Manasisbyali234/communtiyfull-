import { Request, Response } from 'express';
import { postsService } from '../services/posts.service';
import { commentsService } from '../services/comments.service';
import { bookmarksService } from '../services/bookmarks.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const postsController = {
  getFeed: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await postsService.getFeed(req.user.id, cursor, limit ? parseInt(limit) : 20);
    res.json(new ApiResponse(200, result));
  }),

  getTrending: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await postsService.getTrendingPosts(req.user.id, cursor, limit ? parseInt(limit) : 20);
    res.json(new ApiResponse(200, result));
  }),

  getDrafts: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const result = await postsService.getDrafts(req.user.id, cursor, limit ? parseInt(limit) : 20);
    res.json(new ApiResponse(200, result));
  }),

  createPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await postsService.createPost(req.user.id, req.body as {
      content: string; mediaUrls?: string[]; mediaType?: string;
      videoUrl?: string; videoFileName?: string; mimeType?: string; fileSize?: number;
      communityId?: string; isDraft?: boolean; scheduledAt?: Date | null; tags?: string[];
    });
    res.status(201).json(new ApiResponse(201, post, 'Post created'));
  }),

  getPost: asyncHandler(async (req: Request, res: Response) => {
    const post = await postsService.getPost(req.params['id'] as string, req.user.id);
    res.json(new ApiResponse(200, post));
  }),

  updatePost: asyncHandler(async (req: Request, res: Response) => {
    const post = await postsService.updatePost(req.params['id'] as string, req.user.id, req.body as { content?: string; isDraft?: boolean });
    res.json(new ApiResponse(200, post, 'Post updated'));
  }),

  deletePost: asyncHandler(async (req: Request, res: Response) => {
    await postsService.deletePost(req.params['id'] as string, req.user.id, req.user.role);
    res.json(new ApiResponse(200, null, 'Post deleted'));
  }),

  publishDraft: asyncHandler(async (req: Request, res: Response) => {
    const post = await postsService.publishDraft(req.params['id'] as string, req.user.id);
    res.json(new ApiResponse(200, post, 'Draft published'));
  }),

  likePost: asyncHandler(async (req: Request, res: Response) => {
    await postsService.likePost(req.params['id'] as string, req.user.id);
    res.json(new ApiResponse(200, null, 'Post liked'));
  }),

  unlikePost: asyncHandler(async (req: Request, res: Response) => {
    await postsService.unlikePost(req.params['id'] as string, req.user.id);
    res.json(new ApiResponse(200, null, 'Post unliked'));
  }),

  bookmarkPost: asyncHandler(async (req: Request, res: Response) => {
    await bookmarksService.addBookmark(req.user.id, req.params['id'] as string);
    res.json(new ApiResponse(200, null, 'Post bookmarked'));
  }),

  unbookmarkPost: asyncHandler(async (req: Request, res: Response) => {
    await bookmarksService.removeBookmark(req.user.id, req.params['id'] as string);
    res.json(new ApiResponse(200, null, 'Bookmark removed'));
  }),

  getComments: asyncHandler(async (req: Request, res: Response) => {
    const { cursor, limit, parentId } = req.query as { cursor?: string; limit?: string; parentId?: string };
    const result = await commentsService.getComments(
      req.params['id'] as string,
      parentId ?? null,
      cursor,
      limit ? parseInt(limit) : 20,
    );
    res.json(new ApiResponse(200, result));
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const { content, parentId } = req.body as { content: string; parentId?: string };
    const comment = await commentsService.addComment(req.params['id'] as string, req.user.id, content, parentId);
    res.status(201).json(new ApiResponse(201, comment, 'Comment added'));
  }),

  updateComment: asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body as { content: string };
    const comment = await commentsService.updateComment(req.params['cid'] as string, req.user.id, content);
    res.json(new ApiResponse(200, comment, 'Comment updated'));
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    await commentsService.deleteComment(req.params['cid'] as string, req.params['id'] as string, req.user.id, req.user.role);
    res.json(new ApiResponse(200, null, 'Comment deleted'));
  }),

  likeComment: asyncHandler(async (req: Request, res: Response) => {
    await commentsService.likeComment(req.params['cid'] as string, req.user.id);
    res.json(new ApiResponse(200, null, 'Comment liked'));
  }),
};
