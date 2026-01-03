import { NextRequest, NextResponse } from "next/server";
import { redis } from "../../lib/redis";
import type { StoredMessage } from "../../lib/types";

export const runtime = "nodejs";

const SHORT_CODE_RE = /^[A-Z2-7]{8}$/;

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

function unwrapRedisValue(value: unknown): unknown {
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result?: unknown }).result;
  }
  return value;
}

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 200);
  }
  try {
    return JSON.stringify(value).slice(0, 200);
  } catch {
    return String(value);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.identifier !== "string") {
      return NextResponse.json(
        { ok: false, error: "missing_token" },
        { status: 400 },
      );
    }

    const identifier = body.identifier.trim();
    const isShortCode = SHORT_CODE_RE.test(identifier.toUpperCase());
    const token = await resolveToken(identifier);
    if (!token) {
      return NextResponse.json({ ok: true, message: null });
    }

    let raw: unknown = null;
    if (typeof redis.getdel === "function") {
      raw = await redis.getdel(`msg:${token}`);
    } else {
      raw = await redis.get(`msg:${token}`);
      if (raw) {
        await redis.del(`msg:${token}`);
      }
    }

    const unwrapped = unwrapRedisValue(raw);
    if (!unwrapped) {
      return NextResponse.json({ ok: true, message: null });
    }

    if (isShortCode) {
      await redis.del(`code:${identifier.toUpperCase()}`);
    }

    try {
      let message: StoredMessage;
      if (typeof unwrapped === "string") {
        message = JSON.parse(unwrapped) as StoredMessage;
      } else {
        message = unwrapped as StoredMessage;
      }
      return NextResponse.json({ ok: true, message });
    } catch (error) {
      const preview = previewValue(unwrapped);
      console.error("Failed to parse stored message payload", {
        error,
        preview,
      });
      return NextResponse.json({
        ok: false,
        message: null,
        error: "bad_payload",
      });
    }
  } catch (error) {
    console.error("Receive handler failed", error);
    return NextResponse.json(
      { ok: false, error: "receive_failed" },
      { status: 500 },
    );
  }
}
