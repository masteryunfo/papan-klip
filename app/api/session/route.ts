import { NextRequest, NextResponse } from "next/server";
import { MESSAGE_TTL_SECONDS, redis } from "../../lib/redis";

export const runtime = "nodejs";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateShortCode(): string {
  const bytes = getRandomBytes(5);
  let buffer = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      const index = (buffer >> (bits - 5)) & 31;
      output += ALPHABET[index];
      bits -= 5;
    }
  }
  if (output.length < 8) {
    output += ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return output.slice(0, 8);
}

function resolveBaseUrl(req: NextRequest): string {
  const base = process.env.BASE_URL;
  if (base) {
    return base.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) {
    return "";
  }
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const token = bytesToHex(getRandomBytes(16));
  const shortCode = generateShortCode();

  await redis.set(`code:${shortCode}`, token, { ex: MESSAGE_TTL_SECONDS });

  const baseUrl = resolveBaseUrl(req);
  const qrUrl = baseUrl ? `${baseUrl}/send?t=${token}` : `/send?t=${token}`;

  return NextResponse.json({
    token,
    short_code: shortCode,
    expires_in_seconds: MESSAGE_TTL_SECONDS,
    qr_url: qrUrl,
  });
}
