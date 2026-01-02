export function toArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const buf = view.buffer;
  const start = view.byteOffset;
  const end = start + view.byteLength;

  if (buf instanceof ArrayBuffer) {
    return buf.slice(start, end);
  }

  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(new Uint8Array(buf as ArrayBuffer, start, view.byteLength));
  return out;
}
