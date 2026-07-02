export interface SpecialtyFilter {
  id: string;
  label: string;
  match: RegExp;
}

export const SPECIALTY_FILTERS: SpecialtyFilter[] = [
  { id: "all", label: "Todos", match: /.*/ },
  {
    id: "general",
    label: "Medicina general",
    match: /general|clínica|clinica|familia|médico de cabecera/i,
  },
  { id: "cardio", label: "Cardiología", match: /cardio/i },
  { id: "gastro", label: "Gastroenterología", match: /gastro/i },
  { id: "psico", label: "Psicología", match: /psico|mental|psiquiatr/i },
  { id: "derma", label: "Dermatología", match: /derma/i },
  { id: "pediatria", label: "Pediatría", match: /pediatr/i },
];

export function doctorMatchesFilter(
  specialty: string,
  filterId: string,
): boolean {
  const filter = SPECIALTY_FILTERS.find((f) => f.id === filterId);
  if (!filter || filterId === "all") return true;
  return filter.match.test(specialty);
}
