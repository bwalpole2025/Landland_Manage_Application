// Optional TOTP two-factor, built on otplib. Secrets are stored on the user;
// 2FA is only enforced at login when `totpEnabled` is true.
import { authenticator } from "otplib";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI to render as a QR code in an authenticator app. */
export function totpKeyUri(accountEmail: string, secret: string): string {
  return authenticator.keyuri(accountEmail, "PropManage", secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
