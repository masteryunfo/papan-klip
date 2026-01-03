"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { EncryptedMessage, StoredMessage } from "../lib/types";
import { toArrayBuffer } from "../lib/crypto";

const INITIAL_BACKOFF_MS = 1800;
const MAX_BACKOFF_MS = 10_000;
const BUFFER_SECONDS = 30;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function decryptPayload(payload: EncryptedMessage, pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const salt = base64ToBytes(payload.salt_b64);
  const iv = base64ToBytes(payload.iv_b64);
  const ciphertext = base64ToBytes(payload.ciphertext_b64);

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
      iterations: payload.iterations,
      hash: payload.hash,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  return decoder.decode(plaintext);
}

export default function ReceivePage() {
  const [token, setToken] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [encryptedPayload, setEncryptedPayload] = useState<EncryptedMessage | null>(null);
  const [pin, setPin] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const pollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    async function createSession() {
      setStatus("Creating session...");
      const response = await fetch("/api/session", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create session.");
      }
      const data = await response.json();
      setToken(data.token);
      setShortCode(data.short_code);
      setExpiresIn(data.expires_in_seconds);
      setQrUrl(data.qr_url);
      setStatus(null);
    }

    createSession().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to create session.");
    });
  }, []);

  useEffect(() => {
    if (!qrUrl) return;
    QRCode.toDataURL(qrUrl, { margin: 1, width: 220 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [qrUrl]);

  useEffect(() => {
    return () => {
      if (pollTimeout.current) {
        clearTimeout(pollTimeout.current);
      }
    };
  }, []);

  async function pollOnce(backoff: number) {
    if (!token) return;
    const now = Date.now();
    const start = startTimeRef.current ?? now;
    startTimeRef.current = start;

    if (expiresIn && now - start > (expiresIn + BUFFER_SECONDS) * 1000) {
      setStatus("Session expired. Refresh to start again.");
      setPolling(false);
      return;
    }

    try {
      const response = await fetch("/api/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: token }),
      });
      if (!response.ok) {
        throw new Error("Receive failed.");
      }
      const data = await response.json();
      if (data.ok && data.message) {
        const message = data.message as StoredMessage;
        if (message.encrypted) {
          setEncryptedPayload(message);
          setStatus("Encrypted message received. Enter PIN to decrypt.");
        } else {
          setReceivedText(message.text);
          setStatus("Message received.");
        }
        setPolling(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed.");
      setPolling(false);
      return;
    }

    const nextBackoff = Math.min(backoff * 1.6, MAX_BACKOFF_MS);
    pollTimeout.current = setTimeout(() => {
      pollOnce(nextBackoff).catch(() => null);
    }, backoff);
  }

  function startPolling() {
    if (!token) return;
    setError(null);
    setStatus("Waiting for message...");
    setReceivedText(null);
    setEncryptedPayload(null);
    setPolling(true);
    startTimeRef.current = Date.now();
    if (pollTimeout.current) {
      clearTimeout(pollTimeout.current);
    }
    pollTimeout.current = setTimeout(() => {
      pollOnce(INITIAL_BACKOFF_MS).catch(() => null);
    }, INITIAL_BACKOFF_MS);
  }

  async function handleDecrypt() {
    if (!encryptedPayload) return;
    if (!pin.trim()) {
      setError("Enter a PIN to decrypt.");
      return;
    }
    setDecrypting(true);
    setError(null);
    try {
      const plaintext = await decryptPayload(encryptedPayload, pin.trim());
      setReceivedText(plaintext);
      setEncryptedPayload(null);
      setStatus("Message decrypted.");
    } catch (err) {
      setError("Failed to decrypt. Check your PIN.");
    } finally {
      setDecrypting(false);
    }
  }

  async function handleCopy() {
    if (!receivedText) return;
    try {
      await navigator.clipboard.writeText(receivedText);
      setStatus("Copied to clipboard.");
    } catch {
      setStatus("Copy failed. Select and copy manually.");
    }
  }

  return (
    <div>
      <h1>Receive</h1>
      <p className="muted">
        This page creates a temporary session and waits for a message.
      </p>

      <div className="card">
        <div className="row">
          <div className="qr">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code" width={220} height={220} />
            ) : (
              <span className="muted">QR loading...</span>
            )}
          </div>
          <div>
            <p>
              Token: {token ? <span className="code">{token}</span> : "..."}
            </p>
            <p>
              Short code:{" "}
              {shortCode ? <span className="code">{shortCode}</span> : "..."}
            </p>
            <p className="muted">
              TTL: {expiresIn ? `${Math.round(expiresIn / 60)} min` : "..."}
            </p>
            <button onClick={startPolling} disabled={!token || polling}>
              {polling ? "Polling..." : "Start polling"}
            </button>
          </div>
        </div>
        {status && <div className="notice">{status}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      {encryptedPayload && (
        <div className="card">
          <h2>Decrypt message</h2>
          <p className="muted">
            This message is encrypted. Enter the PIN used on the phone.
          </p>
          <label htmlFor="pin">PIN</label>
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={handleDecrypt} disabled={decrypting}>
              {decrypting ? "Decrypting..." : "Decrypt"}
            </button>
          </div>
        </div>
      )}

      {receivedText && (
        <div className="card">
          <h2>Message</h2>
          <textarea readOnly rows={6} value={receivedText} />
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={handleCopy}>Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}
