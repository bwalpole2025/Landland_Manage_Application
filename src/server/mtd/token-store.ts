// Secure store for HMRC OAuth tokens.
//
// SECURITY: we never store Government Gateway usernames or passwords — only the
// OAuth access/refresh tokens HMRC issues. In production these belong encrypted
// at rest (e.g. KMS-wrapped column / secrets manager) and scoped per account;
// `MemoryMtdTokenStore` is the dev/sandbox implementation behind the same
// interface so the swap is a one-liner.

import "server-only";
import { providers } from "@/server/providers";
import { encryptSecret, decryptSecret } from "@/server/security/encryption";
import type { OAuthTokens } from "@/server/providers/hmrc-mtd";

export interface StoredMtdTokens extends OAuthTokens {
  obtainedAt: string;
}

export interface MtdTokenStore {
  get(accountId: string): Promise<StoredMtdTokens | null>;
  save(accountId: string, tokens: OAuthTokens): Promise<void>;
  clear(accountId: string): Promise<void>;
}

class MemoryMtdTokenStore implements MtdTokenStore {
  // Tokens are held encrypted at rest; only decrypted on read. A persistent
  // store (DB/secrets manager) would keep the same enc:/plain: column format.
  private readonly tokens = new Map<string, StoredMtdTokens>();

  async get(accountId: string): Promise<StoredMtdTokens | null> {
    const stored = this.tokens.get(accountId);
    if (!stored) return null;
    return {
      ...stored,
      accessToken: decryptSecret(stored.accessToken),
      refreshToken: decryptSecret(stored.refreshToken),
    };
  }

  async save(accountId: string, tokens: OAuthTokens): Promise<void> {
    this.tokens.set(accountId, {
      ...tokens,
      accessToken: encryptSecret(tokens.accessToken),
      refreshToken: encryptSecret(tokens.refreshToken),
      obtainedAt: new Date().toISOString(),
    });
  }

  async clear(accountId: string): Promise<void> {
    this.tokens.delete(accountId);
  }
}

// Module singleton so every server action in the process shares one store.
export const mtdTokenStore: MtdTokenStore = new MemoryMtdTokenStore();

function isExpired(tokens: StoredMtdTokens, skewMs = 60_000): boolean {
  return Date.parse(tokens.expiresAt) - skewMs <= Date.now();
}

/**
 * Returns a usable access token for the account, transparently refreshing it
 * with the refresh token when the current one has expired. Returns null when the
 * account has never authorised (or the refresh failed).
 */
export async function getValidAccessToken(accountId: string): Promise<StoredMtdTokens | null> {
  const current = await mtdTokenStore.get(accountId);
  if (!current) return null;
  if (!isExpired(current)) return current;
  try {
    const refreshed = await providers.hmrcMtd.refreshTokens(current.refreshToken);
    await mtdTokenStore.save(accountId, refreshed);
    return mtdTokenStore.get(accountId);
  } catch {
    return null; // refresh token rejected — caller must re-authorise.
  }
}
