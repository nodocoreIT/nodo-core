export const CONSULTORIO_BG_PATH = "/backgrounds/consultorio.svg";

export function consultorioBackgroundUrl(): string {
  if (typeof window === "undefined") return CONSULTORIO_BG_PATH;
  return `${window.location.origin}${CONSULTORIO_BG_PATH}`;
}

/** Convierte imagen URL a data URL para setVirtualBackground de Jitsi. */
export async function imageUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
