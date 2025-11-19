/**
 * Mock endpoint per scrivere hash su Base testnet
 * In produzione, questo sarà sostituito con una chiamata reale al contratto
 */
export async function writeToBaseTestnet(hash: string): Promise<string> {
  // Mock: simula una transazione su Base testnet
  // In produzione, qui ci sarà la logica per chiamare il contratto smart
  // Il parametro hash verrà usato per scrivere on-chain

  const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;

  // Simula un delay di rete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In produzione: await contract.writeHash(hash);

  return mockTxHash;
}

/**
 * Verifica se un hash esiste on-chain (mock)
 * In produzione, leggi dal contratto smart
 */
export async function verifyOnChain(hash: string): Promise<{
  exists: boolean;
  txHash?: string;
  blockNumber?: number;
}> {
  // Mock: simula verifica on-chain
  // In produzione: const result = await contract.getHash(hash);

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Per ora, assumiamo che se l'hash è nel formato corretto, esista
  // In produzione, verifica realmente sul contratto
  const exists = hash.length === 64; // SHA-256 hex = 64 caratteri

  return {
    exists,
    txHash: exists
      ? `0x${Math.random().toString(16).substring(2, 66)}`
      : undefined,
    blockNumber: exists ? Math.floor(Math.random() * 1000000) : undefined,
  };
}

