"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EncryptedMessage, PlainMessage } from "../lib/types";
import { toArrayBuffer } from "../lib/crypto";

export const dynamic = "force-dynamic";

const DEFAULT_ITERATIONS = 200_000;
const MAX_PLAINTEXT_BYTES = 50 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function encryptPayload(text: string, pin: string): Promise<EncryptedMessage> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: DEFAULT_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    encoder.encode(text),
  );

  return {
    encrypted: true,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: DEFAULT_ITERATIONS,
    salt_b64: bytesToBase64(salt),
    iv_b64: bytesToBase64(iv),
    ciphertext_b64: bytesToBase64(new Uint8Array(ciphertext)),
    version: 1,
  };
}

export default function SendPage() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [text, setText] = useState("");
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const token = searchParams.get("t");
    if (token) {
      setIdentifier(token);
    }
  }, [searchParams]);

  async function handleSend() {
    setSending(true);
    setStatus(null);
    setError(null);
    try {
      if (!identifier.trim()) {
        throw new Error("Enter a token or short code.");
      }
      if (!text.trim()) {
        throw new Error("Enter some text to send.");
      }

      const encoder = new TextEncoder();
      if (!pin.trim()) {
        const size = encoder.encode(text).length;
        if (size > MAX_PLAINTEXT_BYTES) {
          throw new Error("Plaintext is limited to 50KB. Use a PIN to encrypt.");
        }
      }

      let message: PlainMessage | EncryptedMessage;
      if (pin.trim()) {
        message = await encryptPayload(text, pin.trim());
      } else {
        message = { encrypted: false, text, version: 1 };
      }

      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), message }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Send failed.");
      }

      setStatus("Sent! The message will expire after the TTL or when it is received.");
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1>Send</h1>
      <p className="muted">
        Paste a token or short code, then send. Add a PIN to encrypt in your
        browser.
      </p>

      <div className="card">
        <label htmlFor="identifier">Token or short code</label>
        <input
          id="identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="TOKEN or ABCD2345"
        />

        <label htmlFor="text">Message</label>
        <textarea
          id="text"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type your message"
        />

        <label htmlFor="pin">PIN (optional)</label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Client-side encryption PIN"
        />

        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
        {status && <div className="notice">{status}</div>}
        {error && <div className="alert">{error}</div>}
      </div>
    </div>
  );
}
