# Mercado Pago OAuth — Clínica Virtual

Cada médico cobra con **su propia cuenta** de Mercado Pago. La app usa OAuth (Authorization code + PKCE); los tokens **nunca** se guardan en el navegador.

## 1. Crear aplicación en Mercado Pago

1. Entrá a [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app).
2. Creá una aplicación (tipo Checkout / Pagos online).
3. En **Detalles de la aplicación** → **URLs de redirección**, agregá **exactamente** (sin barra final):

   ```
   https://nodo-salud.vercel.app/api/clinic/mercadopago/oauth/callback
   ```

   Verificá la URL activa en producción:

   ```
   https://nodo-salud.vercel.app/api/clinic/mercadopago/oauth/config
   ```

   En local:

   ```
   http://localhost:3002/api/clinic/mercadopago/oauth/callback
   ```

4. (Recomendado) Activá **Authorization code con PKCE** en la app.
5. Copiá **Client ID** y **Client Secret** (credenciales de producción o prueba).

Documentación: [OAuth Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/security/oauth)

## 2. Variables de entorno

En `.env.local` o Vercel:

```env
# Obligatorias para OAuth
MERCADOPAGO_CLIENT_ID=tu_app_id
MERCADOPAGO_CLIENT_SECRET=tu_client_secret

# Opcional si NEXT_PUBLIC_APP_URL ya está bien
MERCADOPAGO_OAUTH_REDIRECT_URI=https://tu-app.vercel.app/api/clinic/mercadopago/oauth/callback

NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app

# Usar tokens de prueba al conectar (sandbox)
MERCADOPAGO_OAUTH_TEST_TOKEN=true

# QR in-store: ID de caja por defecto para pruebas
MERCADOPAGO_DEFAULT_EXTERNAL_POS_ID=EXTERNALPOS...

# Crear usuarios de prueba vía API (solo vos)
CLINIC_ADMIN_SECRET=una-clave-larga-secreta
```

## 3. Flujo del médico

1. Iniciar sesión → **Configuración** → pestaña **Cobros**.
2. Activar **Cobrar con Mercado Pago**.
3. Clic en **Conectar con Mercado Pago** → login MP → autorizar.
4. Vuelve a la app con `?tab=cobros&mp=connected`.
5. (Opcional) Configurar **ID de caja QR** (`external_pos_id`) para pruebas QR.
6. **Probar cobro QR** genera una orden de prueba con el token del médico.

## 4. Endpoints

| Ruta | Descripción |
|------|-------------|
| `GET /api/clinic/mercadopago/oauth/connect` | Redirige a MP (sesión médico) |
| `GET /api/clinic/mercadopago/oauth/callback` | Intercambia `code` → tokens |
| `POST /api/clinic/mercadopago/oauth/disconnect` | Borra tokens del médico |
| `POST /api/clinic/mercadopago/test/qr` | Orden QR de prueba |
| `GET /api/clinic/mercadopago/test/qr?orderId=` | Estado de orden |
| `POST /api/clinic/admin/users` | Crear médico/paciente (admin) |

Webhook de pagos (Checkout Pro): `/api/clinic/mercadopago/webhook`

## 5. Crear usuario de prueba (admin)

```bash
curl -X POST https://tu-app.vercel.app/api/clinic/admin/users \
  -H "Content-Type: application/json" \
  -H "x-clinic-admin-secret: TU_CLINIC_ADMIN_SECRET" \
  -d '{
    "role": "doctor",
    "fullName": "Dr. Prueba MP",
    "email": "tu-email@ejemplo.com",
    "password": "TuClaveSegura1",
    "specialty": "Clínica",
    "licenseNumber": "12345"
  }'
```

Luego: login en `/login/medico` → Cobros → Conectar MP.

Script local equivalente:

```bash
pnpm exec tsx scripts/create-clinic-user.ts doctor "Dr. Prueba" tu@mail.com TuClave
```

(Requiere `CLINIC_ADMIN_SECRET` en el entorno.)

## 6. Cobros al paciente

- **Checkout Pro** (botón azul en pedir turno): usa el Access Token OAuth del médico.
- **QR dinámico** (prueba / futuro): `POST /v1/orders` con token del médico y `external_pos_id`.

Refresh automático del token cuando vence (refresh_token guardado en `clinic.json` / Blob).

## 7. QR — tienda y caja

Para QR in-store cada médico (o vos en pruebas) necesita una **caja** en Mercado Pago:

- [Crear tienda y POS](https://www.mercadopago.com.ar/developers/es/docs/qr-code/create-store-and-pos)
- El `external_pos_id` se pega en Cobros o en `MERCADOPAGO_DEFAULT_EXTERNAL_POS_ID`.

Pruebas: [Integrar QR en ambiente de prueba](https://www.mercadopago.com.ar/developers/es/docs/qr-code/test-integration)

## 8. Webhooks (pagos aprobados)

En [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) → **Webhooks**:

| Campo | Valor |
|-------|--------|
| URL de producción | `https://nodo-salud.vercel.app/api/webhooks/mercadopago` |
| Eventos | **Pagos** |

No uses la raíz del sitio (`/`). El endpoint verifica la firma `x-signature` si configurás:

```env
MERCADOPAGO_WEBHOOK_SECRET=clave_del_panel_mp
```

Flujo: MP notifica → se consulta el pago con el token OAuth del médico → turno `pagado` → notificación en menú **Cobros** (globito rojo).

## 9. Seguridad

- Tokens y refresh solo en servidor (`local-db` / Vercel Blob).
- El PUT de configuración **no** acepta tokens desde el frontend (solo OAuth).
- PKCE en el flujo de autorización.
- `state` + sesión médico en callback.
