export type BannerConfig = {
  title?: string;
  subtitle?: string;
  image_url?: string;
  cta_label?: string;
  cta_url?: string;
};

export function BannerSection({
  config,
  slug,
}: {
  config: BannerConfig;
  slug: string;
}) {
  return (
    <section
      className="relative rounded-2xl overflow-hidden min-h-[240px] flex items-center justify-center text-center px-8 py-12"
      style={
        config.image_url
          ? {
              backgroundImage: `url(${config.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "var(--store-secondary)" }
      }
    >
      {/* Overlay when image is present */}
      {config.image_url && (
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      )}

      <div className="relative z-10 text-white max-w-xl">
        {config.title && (
          <h2 className="text-3xl font-bold mb-3">{config.title}</h2>
        )}
        {config.subtitle && (
          <p className="text-lg opacity-90 mb-6">{config.subtitle}</p>
        )}
        {config.cta_label && (
          <a
            href={config.cta_url ?? `/${slug}/catalog`}
            className="inline-block bg-white font-semibold px-7 py-3 rounded-full hover:opacity-90 transition"
            style={{ color: "var(--store-primary)" }}
          >
            {config.cta_label}
          </a>
        )}
      </div>
    </section>
  );
}
