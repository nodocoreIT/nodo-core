"use client";

import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { useCart, CartItem } from "@/context/CartContext";

interface Props {
  item: Omit<CartItem, "cantidad">;
  inStock: boolean;
  variant?: "card" | "page";
}

export default function AddToCartButton({ item, inStock, variant = "card" }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (added) return;
    addItem({ ...item, por_pedido: !inStock });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  if (variant === "page") {
    return (
      <button
        onClick={handleAdd}
        data-umami-event={inStock ? "agregar-al-carrito" : "pedido-carrito"}
        data-umami-event-producto={item.nombre}
        className={`flex items-center justify-center gap-2 font-bold px-4 py-3.5 tracking-wider text-sm uppercase transition-all duration-200 flex-1 whitespace-nowrap cursor-pointer ${
          added
            ? "bg-green-600 text-white"
            : "bg-gold text-black hover:bg-gold-light"
        }`}
      >
        {added ? (
          <><Check size={18} />Agregado</>
        ) : (
          <><ShoppingBag size={18} />Agregar al carrito</>
        )}
      </button>
    );
  }

  // Card variant
  return (
    <button
      onClick={handleAdd}
      data-umami-event={inStock ? "agregar-al-carrito" : "pedido-carrito"}
      data-umami-event-producto={item.nombre}
      title={inStock ? "Agregar al carrito" : "Agregar por pedido"}
      className={`flex flex-1 items-center justify-center gap-1.5 text-xs px-2 py-2 border transition-all duration-200 whitespace-nowrap cursor-pointer ${
        added
          ? "border-green-500/50 bg-green-500/10 text-green-400"
          : "bg-gold border-gold text-black hover:bg-gold-light hover:border-gold-light"
      }`}
    >
      {added ? (
        <><Check size={13} /><span className="hidden sm:inline">Listo</span></>
      ) : (
        <><ShoppingBag size={13} /><span className="hidden sm:inline">Agregar</span></>
      )}
    </button>
  );
}
