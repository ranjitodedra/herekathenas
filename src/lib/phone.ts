import { createHash } from "crypto";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

const DEFAULT_REGION: CountryCode = "US";

export function normalizePhone(
  raw: string,
  defaultRegion: CountryCode = DEFAULT_REGION,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

export function hashPhone(e164: string, pepper?: string): string {
  const secret = pepper ?? process.env.PHONE_HASH_PEPPER ?? "dev-pepper-change-me";
  return createHash("sha256").update(`${secret}:${e164}`).digest("hex");
}

export function normalizeAndHashPhone(
  raw: string,
  defaultRegion?: CountryCode,
): { e164: string; hash: string } | null {
  const e164 = normalizePhone(raw, defaultRegion);
  if (!e164) return null;
  return { e164, hash: hashPhone(e164) };
}

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
