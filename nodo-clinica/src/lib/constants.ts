export const MEDICAL_EXAMS = [
  { id: "hemograma", name: "Hemograma completo", category: "Laboratorio" },
  { id: "glucemia", name: "Glucemia en ayunas", category: "Laboratorio" },
  { id: "perfil-lipidico", name: "Perfil lipídico", category: "Laboratorio" },
  { id: "tsh", name: "TSH / T4 libre", category: "Laboratorio" },
  { id: "creatinina", name: "Creatinina / Urea", category: "Laboratorio" },
  { id: "transaminasas", name: "Transaminasas (ALT/AST)", category: "Laboratorio" },
  { id: "orina", name: "Urocultivo y sedimento", category: "Laboratorio" },
  { id: "pcr", name: "Proteína C reactiva", category: "Laboratorio" },
  { id: "rx-torax", name: "Radiografía de tórax PA", category: "Imagenología" },
  { id: "rx-columna", name: "Radiografía de columna", category: "Imagenología" },
  { id: "eco-abdominal", name: "Ecografía abdominal", category: "Imagenología" },
  { id: "eco-tiroides", name: "Ecografía tiroidea", category: "Imagenología" },
  { id: "eco-pelvica", name: "Ecografía pélvica", category: "Imagenología" },
  { id: "tac-craneo", name: "TAC de cráneo", category: "Imagenología" },
  { id: "tac-torax", name: "TAC de tórax", category: "Imagenología" },
  { id: "rm-columna", name: "Resonancia magnética de columna", category: "Imagenología" },
  { id: "ecg", name: "Electrocardiograma", category: "Cardiología" },
  { id: "holter", name: "Holter 24 horas", category: "Cardiología" },
  { id: "ergometria", name: "Ergometría", category: "Cardiología" },
  { id: "espirometria", name: "Espirometría", category: "Neumonología" },
  { id: "endoscopia", name: "Endoscopía digestiva alta", category: "Gastroenterología" },
  { id: "colonoscopia", name: "Colonoscopía", category: "Gastroenterología" },
  { id: "mamografia", name: "Mamografía bilateral", category: "Imagenología" },
  { id: "densitometria", name: "Densitometría ósea", category: "Imagenología" },
] as const;

export const LIFECYCLE_LABELS = {
  en_espera: "En espera",
  en_consulta: "En consulta",
  finalizada: "Finalizada",
} as const;

export const LIFECYCLE_COLORS = {
  en_espera: "bg-amber-100 text-amber-800 border-amber-200",
  en_consulta: "bg-emerald-100 text-emerald-800 border-emerald-200",
  finalizada: "bg-slate-100 text-slate-600 border-slate-200",
} as const;
