import { useEffect, useState } from "react";

export function PublicPropertyMap({ query }: { query: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          features?: { geometry?: { coordinates?: number[] } }[];
        };
        const coords = json.features?.[0]?.geometry?.coordinates;
        if (!coords || coords.length < 2 || cancelled) return;
        const [lon, lat] = coords;
        const pad = 0.008;
        setSrc(
          `https://www.openstreetmap.org/export/embed.html?bbox=${lon - pad}%2C${lat - pad}%2C${lon + pad}%2C${lat + pad}&layer=mapnik&marker=${lat}%2C${lon}`,
        );
      } catch {
        /* ponytail: map is decorative; a search link remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const osmSearch = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-mist bg-mist/40">
      {src ? (
        <iframe title="Ubicación" src={src} className="h-64 w-full border-0 sm:h-80" loading="lazy" />
      ) : (
        <a
          href={osmSearch}
          target="_blank"
          rel="noreferrer"
          className="flex h-48 items-center justify-center text-sm font-medium text-navy underline-offset-2 hover:underline"
        >
          Ver ubicación en el mapa
        </a>
      )}
    </div>
  );
}
