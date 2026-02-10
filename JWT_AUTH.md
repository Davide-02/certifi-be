# Autenticazione JWT

## Panoramica

Il backend utilizza JWT (JSON Web Tokens) per l'autenticazione. **Il JWT viene generato SOLO sul backend** al momento del login/registrazione, firmato con una secret key per garantire che non possa essere falsificato. Il frontend riceve il token e lo conserva (localStorage, sessionStorage o cookie sicuro) per inviarlo in tutte le richieste successive.

## Flusso Completo

### 1️⃣ Utente fa login
- **Frontend** invia `email` + `password` al backend (`POST /auth/login`)
- **Backend** verifica le credenziali sul database
- **Backend** genera il JWT token (firmato con la secret key configurata nel codice)
- **Backend** restituisce il token al frontend nella risposta

### 2️⃣ Frontend riceve e conserva il token
- Il frontend riceve il token nella risposta del login
- Il frontend conserva il token in:
  - `localStorage` (persistente)
  - `sessionStorage` (solo sessione)
  - Cookie sicuro (HttpOnly, Secure, SameSite)

### 3️⃣ Frontend invia il token nelle richieste
- Il frontend invia il token nell'header `Authorization: Bearer <token>`
- **Backend** verifica il token prima di servire la risorsa
- Se il token è valido, la richiesta viene processata
- Se il token è invalido/scaduto, viene restituito errore 401

## Configurazione

Il JWT_SECRET è configurato direttamente nel codice (`src/middleware/auth.ts`) e **non** viene letto dal file `.env`.

```typescript
const JWT_SECRET: string = "certifi-jwt-secret-key-2026-production-change-this";
const JWT_EXPIRES_IN: string = "24h";
```

**NOTA**: Il JWT_SECRET è hardcoded nel codice. Per cambiarlo, modifica direttamente il file `src/middleware/auth.ts`.

## Flusso di Autenticazione

### 1. Login

**Endpoint**: `POST /auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "name": "Nome",
    "surname": "Cognome",
    "role": "issuer",
    "status": "active",
    "isActive": true,
    "lastLoginAt": "2026-02-02T10:00:00.000Z"
  }
}
```

Il token JWT contiene (firmato con la secret key configurata nel codice):
- `userId`: ID dell'utente (number)
- `role`: Ruolo dell'utente (admin, issuer, verifier)
- `email`: Email dell'utente

**IMPORTANTE**: Il token viene generato e firmato SOLO sul backend. Il frontend non può generare o modificare token validi perché non conosce la secret key.

### 2. Utilizzo del Token nelle Richieste

Il frontend deve inviare il token in ogni richiesta autenticata nell'header:

```
Authorization: Bearer <token>
```

**Esempio con curl**:
```bash
curl -X GET http://localhost:3001/documents/my-certifications \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "X-Company-Id: 1"
```

### 3. Verifica del Token sul Backend

Il middleware `authMiddleware` (applicato automaticamente a tutte le route protette):
1. Legge l'header `Authorization`
2. Verifica che il formato sia `Bearer <token>`
3. **Verifica la firma del token** usando la secret key configurata (garantisce che non sia falsificato)
4. Verifica che il token non sia scaduto
5. Estrae `userId`, `role` e `email` dal payload
6. Aggiunge questi valori a `req.userId` e `req.userRole`
7. Se tutto è valido, passa alla route successiva
8. Se il token è invalido/scaduto, restituisce errore 401

## Route Protette

Le seguenti route richiedono autenticazione JWT:

- `POST /users` - Crea utente
- `GET /users` - Lista utenti
- `GET /users/:id` - Dettagli utente
- `PUT /users/:id` - Aggiorna utente
- `PATCH /users/:id` - Modifica parziale utente
- `DELETE /users/:id` - Elimina utente
- `POST /analyze` - Analizza documento
- `POST /certify` - Certifica documento
- Tutte le route `/documents/*` - Gestione documenti

## Route Pubbliche

Le seguenti route NON richiedono autenticazione:

- `POST /auth/login` - Login
- `POST /auth/register` - Registrazione
- `GET /verify` - Verifica pubblica
- `GET /health` - Health check

## Utilizzo nei Controller

Nei controller, puoi accedere ai dati dell'utente autenticato:

```typescript
import { AuthenticatedRequest } from "../middleware/auth";

export async function myController(
  req: AuthenticatedRequest,
  res: Response
) {
  // Accedi ai dati dell'utente autenticato
  const userId = req.userId;        // string
  const userRole = req.userRole;   // string
  const companyId = req.companyId; // number | undefined

  // Il middleware garantisce che questi valori siano presenti
  // per tutte le route protette
}
```

## Gestione Errori

Il middleware restituisce i seguenti errori:

- **401 Unauthorized**: Token mancante o non valido
  ```json
  {
    "success": false,
    "error": "Token di autenticazione mancante"
  }
  ```

- **401 Unauthorized**: Token scaduto
  ```json
  {
    "success": false,
    "error": "Token scaduto"
  }
  ```

- **401 Unauthorized**: Token non valido
  ```json
  {
    "success": false,
    "error": "Token non valido"
  }
  ```

## Implementazione Frontend

Il frontend deve implementare:

### 1. Login e salvataggio del token
```typescript
// Dopo il login
const response = await fetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
const { token, user } = await response.json();

// Salva il token
localStorage.setItem('authToken', token);
// oppure
sessionStorage.setItem('authToken', token);
// oppure (consigliato per sicurezza)
// Cookie HttpOnly gestito dal backend
```

### 2. Inviare il token in ogni richiesta
```typescript
const token = localStorage.getItem('authToken');

fetch('/documents/my-certifications', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Company-Id': '1'
  }
});
```

### 3. Gestire token scaduto
```typescript
// Se ricevi 401, reindirizza al login
if (response.status === 401) {
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}
```

## Sicurezza

✅ **Il JWT viene generato SOLO sul backend** con una secret key
✅ **Il frontend non può falsificare token** perché non conosce la secret
✅ **Ogni token è firmato** e verificato sul backend
✅ **Il token ha una scadenza** (configurata nel codice, default: 24h)
✅ **Il token contiene solo dati non sensibili** (userId, role, email)
