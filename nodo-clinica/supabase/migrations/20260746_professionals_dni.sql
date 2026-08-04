-- DNI del médico, capturado en el onboarding. Sin unique constraint (a
-- diferencia de patients.dni) para no bloquear el flujo con validación de
-- duplicados que todavía no se pidió.

alter table nodo_clinica.professionals
  add column if not exists dni text;
