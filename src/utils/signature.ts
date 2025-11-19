import { createSign, createVerify } from "crypto";

// Chiave privata del server (in produzione, usa variabile d'ambiente o secret manager)
// Per MVP, genera una chiave con: openssl ecparam -genkey -name secp256k1 -noout
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY || "";

// Chiave pubblica corrispondente (per la verifica)
const SERVER_PUBLIC_KEY = process.env.SERVER_PUBLIC_KEY || "";

/**
 * Firma un hash con la chiave privata del server
 * Usa ECDSA con curva secp256k1 (stessa di Bitcoin/Ethereum)
 */
export function signHash(hash: string): string {
  if (!SERVER_PRIVATE_KEY) {
    throw new Error("SERVER_PRIVATE_KEY non configurata");
  }

  const sign = createSign("SHA256");
  sign.update(hash);
  sign.end();

  const signature = sign.sign(SERVER_PRIVATE_KEY, "base64");
  return signature;
}

/**
 * Verifica una firma con la chiave pubblica del server
 */
export function verifySignature(hash: string, signature: string): boolean {
  if (!SERVER_PUBLIC_KEY) {
    throw new Error("SERVER_PUBLIC_KEY non configurata");
  }

  const verify = createVerify("SHA256");
  verify.update(hash);
  verify.end();

  return verify.verify(SERVER_PUBLIC_KEY, signature, "base64");
}

/**
 * Genera coppia di chiavi per il server (solo per setup iniziale)
 * In produzione, genera le chiavi manualmente e salva in env vars
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateKeyPairSync } = require("crypto");

  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return { privateKey, publicKey };
}
