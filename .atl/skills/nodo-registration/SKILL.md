---
name: nodo-registration
description: >-
  Regla de oro para registro self-service en nodos del ecosistema nodocore.
  Aplicar al crear o modificar formularios de registro, submitNodeRegistration,
  verify-registration, onboarding o flujos de alta de usuarios en landing/nodos.
trigger: registro, registration, signup, alta usuario, crear cuenta, register form
scope: project
---

# Nodo Registration — Regla de oro

## Regla de oro

**En el registro público de cualquier nodo, el formulario solo pide:**

1. **Nombre completo**
2. **Correo electrónico**

**No pedir contraseña en el signup.** La contraseña se define después, cuando el usuario activa la cuenta (correo de verificación → onboarding / habilitación admin → flujo de contraseña inicial o recovery).

## Implementación en nodocore

| Capa | Qué hacer |
|------|-----------|
| **UI** (`nodo-landing/app/[nodeSlug]/login/page.tsx`) | Formulario simple (Inmo, Autos, Finanzas, …): solo nombre + email. Sin campo `password` en `authMode === "register"`. |
| **Server action** | `submitNodeRegistration({ unitCode, fullName, email, plan, origin })` — **sin** `password`. |
| **pending_registrations** | `password` queda `null` en el alta; opcional solo para legacy (ej. paciente clínica self-service). |
| **Post-verificación** | Negocio: `pending_onboarding` → admin habilita → mail de activación → `/onboarding` (contraseña ahí). Self-service legacy: provision con password solo si ya existía en pending. |

## Nodos de referencia (patrón correcto)

- **Inmo** — nombre + email → verificación → revisión/habilitación → onboarding con contraseña
- **Autos** — igual que Inmo
- **Finanzas** — igual que Inmo/Autos (no self-service con password en signup)

## Anti-patrones (no hacer)

- Campo contraseña en registro de Finanzas, Inmo o Autos
- `password: isFinanzasNode ? password : undefined` en `submitNodeRegistration`
- Marcar Finanzas como `selfServicePlans: ["finanzas"]` solo para pedir password en el alta
- Duplicar lógica de registro por nodo; usar siempre `submitNodeRegistration`

## Checklist al tocar registro

- [ ] Formulario de registro: solo nombre completo + email (salvo excepción documentada y aprobada)
- [ ] Texto de ayuda: verificación por mail; contraseña después de habilitación
- [ ] `submitNodeRegistration` sin password para nodos de negocio
- [ ] `node-config.ts`: Finanzas/Inmo/Autos **no** en `selfServicePlans` por password en signup
- [ ] Probar flujo: registrar → mail → verificar → onboarding/habilitación → definir contraseña

## Referencias

- `docs/unified-registration-flow.md`
- `nodo-landing/app/actions/registration.ts` → `submitNodeRegistration`
- `nodo-landing/lib/registration/node-config.ts`
- `.atl/skills/nodo-scaffold/SKILL.md` (scaffold general)
