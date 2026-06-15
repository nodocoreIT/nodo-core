import { addDays, format } from "date-fns";

const TZ = "America/Argentina/Buenos_Aires";

/**
 * Accepts a calendar ID, public embed URL, or Google iframe code.
 */
export function parseGoogleCalendarSrc(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const iframeMatch = raw.match(
    /src=["'](https?:\/\/calendar\.google\.com\/calendar\/embed[^"']+)["']/i
  );
  if (iframeMatch?.[1]) {
    return extractSrcFromEmbedUrl(iframeMatch[1]);
  }

  if (raw.includes("calendar.google.com")) {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return extractSrcFromEmbedUrl(url);
  }

  return raw;
}

function extractSrcFromEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const src = parsed.searchParams.get("src");
    return src ? decodeURIComponent(src) : null;
  } catch {
    return null;
  }
}

/** URL matching the official Google snippet (weekly view). */
export function buildGoogleCalendarWeekEmbed(calendarId: string): string {
  const src = encodeURIComponent(calendarId);
  return `https://calendar.google.com/calendar/embed?src=${src}&ctz=${encodeURIComponent(TZ)}&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0`;
}

/** Agenda view for a single day (today / tomorrow). */
export function buildGoogleCalendarDayEmbed(calendarId: string, day: Date): string {
  const src = encodeURIComponent(calendarId);
  const start = format(day, "yyyyMMdd");
  const end = format(addDays(day, 1), "yyyyMMdd");
  return `https://calendar.google.com/calendar/embed?src=${src}&ctz=${encodeURIComponent(TZ)}&mode=AGENDA&dates=${start}/${end}&showTitle=0&showNav=0&showDate=1&showPrint=0`;
}

export function googleCalendarSetupHint(): string {
  return [
    "1. Google Calendar → ⚙️ Configuración",
    "2. En la lista izquierda elegí el calendario exacto (ej. «Pela Semanales»)",
    "3. Integrar calendario → copiá «ID del calendario»",
    "   (puede ser tu@gmail.com o algo@group.calendar.google.com)",
    "4. Activá «Compartir públicamente» → Ver todos los detalles",
    "5. También podés pegar la URL del iframe o el código <iframe…>",
  ].join("\n");
}
