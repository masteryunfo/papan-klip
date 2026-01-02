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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.identifier !== "string") {
    return NextResponse.json({ ok: false, message: null }, { status: 400 });
  }

  const token = await resolveToken(body.identifier);
  if (!token) {
    return NextResponse.json({ ok: false, message: null });
  }

  const script =
    "local val = redis.call('GET', KEYS[1]); if not val then return nil; end; redis.call('DEL', KEYS[1]); return val;";

  const raw = await redis.eval<[], string | null>(script, [`msg:${token}`], []);
  if (!raw) {
    return NextResponse.json({ ok: false, message: null });
  }

  try {
    const message = JSON.parse(raw) as StoredMessage;
    return NextResponse.json({ ok: true, message });
  } catch {
    return NextResponse.json({ ok: false, message: null }, { status: 500 });
  }
}
