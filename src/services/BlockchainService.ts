import fetch from "node-fetch";
import { storeHash } from "../utils/blockchain";

export class BlockchainService {
  static async certifyHash(
    hash: string,
    metadata?: { document_family?: string; company_id?: number }
  ): Promise<{ tx_hash: string; status: string; timestamp: string }> {
    // Use existing blockchain utility
    const txHash = await storeHash(hash);
    return {
      tx_hash: txHash,
      status: "confirmed",
      timestamp: new Date().toISOString(),
    };
  }
}
