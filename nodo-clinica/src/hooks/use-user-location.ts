"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Coords } from "@/lib/geo";

export function useUserLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("No pudimos acceder a tu ubicación. Revisá los permisos del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return { coords, locating, locate };
}
