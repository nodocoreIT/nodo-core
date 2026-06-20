"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/lib/cart-store";

interface AddToCartButtonProps {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantLabel: string | null;
  price: number;
  imageUrl: string | null;
}

export function AddToCartButton(props: AddToCartButtonProps) {
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem({
      productId: props.productId,
      variantId: props.variantId,
      slug: props.slug,
      name: props.name,
      variantLabel: props.variantLabel,
      price: props.price,
      imageUrl: props.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleAdd}
      className="w-full flex items-center justify-center gap-2 font-semibold py-4 px-8 rounded-xl text-white transition"
      style={{
        backgroundColor: added ? "#22c55e" : "var(--store-primary)",
      }}
    >
      {added ? (
        <>
          <Check className="w-5 h-5" />
          Agregado
        </>
      ) : (
        <>
          <ShoppingCart className="w-5 h-5" />
          Agregar al carrito
        </>
      )}
    </button>
  );
}
