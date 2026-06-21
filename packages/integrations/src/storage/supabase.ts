// Supabase Storage adapter, implemented against the Storage REST API so the
// package carries no SDK dependency. `fetch` is injectable for testing the
// request shapes without network access.
//
// Storage RLS (see Section 7): policies match the LEADING path segment of the
// object name (the owner id), so a tenant can only read/write under their own
// prefix. Keys must be built with `storageKey()`.

import type { StorageBody, StoragePort } from "./port";

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: StorageBody }) => Promise<FetchResponseLike>;

export interface SupabaseStorageOptions {
  /** Project URL, e.g. https://abc.supabase.co */
  url: string;
  /** Service-role key (server-side only — never ship to the client). */
  serviceKey: string;
  bucket: string;
  /** Override fetch (defaults to global fetch). */
  fetch?: FetchLike;
}

/** Encode each path segment but keep the slashes between them. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export class SupabaseStoragePort implements StoragePort {
  readonly name = "supabase";
  private readonly apiBase: string;
  private readonly serviceKey: string;
  private readonly bucket: string;
  private readonly doFetch: FetchLike;

  constructor(options: SupabaseStorageOptions) {
    if (!options.url || !options.serviceKey || !options.bucket) {
      throw new Error("SupabaseStoragePort requires url, serviceKey and bucket.");
    }
    this.apiBase = `${options.url.replace(/\/$/, "")}/storage/v1`;
    this.serviceKey = options.serviceKey;
    this.bucket = options.bucket;
    const fallback = (globalThis as { fetch?: FetchLike }).fetch;
    const chosen = options.fetch ?? fallback;
    if (!chosen) throw new Error("No fetch implementation available for SupabaseStoragePort.");
    this.doFetch = chosen;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async put(key: string, body: StorageBody, contentType: string): Promise<void> {
    const res = await this.doFetch(`${this.apiBase}/object/${this.bucket}/${encodeKey(key)}`, {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": contentType, "x-upsert": "true" }),
      body,
    });
    if (!res.ok) throw new Error(`Supabase put failed (${res.status}): ${await res.text()}`);
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const res = await this.doFetch(`${this.apiBase}/object/sign/${this.bucket}/${encodeKey(key)}`, {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!res.ok) throw new Error(`Supabase signedUrl failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const path = json.signedURL ?? json.signedUrl;
    if (!path) throw new Error("Supabase signedUrl response missing signedURL.");
    return path.startsWith("http") ? path : `${this.apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  async remove(key: string): Promise<void> {
    const res = await this.doFetch(`${this.apiBase}/object/${this.bucket}/${encodeKey(key)}`, {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    // Treat "not found" as success — remove is idempotent.
    if (!res.ok && res.status !== 404) throw new Error(`Supabase remove failed (${res.status}): ${await res.text()}`);
  }
}
