import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { mediaService } from '../services/media.service';
import { upload } from '../middleware/upload';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3, storageBucket } from '../config/storage';
import { Readable } from 'stream';

export const uploadMiddleware = upload.single('file');
export const uploadMultipleMiddleware = upload.array('files', 10);

export const mediaController = {
  uploadEventImage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadEventImage(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    res.json(new ApiResponse(200, result, 'Event image uploaded successfully'));
  }),

  uploadProfilePhoto: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadProfilePhoto(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    res.json(new ApiResponse(200, result, 'Profile photo uploaded successfully'));
  }),

  uploadCoverPhoto: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadCoverPhoto(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    res.json(new ApiResponse(200, result, 'Cover photo uploaded successfully'));
  }),

  uploadPostImage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadPostImage(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    res.json(new ApiResponse(200, result, 'Post image uploaded successfully'));
  }),

  uploadPostVideo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadPostVideo(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    res.json(new ApiResponse(200, result, 'Post video uploaded successfully'));
  }),

  uploadChatFile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file provided');
    const result = await mediaService.uploadChatFile(
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      req.user.id
    );
    console.log('[upload-chat] result:', JSON.stringify(result));
    res.json(new ApiResponse(200, result, 'Chat file uploaded successfully'));
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    console.log('[upload] request received', req.method, req.url);
    console.log('[upload] headers', JSON.stringify(req.headers));
    console.log('[upload] body', req.body);
    console.log('[upload] req.file', req.file
      ? { fieldname: req.file.fieldname, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size }
      : undefined);

    if (!req.file) {
      throw ApiError.badRequest('No file provided');
    }

    console.log('[upload] calling mediaService.uploadFile');
    let result;
    try {
      result = await mediaService.uploadFile(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        req.user.id
      );
    } catch (err: any) {
      console.error('[upload] mediaService.uploadFile threw:', err);
      console.error('[upload] stack:', err?.stack);
      throw err;
    }
    console.log('[upload] mediaService.uploadFile succeeded', result);

    res.json(new ApiResponse(200, result, 'File uploaded successfully'));
  }),

  uploadMultiple: asyncHandler(async (req: Request, res: Response) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw ApiError.badRequest('No files provided');
    }

    const files = req.files.map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    }));

    const results = await mediaService.uploadFiles(files, req.user.id);

    res.json(new ApiResponse(200, { files: results }, 'Files uploaded successfully'));
  }),

  getFile: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const file = await mediaService.getFile(id);
    if (!file) {
      throw ApiError.notFound('File not found');
    }

    res.redirect(file.url);
  }),

  // Proxy S3 object by key — avoids needing public bucket access
  proxyFile: asyncHandler(async (req: Request, res: Response) => {
    const key = decodeURIComponent(req.params['key']);
    try {
      const command = new GetObjectCommand({ Bucket: storageBucket, Key: key });
      const s3Res = await s3.send(command);
      if (s3Res.ContentType) res.setHeader('Content-Type', s3Res.ContentType);
      if (s3Res.ContentLength) res.setHeader('Content-Length', s3Res.ContentLength);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      (s3Res.Body as Readable).pipe(res);
    } catch {
      throw ApiError.notFound('File not found');
    }
  }),

  getFileMetadata: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const metadata = await mediaService.getFileMetadata(id);
    if (!metadata) {
      throw ApiError.notFound('File not found');
    }

    res.json(new ApiResponse(200, metadata));
  }),

  getUserFiles: asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20', mimeType } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const result = await mediaService.getUserFiles(req.user.id, {
      skip,
      take,
      mimeType: mimeType as string,
    });

    res.json(new ApiResponse(200, {
      files: result.files,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / take),
      },
    }));
  }),

  deleteFile: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await mediaService.deleteFile(id, req.user.id);

    res.json(new ApiResponse(200, null, 'File deleted successfully'));
  }),

  getStorageStats: asyncHandler(async (req: Request, res: Response) => {
    // Only allow admins to view storage stats
    if (req.user.role !== 'ADMIN') {
      throw ApiError.forbidden('Admin access required');
    }

    const stats = await mediaService.getStorageStats();
    res.json(new ApiResponse(200, stats));
  }),
};
