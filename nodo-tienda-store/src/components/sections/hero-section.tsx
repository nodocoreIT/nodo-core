export type HeroConfig = {
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_url?: string;
  bg_color?: string;
};

export function HeroSection({
  config,
  slug,
  primaryColor,
}: {
  config: HeroConfig;
  slug: string;
  primaryColor: string;
}) {
  const bgColor = config.bg_color ?? primaryColor;

  return (
    <section
      className="rounded-2xl p-12 text-white text-center mb-12"
      style={{
        background: `linear-gradient(135deg, ${bgColor}ee, ${bgColor}99)`,
      }}
    >
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        {config.title ?? "Bienvenido"}
      </h1>
      {config.subtitle && (
        <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
          {config.subtitle}
        </p>
      )}
      {config.cta_label && (
        <a
          href={config.cta_url ?? `/${slug}/catalog`}
          className="inline-block bg-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition"
          style={{ color: bgColor }}
        >
          {config.cta_label}
        </a>
      )}
    </section>
  );
}
