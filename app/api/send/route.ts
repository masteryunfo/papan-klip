import { NextRequest, NextResponse } from "next/server";
import { MESSAGE_TTL_SECONDS, redis } from "../../lib/redis";
import type { StoredMessage } from "../../lib/types";

export const runtime = "nodejs";

const SHORT_CODE_RE = /^[A-Z2-7]{8}$/;
const MAX_PLAINTEXT_BYTES = 50 * 1024;

function normalizeIdentifier(identifier: string): { token?: string; shortCode?: string } {
  const trimmed = identifier.trim();
  const upper = trimmed.toUpperCase();
  if (SHORT_CODE_RE.test(upper)) {
    return { shortCode: upper };
  }
  return { token: trimmed };
}

async function resolveToken(identifier: string): Promise<string | null> {
  const { shortCode, token } = normalizeIdentifier(identifier);
  if (shortCode) {
    const resolved = await redis.get<string>(`code:${shortCode}`);
    return resolved ?? null;
  }
  return token ?? null;
}

function isStoredMessage(message: unknown): message is StoredMessage {
  if (!message || typeof message !== "object") {
    return false;
  }
  const payload = message as StoredMessage;
  if (payload.version !== 1) {
    return false;
  }
  if (payload.encrypted === false) {
    return typeof payload.text === "string";
  }
  if (payload.encrypted === true) {
    return (
      payload.kdf === "PBKDF2" &&
      payload.hash === "SHA-256" &&
      typeof payload.iterations === "number" &&
      typeof payload.salt_b64 === "string" &&
      typeof payload.iv_b64 === "string" &&
      typeof payload.ciphertext_b64 === "string"
    );
  }
  return false;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.identifier !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid identifier" }, { status: 400 });
  }

  const token = await resolveToken(body.identifier);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unknown identifier" }, { status: 404 });
  }

  if (!isStoredMessage(body.message)) {
    return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  }

  if (body.message.encrypted === false) {
    const size = new TextEncoder().encode(body.message.text).length;
    if (size > MAX_PLAINTEXT_BYTES) {
      return NextResponse.json({ ok: false, error: "Message too large" }, { status: 413 });
    }
  }

  const payload: StoredMessage = body.message;

  await redis.set(`msg:${token}`, JSON.stringify(payload), {
    ex: MESSAGE_TTL_SECONDS,
  });

  return NextResponse.json({ ok: true, expires_in_seconds: MESSAGE_TTL_SECONDS });
}
