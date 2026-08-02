"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy route: opens settings modal on inicio and clears this URL. */
export default function PacientePerfilRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    const query = tab ? `?settings=${encodeURIComponent(tab)}` : "?settings=perfil";
    router.replace(`/paciente/inicio${query}`);
  }, [router, searchParams]);

  return null;
}
