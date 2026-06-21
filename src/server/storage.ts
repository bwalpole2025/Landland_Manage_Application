// Selects the StoragePort implementation for compliance evidence: Supabase
// Storage when configured, otherwise an in-memory adapter (dev/test). A process
// singleton so in-memory uploads survive across requests within a run.

import "server-only";
import { env } from "@/server/env";
import { InMemoryStoragePort, SupabaseStoragePort, type StoragePort } from "@integrations";

let port: StoragePort | null = null;

export function getStoragePort(): StoragePort {
  if (port) return port;
  if (env.supabase.url && env.supabase.serviceKey) {
    port = new SupabaseStoragePort({
      url: env.supabase.url,
      serviceKey: env.supabase.serviceKey,
      bucket: env.supabase.bucket,
    });
  } else {
    port = new InMemoryStoragePort(() => Date.now());
  }
  return port;
}
