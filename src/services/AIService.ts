import fetch from "node-fetch";
import { AIAnalysisResponse } from "../dto/ai.dto";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_VERSION = process.env.AI_VERSION || "v1.0";

export class AIService {
  static async analyzeDocument(
    documentId: string,
    hash: string,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    requestedTasks?: string[]
  ): Promise<AIAnalysisResponse> {
    const defaultTasks = ["classify", "extract", "claims", "holder", "compliance_score"];

    const boundary = `----CertiFi-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const CRLF = "\r\n";
    const parts: Buffer[] = [];

    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="document_id"${CRLF}${CRLF}`));
    parts.push(Buffer.from(documentId));
    parts.push(Buffer.from(CRLF));

    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="hash"${CRLF}${CRLF}`));
    parts.push(Buffer.from(hash));
    parts.push(Buffer.from(CRLF));

    const tasksString = (requestedTasks || defaultTasks).join(",");
    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="requested_tasks"${CRLF}${CRLF}`));
    parts.push(Buffer.from(tasksString));
    parts.push(Buffer.from(CRLF));

    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="ai_version"${CRLF}${CRLF}`));
    parts.push(Buffer.from(AI_VERSION));
    parts.push(Buffer.from(CRLF));

    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`));
    parts.push(Buffer.from(`Content-Type: ${contentType}${CRLF}${CRLF}`));
    parts.push(fileBuffer);
    parts.push(Buffer.from(CRLF));

    parts.push(Buffer.from(`--${boundary}--${CRLF}`));
    const body = Buffer.concat(parts);

    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Service error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as AIAnalysisResponse;
  }
}
