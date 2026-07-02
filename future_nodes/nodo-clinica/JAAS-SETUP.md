# JaaS (8x8) — videoconsultas sin límite de 5 minutos

## App ID (ya configurado)

`vpaas-magic-cookie-c935764c77244fe384665537f295395c`

## Importante: JWT de la consola ≠ clave privada

El token que muestra la consola de JaaS al hacer "Generate JWT" es un **ejemplo**.
El `kid` que termina en `SAMPLE_APP` **no** firma llamadas desde tu servidor.

Necesitás tu propio par RSA y subir la **clave pública** a JaaS.

## Pasos (una sola vez)

### 1. Clave RSA (ya generada en este repo si existe `jaasauth.key`)

Si no existe:

```powershell
cd future_nodes/nodo-clinica
ssh-keygen -t rsa -b 4096 -m PEM -f jaasauth.key
```

### 2. Exportar clave pública para subir

```powershell
node scripts/jaas-export-public-key.mjs
```

Se crea `jaas-public-upload.pem`.

### 3. Subir a 8x8

1. [jaas.8x8.vc](https://jaas.8x8.vc) → **API keys** → **Add API Key**
2. Pegar el contenido de `jaas-public-upload.pem`
3. Copiar el **Key ID** completo (ej. `vpaas-magic-cookie-c935764c.../a1b2c3`)

### 4. Variables de entorno

**Local** (`.env.local`):

```env
JAAS_API_KEY_ID=vpaas-magic-cookie-c935764c77244fe384665537f295395c/TU_KID_AQUI
JAAS_PRIVATE_KEY_PATH=./jaasauth.key
```

**Vercel** (producción): mismas variables, pero la clave privada va en `JAAS_PRIVATE_KEY` con saltos `\n`:

```env
JAAS_APP_ID=vpaas-magic-cookie-c935764c77244fe384665537f295395c
NEXT_PUBLIC_JAAS_APP_ID=vpaas-magic-cookie-c935764c77244fe384665537f295395c
JAAS_API_KEY_ID=vpaas-magic-cookie-c935764c.../TU_KID
JAAS_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
NEXT_PUBLIC_JITSI_DOMAIN=8x8.vc
```

Nunca commitear `jaasauth.key` ni pegar la clave privada en el chat.

## Verificar

```powershell
curl "http://localhost:3002/api/clinic/jitsi-token?room=test-room&displayName=Test&moderator=true" -b cookies del médico
```

Debe devolver `{ "jwt": "...", "roomName": "...", "domain": "8x8.vc" }`.
