// In-memory StoragePort for tests and local dev. Holds blobs in a Map; signed
// URLs are deterministic, carry an expiry, and can be read back via `resolve()`
// so the full upload→download path is exercisable with no network.

import type { StorageBody, StoragePort } from "./port";

interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

function toBytes(body: StorageBody): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body); // ArrayBuffer
}

export class InMemoryStoragePort implements StoragePort {
  readonly name = "in-memory";
  private readonly objects = new Map<string, StoredObject>();

  /** A clock seam so tests can assert signed-URL expiry deterministically. */
  constructor(private readonly nowMs: () => number = () => 0) {}

  async put(key: string, body: StorageBody, contentType: string): Promise<void> {
    this.objects.set(key, { body: toBytes(body), contentType });
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(key)) {
      throw new Error(`No object at key: ${key}`);
    }
    const expiresAt = this.nowMs() + expiresInSeconds * 1000;
    // A fake but well-formed URL: scheme makes its in-memory origin obvious.
    return `memory://signed/${encodeURIComponent(key)}?expires=${expiresAt}`;
  }

  async remove(key: string): Promise<void> {
    this.objects.delete(key);
  }

  // --- Test helpers (not part of StoragePort) ---

  /** True if an object exists at `key`. */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /** Read an object back (the bytes + content type), or null. */
  get(key: string): { body: Uint8Array; contentType: string } | null {
    return this.objects.get(key) ?? null;
  }

  /** Resolve a signed URL produced by this adapter back to its stored bytes. */
  resolve(signedUrl: string): { body: Uint8Array; contentType: string; expired: boolean } | null {
    const match = /^memory:\/\/signed\/([^?]+)\?expires=(\d+)$/.exec(signedUrl);
    if (!match) return null;
    const key = decodeURIComponent(match[1] ?? "");
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.contentType, expired: this.nowMs() > Number(match[2]) };
  }

  /** All keys currently stored (for assertions). */
  keys(): string[] {
    return [...this.objects.keys()];
  }
}
