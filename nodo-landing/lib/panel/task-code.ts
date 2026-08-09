/**
 * Task title convention for the panel kanban:
 *   `{PREFIX}-{NN}-{SLUG}` e.g. `IN-01-ANALIZAR-PDF`, `IT-03-FIX-LOGIN`, `OB-12-AVANCE-OBRA`
 *
 * Prefix is per unit_code; NN auto-increments from existing titles of that unit.
 */

const UNIT_TASK_PREFIX: Record<string, string> = {
  core: "CO",
  inmo: "IN",
  obra: "OB",
  capital: "CA",
  it: "IT",
  legal: "LE",
  seguros: "SE",
  agro: "AG",
  salud: "SA",
  clinica: "CL",
  "clínica": "CL",
  contable: "CT",
  dashboard: "DA",
  landing: "LA",
  // Finanzas / Ecommerce / Autos are IT satellites — not standalone task units
};

/** Resolve the short code used in task titles for a unit (IN, IT, OB, …). */
export function getTaskPrefixForUnit(unitCode: string): string {
  const key = unitCode.trim().toLowerCase();
  if (UNIT_TASK_PREFIX[key]) return UNIT_TASK_PREFIX[key];

  // Fallback: first 2 alphanumeric chars of the unit code
  const letters = key.replace(/[^a-z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 2) || "TK").toUpperCase();
}

/** Uppercase slug for the free-text part of the coded title. */
export function slugifyTaskTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * True when `title` already follows `{PREFIX}-{NN}-…` for this unit —
 * avoid double-prefixing if the user typed the code themselves.
 */
export function titleHasTaskCode(title: string, unitCode: string): boolean {
  const prefix = getTaskPrefixForUnit(unitCode);
  return new RegExp(`^${prefix}-\\d+-`, "i").test(title.trim());
}

/** Next sequential number for this unit based on existing coded titles. */
export function nextTaskSequence(
  existingTitles: readonly string[],
  unitCode: string,
): number {
  const prefix = getTaskPrefixForUnit(unitCode);
  const re = new RegExp(`^${prefix}-(\\d+)-`, "i");
  let max = 0;
  for (const title of existingTitles) {
    const match = title.trim().match(re);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Build `PREFIX-NN-SLUG` for a new task. If the title is already coded for
 * this unit, returns it unchanged (trimmed).
 */
export function buildCodedTaskTitle(
  unitCode: string,
  rawTitle: string,
  existingTitles: readonly string[],
): string {
  const trimmed = rawTitle.trim();
  if (!trimmed) return trimmed;
  if (titleHasTaskCode(trimmed, unitCode)) return trimmed;

  const prefix = getTaskPrefixForUnit(unitCode);
  const seq = nextTaskSequence(existingTitles, unitCode);
  const nn = String(seq).padStart(2, "0");
  const slug = slugifyTaskTitle(trimmed) || "TAREA";
  return `${prefix}-${nn}-${slug}`;
}

/**
 * Git-branch-friendly slug for a task: `{PREFIX}-{SLUG}` e.g. `IN-CAMBIAR-TITULO-UNO`.
 * If the title already carries its task code (editing an existing task, whose
 * title is already `CL-01-PRUEBA-TRES`), slugify it as-is instead of
 * prepending the prefix again.
 */
export function buildTaskBranchName(unitCode: string, rawTitle: string): string {
  const trimmed = rawTitle.trim();
  if (titleHasTaskCode(trimmed, unitCode)) {
    return slugifyTaskTitle(trimmed);
  }
  const prefix = getTaskPrefixForUnit(unitCode);
  const slug = slugifyTaskTitle(trimmed);
  return slug ? `${prefix}-${slug}` : prefix;
}

/** True when most letters are uppercase (e.g. pasted ALL CAPS). */
function isMostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 3) return false;
  const upperCount = (letters.match(/\p{Lu}/gu) ?? []).length;
  return upperCount / letters.length >= 0.75;
}

/**
 * Normalize a task description: if it's mostly ALL CAPS, convert to sentence
 * case (lowercase + capital letter at the start and after `.` `!` `?`).
 * Mixed-case text is left as-is.
 */
export function formatTaskDescription(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (!isMostlyUppercase(trimmed)) return trimmed;

  const lower = trimmed.toLocaleLowerCase("es");
  return lower.replace(
    /(^|[.!?…]\s+|\n+\s*)(\p{L})/gu,
    (_match, boundary: string, letter: string) =>
      boundary + letter.toLocaleUpperCase("es"),
  );
}
