// StoragePort — the object-storage seam. Adapters implement put/signedUrl/
// remove; application code depends only on this interface.
//
// Keys are namespaced `${ownerId}/${propertyId}/${evidenceId}/${filename}` so
// that Storage row-level-security can isolate tenants purely by the LEADING path
// segment (the owner id). Never build keys by hand — use `storageKey()`.

export type StorageBody = Uint8Array | ArrayBuffer | string;

export interface StoragePort {
  /** Upload (or overwrite) an object at `key`. */
  put(key: string, body: StorageBody, contentType: string): Promise<void>;
  /** A time-limited download URL for `key`. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Delete the object at `key` (idempotent). */
  remove(key: string): Promise<void>;
}

export interface StorageKeyParts {
  ownerId: string;
  propertyId: string;
  evidenceId: string;
  filename: string;
}

/** Keep filenames safe and free of path separators / traversal. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename; // strip any path
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_") // only word chars, dot, hyphen
    .replace(/^\.+/, "") // no leading dots (hidden / traversal)
    .replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "file";
}

function assertSegment(name: string, value: string): void {
  if (!value || value.includes("/") || value.includes("..")) {
    throw new Error(`Invalid ${name} for storage key: ${JSON.stringify(value)}`);
  }
}

/**
 * Build the owner-namespaced storage key. The owner id is always the leading
 * segment, which is what Storage RLS policies match on.
 */
export function storageKey(parts: StorageKeyParts): string {
  assertSegment("ownerId", parts.ownerId);
  assertSegment("propertyId", parts.propertyId);
  assertSegment("evidenceId", parts.evidenceId);
  return `${parts.ownerId}/${parts.propertyId}/${parts.evidenceId}/${sanitizeFilename(parts.filename)}`;
}

/** The owner id a key belongs to — the leading path segment. */
export function ownerOf(key: string): string {
  return key.split("/")[0] ?? "";
}
