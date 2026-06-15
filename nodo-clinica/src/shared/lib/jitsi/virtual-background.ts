export const CONSULTORIO_BG_PATH = "/backgrounds/consultorio.svg";

export function consultorioBackgroundUrl(): string {
  return `${window.location.origin}${CONSULTORIO_BG_PATH}`;
}

/** Converts an image URL to a data URL for Jitsi's setVirtualBackground. */
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
