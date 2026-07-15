import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { createClient } from "@/lib/supabase/server";
import { Producto } from "@/types";
import { ChevronRight, MapPin } from "lucide-react";
import InstagramIcon from "@/components/ui/InstagramIcon";
import AddToCartButton from "@/components/cart/AddToCartButton";
import ProductoGaleria from "@/components/productos/ProductoGaleria";
import { formatPrice } from "@/lib/price-utils";
import PrecioDetalleBlock from "@/components/productos/PrecioDetalleBlock";
import SimuladorCuotas from "@/components/productos/SimuladorCuotas";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProducto(slug: string): Promise<Producto | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("productos")
      .select(`*`)
      .eq("slug", slug)
      .eq("activo", true)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      notas: [],
      categoria: data.categoria || "Fragancias",
    } as Producto;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const producto = await getProducto(slug);

  if (!producto) {
    return { title: "Producto no encontrado" };
  }

  const titulo =
    producto.meta_titulo ||
    `Producto ${producto.nombre} ${producto.marca} | Mi Tienda`;
  const descripcion =
    producto.meta_descripcion ||
    `Comprá ${producto.nombre} de ${producto.marca} en Mi Tienda. ${producto.descripcion_corta || ""} Envío gratis.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/productos/${slug}` },
    openGraph: {
      title: titulo,
      description: descripcion,
      images: producto.imagen_url ? [{ url: producto.imagen_url }] : [],
      type: "website",
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { slug } = await params;
  const producto = await getProducto(slug);

  if (!producto) notFound();

  const whatsappMsg = encodeURIComponent(
    `Hola! Me interesa el producto *${producto.nombre}* de *${producto.marca}*. ¿Tienen stock disponible?`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  // JSON-LD Product schema
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${producto.nombre} - ${producto.marca}`,
    description: producto.descripcion,
    image: producto.imagen_url || undefined,
    brand: {
      "@type": "Brand",
      name: producto.marca,
    },
    offers: {
      "@type": "Offer",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/productos/${slug}`,
      priceCurrency: "ARS",
      price: producto.precio_venta.toString(),
      availability:
        producto.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "LocalBusiness",
        name: "Mi Tienda",
      },
    },
  };

  return (
    <>
      <Script
        id={`ld-json-product-${producto.id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/" className="hover:text-gold transition-colors">Inicio</Link>
          <ChevronRight size={12} />
          <Link href="/productos" className="hover:text-gold transition-colors">Catálogo</Link>
          <ChevronRight size={12} />
          <span className="text-gray-500 truncate max-w-[200px]">{producto.nombre}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          {/* Galería */}
          <ProductoGaleria
            imagenPrincipal={producto.imagen_url}
            imagenesAdicionales={producto.imagenes_adicionales}
            nombre={producto.nombre}
            marca={producto.marca}
            nuevo={producto.nuevo}
          />

          {/* Info */}
          <div className="flex flex-col">
            <p className="text-gold text-xs tracking-[0.3em] uppercase mb-2">
              {producto.marca}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl text-white mb-1 leading-tight">
              {producto.nombre}
            </h1>
            <PrecioDetalleBlock precioVenta={producto.precio_venta} moneda={producto.moneda} />
            <SimuladorCuotas precioVenta={producto.precio_venta} moneda={producto.moneda} />

            {/* Stock / Disponibilidad */}
            <div className="mb-6 flex flex-col gap-2">
              {producto.pedido ? (
                <span className="flex items-center gap-1.5 text-amber-400 text-sm">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  Este producto se trae por pedido — demora 48hs.
                </span>
              ) : producto.stock > 0 ? (
                <span className="flex items-center gap-1.5 text-green-600 text-sm">
                  <span className="w-2 h-2 bg-green-600 rounded-full" />
                  En stock ({producto.stock} disponibles)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Sin stock
                </span>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <AddToCartButton
                item={{
                  id: producto.id,
                  nombre: producto.nombre,
                  marca: producto.marca,
                  slug: producto.slug,
                  precio_venta: producto.precio_venta,
                  imagen_url: producto.imagen_url,
                }}
                inStock={producto.stock > 0}
                variant="page"
              />
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="compra-whatsapp"
                data-umami-event-producto={producto.nombre}
                className="flex items-center justify-center gap-2 border border-gold/40 text-gold font-semibold px-4 py-3.5 text-sm hover:bg-gold/10 transition-colors flex-1 whitespace-nowrap"
              >
                <img src="/what.png" alt="WhatsApp" className="w-5 h-5 rounded-full object-cover" />
                Consultar
              </a>
            </div>

            {/* Local info */}
            {!producto.pedido && (
              <div className="border-t border-gray-100 pt-4 flex items-start gap-2 text-gray-400 text-xs">
                <MapPin size={12} className="mt-0.5 text-gold shrink-0" />
                <span>
                  Disponible en tienda física
                  {" · "}
                  <span className="text-gold">Envío gratis</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Descripción */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="font-serif text-2xl text-white mb-4">Descripción</h2>
            <p className="text-luxury-gray-light leading-relaxed">{producto.descripcion}</p>
          </div>

        </div>
      </div>
    </>
  );
}
