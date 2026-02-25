/**
 * S3/MinIO file upload service using presigned URLs
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT, // Set for MinIO: http://minio:9000
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  },
  forcePathStyle: !!process.env.S3_ENDPOINT, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || 'messenger-uploads';

export class S3Service {
  /**
   * Generate a presigned URL for direct client upload
   * Client uploads directly to S3/MinIO - no file passes through server
   */
  async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    userId: string
  ): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
    const ext = fileName.split('.').pop() || 'bin';
    const fileKey = `uploads/${userId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    const publicUrl = process.env.S3_ENDPOINT
      ? `${process.env.S3_ENDPOINT}/${BUCKET}/${fileKey}`
      : `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`;

    return { uploadUrl, fileKey, publicUrl };
  }

  /**
   * Generate a presigned URL for reading a private file
   */
  async getPresignedDownloadUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
  }
}
