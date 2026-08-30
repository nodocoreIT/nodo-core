# LOAD TEST PLAN — Nodo Clínica

**Fecha:** 2026-08-29 · Plan (no ejecutado). Herramienta: **k6**. **No ejecutar carga destructiva contra producción** — usar un proyecto/branch de staging con datos sintéticos.

## Perfil de carga

| Etapa | VUs | Duración | Objetivo |
| ----- | --- | -------- | -------- |
| Smoke | 1-5 | 2 min | Validar scripts |
| Baseline | 10 | 5 min | Métricas de referencia |
| Normal | 25 | 10 min | Uso esperado inicial |
| Peak | 50 | 10 min | Pico razonable |
| Stress | 100 | 10 min | Punto de degradación |
| Break | 250 | 5 min | Encontrar el límite |

## Flujos a simular (peso)

- Login (15%) · Dashboard médico (20%) · Búsqueda de médicos (15%) · Reserva de turno (15%) · Agenda (10%) · Historia clínica (10%) · Cobros (5%) · Sala de espera / realtime (10%).

## Métricas y umbrales (SLO propuestos)

| Métrica | Umbral |
| ------- | ------ |
| p50 latencia | < 300 ms |
| p95 latencia | < 800 ms |
| p99 latencia | < 1500 ms |
| error rate | < 1% |
| DB connections | sin saturar el pool de Supabase |
| CPU / memoria DB | < 80% sostenido |
| Egress | monitorear (ver polling 3 s FE-001) |
| Realtime | conexiones estables sin drop |

## Consideración crítica antes de load test

El polling de 3 s del consultorio (FE-001) + los timers del layout médico (NET-002) hacen que **cada médico activo genere carga constante** independientemente de la acción. El load test debe modelar sesiones médicas *sostenidas* (no sólo requests puntuales) para estimar el egress/DB real. Corregir FE-001 antes probablemente cambie el perfil de carga de forma significativa.

## Esqueleto k6 (referencia, no ejecutar aquí)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 25 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // 1) login (obtener cookie de sesión de staging)
  // 2) GET /api/clinic/appointments?doctorId=...  (agenda)
  // 3) GET /api/clinic/doctors (búsqueda)
  const res = http.get(`${__ENV.BASE_URL}/api/clinic/health`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

> Nota: modelar la sesión médica con un VU de larga duración que mantenga el polling del consultorio para capturar el costo real de FE-001.
