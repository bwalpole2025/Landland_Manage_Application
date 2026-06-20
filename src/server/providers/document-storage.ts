// DocumentStorage — abstraction over S3-compatible object storage for documents
// and receipts. MockDocumentStorage keeps blobs in memory for local dev/tests;
// S3DocumentStorage talks to any S3-compatible endpoint (AWS S3, MinIO, R2).

import { env } from "@/server/env";

export interface PutResult {
  key: string;
}

export interface DocumentStorage {
  readonly name: string;
  put(key: string, body: Uint8Array | string, contentType: string): Promise<PutResult>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export class MockDocumentStorage implements DocumentStorage {
  readonly name = "mock";
  private store = new Map<string, { body: Uint8Array | string; contentType: string }>();

  async put(key: string, body: Uint8Array | string, contentType: string): Promise<PutResult> {
    this.store.set(key, { body, contentType });
    return { key };
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/download/${encodeURIComponent(key)}?sig=mock`;
  }

  async getSignedUploadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/upload/${encodeURIComponent(key)}?sig=mock`;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** S3-compatible storage. SDK is imported lazily so mock dev never loads it. */
export class S3DocumentStorage implements DocumentStorage {
  readonly name = "s3";
  private bucket = env.s3.bucket;

  private async client() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      forcePathStyle: Boolean(env.s3.endpoint), // needed for MinIO/R2
      credentials:
        env.s3.accessKeyId && env.s3.secretAccessKey
          ? { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey }
          : undefined,
    });
  }

  async put(key: string, body: Uint8Array | string, contentType: string): Promise<PutResult> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return { key };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    return getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
