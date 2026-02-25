/**
 * File upload routes - returns presigned S3/MinIO URLs
 */
import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { S3Service } from '../services/s3.service';

export const uploadRouter = Router();
const s3Service = new S3Service();

uploadRouter.use(authenticate);

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain',
  'application/zip',
];

// Get presigned upload URL
uploadRouter.post(
  '/presign',
  [
    body('fileName').isString().trim().isLength({ min: 1, max: 255 }),
    body('fileType').isIn(ALLOWED_TYPES).withMessage('File type not allowed'),
    validate,
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id: string };
      const { fileName, fileType } = req.body;
      const result = await s3Service.getPresignedUploadUrl(fileName, fileType, user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
