import { storeHash, verifyHashOnChain } from "../utils/blockchain";

export class BlockchainService {
  /** Check if hash is already certified on blockchain */
  static async isHashCertifiedOnChain(hash: string): Promise<boolean> {
    return verifyHashOnChain(hash);
  }

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
