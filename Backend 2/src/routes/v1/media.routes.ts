import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { mediaController, uploadMiddleware, uploadMultipleMiddleware } from '../../controllers/media.controller';
import { auth } from '../../middleware/auth';
import { ApiError } from '../../utils/ApiError';

const router = Router();

// Public proxy route — no auth needed so images load in <Image> components
router.get('/proxy/:key(*)', mediaController.proxyFile);

router.use(auth);

// Converts MulterError → ApiError so errorHandler returns 4xx instead of 500
function multerErrorHandler(err: any, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return next(new ApiError(400, `Upload error: ${err.message}`));
  }
  next(err);
}

router.post('/upload-chat', uploadMiddleware, multerErrorHandler, mediaController.uploadChatFile);
router.post('/upload-event', uploadMiddleware, multerErrorHandler, mediaController.uploadEventImage);
router.post('/upload-profile-photo', uploadMiddleware, multerErrorHandler, mediaController.uploadProfilePhoto);
router.post('/upload-cover-photo', uploadMiddleware, multerErrorHandler, mediaController.uploadCoverPhoto);
router.post('/upload-post-image', uploadMiddleware, multerErrorHandler, mediaController.uploadPostImage);
router.post('/upload-post-video', uploadMiddleware, multerErrorHandler, mediaController.uploadPostVideo);
router.post('/upload', uploadMiddleware, multerErrorHandler, mediaController.upload);
router.post('/upload-multiple', uploadMultipleMiddleware, multerErrorHandler, mediaController.uploadMultiple);

router.get('/user/files', mediaController.getUserFiles);
router.get('/admin/stats', mediaController.getStorageStats);
router.get('/:id/metadata', mediaController.getFileMetadata);
router.get('/:id', mediaController.getFile);
router.delete('/:id', mediaController.deleteFile);

export default router;
