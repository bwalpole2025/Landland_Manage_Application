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
    sms: process.env.SMS_PROVIDER ?? "console",
    push: process.env.PUSH_PROVIDER ?? "console",
    payments: process.env.PAYMENT_PROVIDER ?? "mock",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "eu-west-2",
    bucket: process.env.S3_BUCKET ?? "landland-documents",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  // Supabase Storage for compliance evidence (StoragePort). When unset, an
  // in-memory adapter is used (dev/test; not durable across restarts).
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "evidence",
  },
  isProduction: process.env.NODE_ENV === "production",
} as const;
