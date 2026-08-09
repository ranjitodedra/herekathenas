import { createHmac } from "crypto";

/** Synthetic email for Supabase Auth (no real mailbox; phone is the public identity). */
export function phoneAuthEmail(phoneHash: string): string {
  return `${phoneHash}@phone.herekathenas.app`;
}

/** Deterministic password derived from E.164 + pepper (user never sees it). */
export function phoneAuthPassword(e164: string): string {
  const pepper = process.env.PHONE_HASH_PEPPER ?? "dev-pepper-change-me";
  return createHmac("sha256", pepper).update(`auth-password:${e164}`).digest("base64url");
}
