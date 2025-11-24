import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

console.log("RPC URL:", process.env.RPC_URL);
console.log("CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS);
console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY);

const CONTRACT_ABI = [
  "function getHash(address _owner) public view returns (bytes32)",
  "function storeHash(bytes32 _hash) public",
  "function verify(bytes32 hash) external view returns (bool exists)",
];

let provider: ethers.JsonRpcProvider | null = null;
let readContract: ethers.Contract | null = null;
let writeContract: ethers.Contract | null = null;
let signerWallet: ethers.Wallet | null = null;

function ensureEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Variabile d'ambiente ${name} non configurata`);
  }
  return value;
}

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = ensureEnv(RPC_URL, "RPC_URL");
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

function getReadContract(): ethers.Contract {
  if (!readContract) {
    const address = ensureEnv(CONTRACT_ADDRESS, "CONTRACT_ADDRESS");
    readContract = new ethers.Contract(address, CONTRACT_ABI, getProvider());
  }
  return readContract;
}

function getSignerWallet(): ethers.Wallet {
  if (!signerWallet) {
    const key = ensureEnv(PRIVATE_KEY, "PRIVATE_KEY");
    signerWallet = new ethers.Wallet(key, getProvider());
  }
  return signerWallet;
}

function getWriteContract(): ethers.Contract {
  if (!writeContract) {
    const address = ensureEnv(CONTRACT_ADDRESS, "CONTRACT_ADDRESS");
    writeContract = new ethers.Contract(
      address,
      CONTRACT_ABI,
      getSignerWallet()
    );
  }
  return writeContract;
}

function getSignerAddress(): string {
  return getSignerWallet().address;
}

async function getFreshNonce(address: string): Promise<number> {
  return await getProvider().getTransactionCount(address, "pending");
}

function normalizeAddress(address?: string): string {
  const target = address ?? getSignerAddress();
  try {
    return ethers.getAddress(target);
  } catch (error) {
    throw new Error("Indirizzo non valido per getHash");
  }
}

function normalizeBytes32(hash: string): string {
  if (!hash) {
    throw new Error("Hash non valido o vuoto");
  }

  const trimmed = hash.trim();

  if (trimmed.startsWith("0x")) {
    if (trimmed.length !== 66) {
      throw new Error(
        "L'hash deve essere un hex di 32 byte (66 caratteri con 0x)"
      );
    }
    return trimmed;
  }

  if (trimmed.length !== 64) {
    throw new Error("L'hash deve contenere 64 caratteri hex (32 byte)");
  }

  return `0x${trimmed}`;
}

export async function storeHash(hash: string): Promise<string> {
  const normalizedHash = normalizeBytes32(hash);
  const wallet = getSignerWallet();
  const contract = getWriteContract();

  // Popola la transazione senza inviarla
  const populatedTx = await contract.storeHash.populateTransaction(
    normalizedHash
  );

  // Ottieni nonce fresco (bypass cache ethers)
  const nonce = await getFreshNonce(wallet.address);

  // Invia transazione con nonce manuale
  const tx = await wallet.sendTransaction({
    ...populatedTx,
    nonce,
  });

  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function getHash(address?: string): Promise<string> {
  const contract = getReadContract();
  const normalizedAddress = normalizeAddress(address);
  const storedHash: string = await contract.getHash(normalizedAddress);
  return storedHash;
}

/**
 * Verifica se un hash esiste on-chain usando la funzione verify del contratto
 */
export async function verifyHashOnChain(hash: string): Promise<boolean> {
  try {
    const normalizedHash = normalizeBytes32(hash);
    const contract = getReadContract();
    const exists: boolean = await contract.verify(normalizedHash);
    return exists;
  } catch (error) {
    console.error("Errore durante la verifica on-chain:", error);
    return false;
  }
}

/**
 * @deprecated Usa verifyHashOnChain invece
 * Mantenuto per compatibilità, ma ora usa verifyHashOnChain internamente
 */
export async function verifyOnChain(
  hash: string,
  address?: string
): Promise<{
  exists: boolean;
  storedHash?: string;
}> {
  try {
    const exists = await verifyHashOnChain(hash);
    return {
      exists,
    };
  } catch (error) {
    console.error("Errore durante la verifica on-chain:", error);
    return { exists: false };
  }
}
