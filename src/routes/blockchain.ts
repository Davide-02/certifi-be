import { Request, Response } from "express";
import { storeHash, getHash } from "../utils/blockchain";

export async function storeHashHandler(req: Request, res: Response) {
  try {
    const { hash } = req.body || {};

    if (!hash || typeof hash !== "string") {
      return res.status(400).json({
        error: "Parametro hash mancante o non valido",
      });
    }

    const txHash = await storeHash(hash);

    return res.json({
      success: true,
      txHash,
    });
  } catch (error) {
    console.error("Errore storeHashHandler:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante la scrittura on-chain",
    });
  }
}

export async function getHashHandler(req: Request, res: Response) {
  try {
    const address =
      (req.query.address as string | undefined) ??
      (req.body?.address as string | undefined);
    const hash = await getHash(address);

    return res.json({
      success: true,
      hash,
      address: address || undefined,
    });
  } catch (error) {
    console.error("Errore getHashHandler:", error);
    return res.status(500).json({
      success: false,
      error: "Errore durante la lettura on-chain",
    });
  }
}
