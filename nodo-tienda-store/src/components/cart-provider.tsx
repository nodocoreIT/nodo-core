"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const setStoreSlug = useCart((s) => s.setStoreSlug);
  useEffect(() => {
    setStoreSlug(slug);
  }, [slug, setStoreSlug]);
  return <>{children}</>;
}
