export function toArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const buf = view.buffer;
  const start = view.byteOffset;
  const len = view.byteLength;
  const out = new ArrayBuffer(len);
  const src = new Uint8Array(buf as unknown as ArrayBufferLike, start, len);
  new Uint8Array(out).set(src);
  return out;
}
