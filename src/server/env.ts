// Centralised, lightly-validated access to environment configuration.
// Kept dependency-free so it can be imported from any runtime (Next, worker, tests).

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "landland_session",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  redisUrl: process.env.REDIS_URL, // optional — jobs disabled when absent
  providers: {
    bankFeed: process.env.BANK_FEED_PROVIDER ?? "mock",
    hmrcMtd: process.env.HMRC_MTD_PROVIDER ?? "mock",
    documentStorage: process.env.DOCUMENT_STORAGE_PROVIDER ?? "mock",
    mailer: process.env.MAILER_PROVIDER ?? "console",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "eu-west-2",
    bucket: process.env.S3_BUCKET ?? "landland-documents",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  isProduction: process.env.NODE_ENV === "production",
} as const;
