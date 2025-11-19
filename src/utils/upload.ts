import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configurazione per S3 o Cloudflare R2 (BUCKET PRIVATO)
const s3Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT, // Per Cloudflare R2
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Upload file su S3 o Cloudflare R2 (bucket privato)
 * Ritorna solo la key, non l'URL pubblico
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME || "certifi-uploads";
  const key = `certificates/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Ritorna solo la key, NON l'URL pubblico
  return key;
}

/**
 * Genera URL firmato con expiration 5 minuti
 * Per accedere a file in bucket privato
 */
export async function getPresignedUrl(key: string): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME || "certifi-uploads";

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // URL firmato valido per 5 minuti (300 secondi)
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return signedUrl;
}

/**
 * Scarica file da R2/S3 (per verifica)
 * Ritorna il buffer del file
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const bucketName = process.env.S3_BUCKET_NAME || "certifi-uploads";

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("File non trovato su R2/S3");
  }

  // Converti stream in buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Verifica se un file esiste su R2/S3
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const bucketName = process.env.S3_BUCKET_NAME || "certifi-uploads";
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}
