import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/checkout");
  }

  return (
    <Suspense>
      <CheckoutClient />
    </Suspense>
  );
}
