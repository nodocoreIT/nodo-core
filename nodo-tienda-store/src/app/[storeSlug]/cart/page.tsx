"use client";

import { useCart } from "@/lib/cart-store";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useParams } from "next/navigation";

export default function CartPage() {
  const params = useParams<{ storeSlug: string }>();
  const storeSlug = params.storeSlug;
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Tu carrito está vacío
        </h1>
        <p className="text-slate-500 mb-8">Agregá productos para continuar.</p>
        <a
          href={`/${storeSlug}/catalog`}
          className="inline-block font-semibold px-8 py-3 rounded-xl text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          Ver catálogo
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Tu carrito</h1>
      <div className="grid md:grid-cols-3 gap-8">
        {/* Items list */}
        <div className="md:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId}`}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              {/* Thumbnail */}
              <div className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 overflow-hidden">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl">
                    📦
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">
                  {item.name}
                </p>
                {item.variantLabel && (
                  <p className="text-sm text-slate-500">{item.variantLabel}</p>
                )}
                <p
                  className="mt-1 font-bold"
                  style={{ color: "var(--store-primary)" }}
                >
                  {formatPrice(item.price)}
                </p>
              </div>
              {/* Quantity + remove */}
              <div className="flex flex-col items-end justify-between">
                <button
                  onClick={() => removeItem(item.productId, item.variantId)}
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                  <button
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.variantId,
                        item.quantity - 1,
                      )
                    }
                    className="text-slate-500 hover:text-slate-800 transition"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.variantId,
                        item.quantity + 1,
                      )
                    }
                    className="text-slate-500 hover:text-slate-800 transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="md:col-span-1">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Resumen</h2>
            <div className="space-y-2 text-sm">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="flex justify-between text-slate-600"
                >
                  <span className="truncate mr-2">
                    {item.name} ×{item.quantity}
                  </span>
                  <span className="shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-800">
              <span>Total</span>
              <span>{formatPrice(total())}</span>
            </div>
            <a
              href={`/${storeSlug}/checkout`}
              className="block w-full text-center font-semibold py-3 rounded-xl text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              Finalizar compra
            </a>
            <button
              onClick={clearCart}
              className="block w-full text-center text-sm text-slate-400 hover:text-red-500 transition"
            >
              Vaciar carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
