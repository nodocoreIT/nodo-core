function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type PublicPropertyOg = {
  address?: string;
  operation?: string;
  property_type?: string;
  sale_price?: number | null;
  currency?: string;
  localidad?: string | null;
  provincia?: string | null;
  description?: string | null;
  photo_urls?: string[];
  agency?: { legal_name?: string | null } | null;
};

const TYPE_LABELS: Record<string, string> = {
  apartment: "Departamento",
  house: "Casa",
  commercial: "Local comercial",
  land: "Terreno",
  other: "Otro",
};

const OP_LABELS: Record<string, string> = {
  rent: "Alquiler",
  sale: "Venta",
};

function formatPrice(price: number | null | undefined, currency: string | undefined): string {
  if (price == null) return "Consultar";
  const symbol = currency === "USD" ? "USD " : "$ ";
  return `${symbol}${price.toLocaleString("es-AR")}`;
}

export function buildPublicPropertyOgTags(property: PublicPropertyOg, pageUrl: string): string {
  const type = TYPE_LABELS[property.property_type ?? ""] ?? "Propiedad";
  const op = OP_LABELS[property.operation ?? ""] ?? "publicación";
  const address = property.address ?? "";
  const title = `${type} en ${op} · ${address}`;
  const location = [property.localidad, property.provincia].filter(Boolean).join(", ");
  const price = formatPrice(property.sale_price, property.currency);
  const agency = property.agency?.legal_name ?? "Nodo Inmo";
  const description = [price, location, property.description?.slice(0, 160)]
    .filter(Boolean)
    .join(" · ");
  const image = property.photo_urls?.[0];

  const tags = [
    `<title>${escapeHtml(`${title} · ${agency}`)}</title>`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }
  return tags.join("\n    ");
}

export function injectPublicPropertyOg(html: string, tags: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace("</head>", `    ${tags}\n  </head>`);
}
