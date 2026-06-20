"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-store";

export function CartIcon({ slug }: { slug: string }) {
  const count = useCart((s) => s.itemCount());
  return (
    <a
      href={`/${slug}/cart`}
      className="relative p-2 rounded-lg hover:bg-slate-100 transition"
    >
      <ShoppingCart className="w-5 h-5 text-slate-600" />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px] font-bold"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </a>
  );
}
