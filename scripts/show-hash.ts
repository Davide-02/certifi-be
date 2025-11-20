import "dotenv/config";
import { getHash } from "../src/utils/blockchain";

async function main() {
  const [, , address] = process.argv;

  try {
    const hash = await getHash(address);
    console.log(
      `Hash registrato per ${address ?? "default signer"}: ${
        hash !== "0x" ? hash : "0x (vuoto)"
      }`
    );
  } catch (error) {
    console.error("Errore durante la lettura dell'hash:", error);
    process.exit(1);
  }
}

main();
