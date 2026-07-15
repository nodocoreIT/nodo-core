import Link from "next/link";
import Image from "next/image";
import { Producto } from "@/types";
import NoImagePlaceholder from "@/components/ui/NoImagePlaceholder";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { calculateListPrice, calculateInstallment, formatPrice } from "@/lib/price-utils";
import PrecioUSD from "@/components/productos/PrecioUSD";

interface Props {
  producto: Producto;
  isCompact?: boolean;
  priority?: boolean;
  dolarEnabled?: boolean;
}

export default function ProductoCard({ producto, isCompact = false, priority = false, dolarEnabled = false }: Props) {

  if (isCompact) {
    return (
      <article className="group relative bg-luxury-black border border-zinc-700 hover:border-gold/50 transition-all duration-300 hover:shadow-lg flex flex-col overflow-hidden">
        <Link href={`/productos/${producto.slug}`} className="product-image-frame block relative aspect-square bg-[#111111]">
          {producto.imagen_url ? (
            <Image
              src={producto.imagen_url}
              alt={`Producto ${producto.nombre} ${producto.marca}`}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 15vw"
              className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <NoImagePlaceholder fill sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 15vw" className="object-contain p-3" width={0} height={0} />
          )}
          
          {/* Minimal Badges for Compact View */}
          <div className="absolute top-1 left-1 flex flex-col gap-0.5">
            {producto.nuevo && (
              <div className="w-2 h-2 rounded-full bg-gold" title="Nuevo" />
            )}
            {producto.stock === 0 && (
              <div className="w-2 h-2 rounded-full bg-gray-300" title="Sin stock" />
            )}
          </div>

          {/* Hover Name Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
            <p className="text-white text-[10px] font-medium leading-tight line-clamp-2">
              {producto.nombre}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group bg-luxury-black border border-zinc-700 hover:border-gold/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 flex flex-col h-full">
      {/* Image */}
      <Link href={`/productos/${producto.slug}`} className="product-image-frame block relative overflow-hidden aspect-square bg-[#111111]">
        {producto.imagen_url ? (
          <Image
            src={producto.imagen_url}
            alt={`Producto ${producto.nombre} ${producto.marca}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <NoImagePlaceholder fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-4" width={0} height={0} />
        )}

        {/* Badges — top left: Nuevo / Destacado only */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {producto.nuevo && (
            <span className="bg-gold text-black text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase">
              Nuevo
            </span>
          )}
          {producto.destacado && !producto.nuevo && (
            <span className="bg-luxury-gray border border-gold/50 text-gold text-[9px] font-bold tracking-wider px-2 py-0.5 uppercase">
              Destacado
            </span>
          )}
        </div>

        {/* Sin stock badge — bottom, full width */}
        {producto.stock === 0 && (
          <div className="absolute bottom-0 left-0 right-0">
            <span className="block w-full bg-black/70 text-amber-400 text-[9px] font-bold tracking-wider px-2 py-1.5 uppercase text-center backdrop-blur-sm">
              Se trae por pedido
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/productos/${producto.slug}`}>
          <p className="text-zinc-400 text-xs tracking-[0.2em] uppercase mb-1">
            {producto.marca}
          </p>
          <h3 className="text-white font-product text-base leading-snug group-hover:text-gold transition-colors line-clamp-2">
            {producto.nombre}
          </h3>
        </Link>

        <div className="mt-auto pt-4">
          <div className="mb-3 flex flex-col">
            {dolarEnabled ? (
              <PrecioUSD precioUsd={producto.precio_venta} />
            ) : (
              <>
                <span className="text-gray-400 text-[10px] uppercase tracking-wider">
                  Precio de lista: {formatPrice(calculateListPrice(producto.precio_venta))}
                </span>
                <span className="text-gray-600 text-xs font-medium">
                  3 cuotas sin interés de {formatPrice(calculateInstallment(producto.precio_venta))}
                </span>
                <div className="mt-1">
                  <span className="text-white font-bold text-xl">
                    {formatPrice(producto.precio_venta)}
                  </span>
                  <span className="text-gold text-[10px] font-bold ml-1 uppercase tracking-tight">
                    Contado / Transferencia
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
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
              variant="card"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
