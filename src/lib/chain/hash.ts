import { createHash } from "node:crypto";

export const HASH_BYTES = 32; // sha256
export const ZERO_HASH = Buffer.alloc(HASH_BYTES, 0);

export function sha256(input: Buffer): Buffer {
  return createHash("sha256").update(input).digest();
}

export function sha256Concat(...parts: readonly Buffer[]): Buffer {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest();
}

/* Encodes a positive integer chain position as an 8-byte big-endian buffer.
   Fixed width keeps the entry_hash pre-image unambiguous regardless of
   position magnitude. */
export function chainPositionBytes(position: number): Buffer {
  if (!Number.isInteger(position) || position < 0) {
    throw new Error(`invalid chain position: ${position}`);
  }
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(position));
  return b;
}

export function toHex(buf: Buffer): string {
  return buf.toString("hex");
}
