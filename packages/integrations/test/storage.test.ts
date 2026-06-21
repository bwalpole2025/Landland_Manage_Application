import { describe, it, expect } from "vitest";
import { InMemoryStoragePort, SupabaseStoragePort, ownerOf, sanitizeFilename, storageKey } from "../src/index";

describe("storageKey — owner-namespaced for RLS isolation", () => {
  it("puts the owner id first so RLS can match the leading segment", () => {
    const key = storageKey({ ownerId: "acc_1", propertyId: "p_oak", evidenceId: "ev_9", filename: "CP12.pdf" });
    expect(key).toBe("acc_1/p_oak/ev_9/CP12.pdf");
    expect(ownerOf(key)).toBe("acc_1");
  });

  it("sanitizes filenames (no path separators, spaces or traversal)", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("My Gas Cert (2025).pdf")).toBe("My_Gas_Cert_2025_.pdf");
    expect(sanitizeFilename("..hidden")).toBe("hidden");
    expect(storageKey({ ownerId: "o", propertyId: "p", evidenceId: "e", filename: "a/b/c.pdf" })).toBe("o/p/e/c.pdf");
  });

  it("rejects path segments that would break isolation", () => {
    expect(() => storageKey({ ownerId: "a/b", propertyId: "p", evidenceId: "e", filename: "f" })).toThrow();
    expect(() => storageKey({ ownerId: "..", propertyId: "p", evidenceId: "e", filename: "f" })).toThrow();
    expect(() => storageKey({ ownerId: "", propertyId: "p", evidenceId: "e", filename: "f" })).toThrow();
  });
});

describe("InMemoryStoragePort — full upload path, no network", () => {
  it("put → signedUrl → resolve round-trips the bytes", async () => {
    const storage = new InMemoryStoragePort();
    const key = storageKey({ ownerId: "acc_1", propertyId: "p_oak", evidenceId: "ev_1", filename: "cert.pdf" });

    await storage.put(key, "PDF-BYTES", "application/pdf");
    expect(storage.has(key)).toBe(true);

    const url = await storage.signedUrl(key, 3600);
    expect(url).toContain("memory://signed/");

    const resolved = storage.resolve(url);
    expect(resolved).not.toBeNull();
    expect(new TextDecoder().decode(resolved!.body)).toBe("PDF-BYTES");
    expect(resolved!.contentType).toBe("application/pdf");
    expect(resolved!.expired).toBe(false);
  });

  it("accepts Uint8Array bodies", async () => {
    const storage = new InMemoryStoragePort();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await storage.put("acc/p/e/blob.bin", bytes, "application/octet-stream");
    expect(storage.get("acc/p/e/blob.bin")!.body).toEqual(bytes);
  });

  it("signedUrl on a missing key throws", async () => {
    const storage = new InMemoryStoragePort();
    await expect(storage.signedUrl("acc/p/e/none.pdf", 60)).rejects.toThrow();
  });

  it("remove deletes the object (and is idempotent)", async () => {
    const storage = new InMemoryStoragePort();
    await storage.put("acc/p/e/f.pdf", "x", "text/plain");
    await storage.remove("acc/p/e/f.pdf");
    expect(storage.has("acc/p/e/f.pdf")).toBe(false);
    await expect(storage.remove("acc/p/e/f.pdf")).resolves.toBeUndefined(); // no throw
  });

  it("signed-URL expiry is honoured against the injected clock", async () => {
    let nowMs = 1_000_000;
    const storage = new InMemoryStoragePort(() => nowMs);
    await storage.put("acc/p/e/f.pdf", "x", "text/plain");
    const url = await storage.signedUrl("acc/p/e/f.pdf", 60); // expires at +60s
    expect(storage.resolve(url)!.expired).toBe(false);
    nowMs += 61_000;
    expect(storage.resolve(url)!.expired).toBe(true);
  });

  it("keeps tenants isolated by leading key segment", async () => {
    const storage = new InMemoryStoragePort();
    await storage.put("acc_1/p/e/a.pdf", "A", "application/pdf");
    await storage.put("acc_2/p/e/b.pdf", "B", "application/pdf");
    expect(storage.keys().filter((k) => ownerOf(k) === "acc_1")).toEqual(["acc_1/p/e/a.pdf"]);
    expect(storage.keys().filter((k) => ownerOf(k) === "acc_2")).toEqual(["acc_2/p/e/b.pdf"]);
  });
});

describe("SupabaseStoragePort — request shapes (stubbed fetch, no network)", () => {
  interface Call {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }

  function stub(responder: (call: Call) => { ok: boolean; status: number; json?: unknown }) {
    const calls: Call[] = [];
    const fetch = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }) => {
      const call: Call = { url, method: init?.method, headers: init?.headers, body: init?.body };
      calls.push(call);
      const r = responder(call);
      return {
        ok: r.ok,
        status: r.status,
        json: async () => r.json ?? {},
        text: async () => "",
      };
    };
    return { fetch: fetch as never, calls };
  }

  const opts = { url: "https://proj.supabase.co", serviceKey: "service-key", bucket: "evidence" };

  it("put POSTs to the object endpoint with auth + upsert", async () => {
    const { fetch, calls } = stub(() => ({ ok: true, status: 200 }));
    const port = new SupabaseStoragePort({ ...opts, fetch });
    await port.put("acc_1/p_oak/ev_1/CP12.pdf", "bytes", "application/pdf");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe("https://proj.supabase.co/storage/v1/object/evidence/acc_1/p_oak/ev_1/CP12.pdf");
    expect(calls[0]!.headers).toMatchObject({ Authorization: "Bearer service-key", "x-upsert": "true", "Content-Type": "application/pdf" });
  });

  it("signedUrl POSTs to the sign endpoint and returns an absolute URL", async () => {
    const { fetch } = stub(() => ({ ok: true, status: 200, json: { signedURL: "/object/sign/evidence/acc_1/p/e/f.pdf?token=abc" } }));
    const port = new SupabaseStoragePort({ ...opts, fetch });
    const url = await port.signedUrl("acc_1/p/e/f.pdf", 120);
    expect(url).toBe("https://proj.supabase.co/storage/v1/object/sign/evidence/acc_1/p/e/f.pdf?token=abc");
  });

  it("remove treats 404 as success (idempotent)", async () => {
    const { fetch } = stub(() => ({ ok: false, status: 404 }));
    const port = new SupabaseStoragePort({ ...opts, fetch });
    await expect(port.remove("acc_1/p/e/gone.pdf")).resolves.toBeUndefined();
  });

  it("surfaces real upload failures", async () => {
    const { fetch } = stub(() => ({ ok: false, status: 500 }));
    const port = new SupabaseStoragePort({ ...opts, fetch });
    await expect(port.put("acc_1/p/e/f.pdf", "x", "text/plain")).rejects.toThrow(/500/);
  });
});
