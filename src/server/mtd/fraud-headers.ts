// HMRC fraud-prevention headers.
//
// HMRC requires every MTD API call to carry a set of `Gov-Client-*` / `Gov-Vendor-*`
// headers that describe the origin of the request. Omitting them is rejected with
// PRECONDITION_FAILED. This module builds a representative server-originated set
// and validates it. The connection method here is WEB_APP_VIA_SERVER — the user
// drives a web app and our server relays to HMRC.

import { REQUIRED_FRAUD_HEADERS } from "@/server/providers/hmrc-mtd";

export interface FraudHeaderClientInfo {
  /** Best-effort public IP of the end user, when known. */
  clientPublicIp?: string;
  userAgent?: string;
  /** Stable per-install device id (not personally identifying). */
  deviceId?: string;
  timezone?: string;
  /** Hashed/opaque user id — never the Gateway username. */
  userId?: string;
}

const VENDOR = {
  productName: "PropManage",
  version: "1.0.0",
  licenseId: "landland-mtd-001",
};

export function buildFraudPreventionHeaders(info: FraudHeaderClientInfo = {}): Record<string, string> {
  return {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Device-ID": info.deviceId ?? "00000000-0000-0000-0000-000000000000",
    "Gov-Client-Timezone": info.timezone ?? "UTC+00:00",
    "Gov-Client-User-IDs": `landland=${info.userId ?? "anonymous"}`,
    "Gov-Client-Public-IP": info.clientPublicIp ?? "",
    "Gov-Client-User-Agent": info.userAgent ?? "PropManage/1.0",
    "Gov-Vendor-Product-Name": VENDOR.productName,
    "Gov-Vendor-Version": `${VENDOR.productName}=${VENDOR.version}`,
    "Gov-Vendor-License-IDs": `landland=${VENDOR.licenseId}`,
  };
}

/** Returns the list of required headers that are missing or empty. */
export function missingFraudHeaders(headers: Record<string, string>): string[] {
  return REQUIRED_FRAUD_HEADERS.filter((h) => !headers[h]);
}
