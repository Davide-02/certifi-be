# CertiFi API

Server Express responsabile del flusso di certificazione:

1. Riceve file (Multer in memoria)
2. Calcola hash SHA-256
3. Carica il file su S3/Cloudflare R2 (bucket privato)
4. Genera presigned URL (5 minuti)
5. Scrive l'hash su Base testnet (mock)
6. Firma digitalmente l'hash (ECDSA secp256k1)
7. Salva il record in `data/certificates.json`
8. Espone endpoint `POST /certify`, `GET/POST /verify`

## Setup

```bash
npm install
cp .env.example .env    # compila con le tue credenziali
npm run dev             # http://localhost:3001
```

## Variabili d'ambiente principali

| Variabile | Descrizione |
|-----------|-------------|
| `PORT` | Porta del server (default 3001) |
| `S3_*` | Parametri per S3/Cloudflare R2 (bucket privato) |
| `CERTIFI_ISSUER`, `CHAIN_ID`, `CONTRACT_ADDRESS` | Metadati certificatore |
| `SERVER_PRIVATE_KEY`, `SERVER_PUBLIC_KEY` | Coppia di chiavi per firma ECDSA |

Le chiavi devono essere in formato PEM. Usa `node scripts/generate-keys.js` (dal vecchio repo) o OpenSSL per generarne di nuove.

## Endpoint

- `POST /certify` – input `file`, output `{ hash, txHash, fileKey, presignedUrl, qrPayload }`
- `GET /verify?hash=...` – verifica tramite hash
- `GET /verify?p=<base64>` – verifica tramite payload QR
- `POST /verify` – verifica caricando nuovamente il file (opzionale `hash`)
- `GET /health` – healthcheck

## Database

Per l'MVP viene usato un file JSON (`data/certificates.json`). In produzione sostituisci con un DB vero (Postgres, Mongo, ecc.).
