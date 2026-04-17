import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type UploadRequest = {
  contentType: string;
  objectKey: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __biogtS3Client: S3Client | undefined;
}

const getStorageConfig = () => {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage is not fully configured.");
  }

  return {
    accessKeyId,
    bucket,
    endpoint,
    forcePathStyle,
    region,
    secretAccessKey
  };
};

export const getStorageBucket = () => getStorageConfig().bucket;

export const getStorageClient = () => {
  if (!globalThis.__biogtS3Client) {
    const config = getStorageConfig();
    globalThis.__biogtS3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  return globalThis.__biogtS3Client;
};

export const createObjectKey = ({
  fileName,
  submissionId
}: {
  fileName: string;
  submissionId: string;
}) => {
  const safeFileName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const nonce = crypto.randomUUID();
  return `submissions/${submissionId}/${nonce}-${safeFileName}`;
};

export const createUploadUrl = async ({ contentType, objectKey }: UploadRequest) =>
  getSignedUrl(
    getStorageClient(),
    new PutObjectCommand({
      Bucket: getStorageBucket(),
      Key: objectKey,
      ContentType: contentType
    }),
    {
      expiresIn: 60 * 10
    }
  );

export const createDownloadUrl = async (objectKey: string) =>
  getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({
      Bucket: getStorageBucket(),
      Key: objectKey
    }),
    {
      expiresIn: 60 * 10
    }
  );
