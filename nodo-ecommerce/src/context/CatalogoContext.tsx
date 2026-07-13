"use client";

import { createContext, useContext, useState } from "react";

interface CatalogoContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CatalogoContext = createContext<CatalogoContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function CatalogoProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <CatalogoContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </CatalogoContext.Provider>
  );
}

export const useCatalogo = () => useContext(CatalogoContext);
