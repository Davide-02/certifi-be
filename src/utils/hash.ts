import { createHash } from "crypto";

/**
 * Genera hash SHA-256 di un file buffer
 */
export function generateSHA256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
