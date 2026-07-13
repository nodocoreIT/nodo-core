"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu, X, ChevronDown, ShoppingBag, Sun, Moon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCatalogo } from "@/context/CatalogoContext";
import { SITE_CONFIG } from "@/constants/site";
import DolarWidget from "@/components/ui/DolarWidget";

const SKINCARE_SUBITEMS: Record<string, string[]> = {
  "cuidado-facial": ["Limpieza", "Serum", "Crema", "Tratamiento", "Suncare", "Rutinas"],
  "cuidado-corporal": ["Corporales", "Manos"],
  "tipos-de-piel": ["Mixta", "Grasa", "Seca", "Normal", "Todo tipo"],
  "linea": ["Bioetape", "Semplice", "Patagonia"],
};

const BIENESTAR_SUBITEMS: Record<string, string[]> = {
  "aceites-esenciales": ["Aceites Puros Esenciales", "Aceites Cosmetológicos", "Blend"],
  "brumas-almohada": [],
  "tratamientos": [],
  "balsamos": [],
};

const AROMATIZANTES_SUBITEMS: Record<string, string[]> = {
  "aromatizantes-ambientales": ["Hogar", "Textil", "Auto"],
  "difusores": [],
  "ropa": [],
  "esenciales": [],
};

const MEGA_MENU_SUBITEMS: Record<string, string[]> = {
  ...SKINCARE_SUBITEMS,
  ...BIENESTAR_SUBITEMS,
  ...AROMATIZANTES_SUBITEMS,
};

interface NavSubcategoria {
  id: string;
  nombre: string;
  slug: string;
}

interface NavCategoria {
  id: string;
  nombre: string;
  slug: string;
  subcategorias: NavSubcategoria[];
}

interface Props {
  navCategorias: NavCategoria[];
  showCatalogo?: boolean;
  showFaq?: boolean;
  showNosotros?: boolean;
  showQuickSearch?: boolean;
  showDolarWidget?: boolean;
  logoUrl?: string;
  customerUser?: { name: string; email: string } | null;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} width="20" height="20">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function Header({ navCategorias, showCatalogo = false, showFaq = true, showNosotros = true, showQuickSearch = true, showDolarWidget = false, logoUrl, customerUser }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("site-theme") as "dark" | "light" | null;
    const initial = stored ?? (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("site-theme", next);
  }
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const { count, openDrawer } = useCart();
  const { open: openCatalogo } = useCatalogo();

  function openQuickSearch() {
    window.dispatchEvent(new Event("quick-search:open"));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    startTransition(() => {
      router.push(`/buscar?q=${encodeURIComponent(busqueda.trim())}`);
    });
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-luxury-gray">
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex items-center gap-4 lg:gap-8 pt-1 pb-6 md:pt-2 md:pb-8">
          {/* Logo */}
          <div className="shrink-0 py-2">
            <Link href="/">
              <Image
                src={logoUrl || (theme === "light" ? "/logo_transparent_light.png" : "/logo_transparent_dark.png")}
                alt="Logo"
                width={300}
                height={300}
                className="h-16 md:h-24 lg:h-32 w-auto object-contain transition-transform hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Columna derecha */}
          <div className="flex-1 flex flex-col gap-6 xl:gap-8">
            {/* Fila 1: Utilidades */}
            <div className="hidden md:flex items-center gap-4 border-b border-luxury-gray/50 pb-4">
              {/* Buscador */}
              <form onSubmit={handleSearch} className="flex-1">
                <div className="flex items-center border border-luxury-gray-mid bg-luxury-gray/30 hover:border-gold/40 focus-within:border-gold/60 transition-colors px-3 py-1.5 gap-2">
                  <Search size={13} className="text-luxury-gray-light shrink-0" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar productos..."
                    className="flex-1 bg-transparent text-white text-xs placeholder-[#555] focus:outline-none"
                  />
                </div>
              </form>

              {/* Links derecha */}
              <div className="flex items-center gap-5 shrink-0">
              <Link
                href={SITE_CONFIG.contact.phone ? `https://wa.me/${SITE_CONFIG.contact.phone}?text=${encodeURIComponent(SITE_CONFIG.contact.emprenderMsg)}` : "#"}
                target={SITE_CONFIG.contact.phone ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="text-[11px] tracking-[0.2em] text-luxury-gray-light hover:text-white transition-colors font-bold uppercase flex items-center gap-2 group"
              >
                <WhatsAppIcon className="w-3 h-3 transition-transform group-hover:scale-110" />
                Contacto
              </Link>
              {showCatalogo && (
                <button
                  onClick={openCatalogo}
                  className="text-[11px] tracking-[0.2em] text-luxury-gray-light hover:text-white transition-colors font-bold uppercase"
                >
                  Catálogo
                </button>
              )}
              {showNosotros && (
                <Link
                  href="/quienes-somos"
                  className={`text-[11px] tracking-[0.2em] transition-colors font-bold uppercase ${pathname === "/quienes-somos" ? "text-gold" : "text-luxury-gray-light hover:text-white"}`}
                >
                  Nosotros
                </Link>
              )}
              {showFaq && (
                <Link
                  href="/preguntas-frecuentes"
                  className={`text-[11px] tracking-[0.2em] transition-colors font-bold uppercase ${pathname === "/preguntas-frecuentes" ? "text-gold" : "text-luxury-gray-light hover:text-white"}`}
                >
                  Preguntas Frecuentes
                </Link>
              )}
              {customerUser ? (
                <Link
                  href="/cuenta"
                  className="text-[11px] tracking-[0.2em] text-gold hover:text-white transition-colors font-bold uppercase"
                >
                  Hola, {customerUser.name.split(" ")[0]}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-[11px] tracking-[0.2em] text-gold hover:text-white transition-colors font-bold uppercase"
                >
                  Iniciar Sesión
                </Link>
              )}
              <button
                onClick={toggleTheme}
                className="text-luxury-gray-light hover:text-gold transition-colors"
                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              {showDolarWidget && <DolarWidget />}

              {/* Carrito */}
              <button
                onClick={openDrawer}
                aria-label="Ver carrito"
                className="relative text-white hover:text-gold transition-all flex items-center gap-1.5 group"
              >
                <div className="relative">
                  <ShoppingBag size={16} className="group-hover:scale-110 transition-transform" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gold text-black text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none border-2 border-black">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] tracking-widest font-medium uppercase">Carrito</span>
              </button>
              </div>
            </div>

            {/* Fila 2: Navegación + Acciones */}
            <div className="flex items-center justify-between">
              {/* Nav Desktop */}
              <nav className="hidden lg:flex items-center gap-x-3 xl:gap-x-5">
                <Link
                  href="/"
                  className={`text-xs tracking-wider transition-colors font-bold uppercase ${pathname === "/" ? "text-gold" : "text-white hover:text-gold"}`}
                >
                  INICIO
                </Link>

                {navCategorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="relative"
                    onMouseEnter={() => setOpenDropdown(cat.id)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <Link
                      href={`/productos?categoria=${cat.slug}`}
                      className={`flex items-center gap-1 text-xs tracking-wider transition-colors font-bold uppercase ${pathname.includes(`categoria=${cat.slug}`) ? "text-gold" : "text-white hover:text-gold"}`}
                    >
                      {cat.nombre}
                      {cat.subcategorias.length > 0 && (
                        <ChevronDown size={12} className={`transition-transform ${openDropdown === cat.id ? "rotate-180" : ""}`} />
                      )}
                    </Link>

                    {openDropdown === cat.id && cat.subcategorias.length > 0 && (
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 z-50 ${cat.slug === "fragancias" || cat.subcategorias.some(s => s.slug in MEGA_MENU_SUBITEMS) ? "w-[280px]" : "w-[200px]"}`}>
                        <div className="bg-luxury-black border border-luxury-gray shadow-2xl shadow-black/80 p-5 flex flex-col gap-1">
                          {cat.subcategorias.some(s => s.slug in MEGA_MENU_SUBITEMS) ? (
                            cat.subcategorias.map((sub) => {
                              const subitems = MEGA_MENU_SUBITEMS[sub.slug] ?? [];
                              return (
                                <div key={sub.id} className="mt-1">
                                  <Link
                                    href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}`}
                                    className="block text-white font-serif font-light text-[15px] border-b border-luxury-gray-mid pb-1 mb-2 hover:text-(--color-gold) transition-colors"
                                  >
                                    {sub.nombre}
                                  </Link>
                                  {subitems.map((item) => (
                                    <Link
                                      key={item}
                                      href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}&tipo=${encodeURIComponent(item.toLowerCase())}`}
                                      className="block text-sm font-serif font-light text-[#cccccc] hover:text-gold transition-colors py-1 pl-2"
                                    >
                                      {item}
                                    </Link>
                                  ))}
                                </div>
                              );
                            })
                          ) : (
                            cat.subcategorias.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}`}
                                className="text-white font-serif font-light text-[15px] border-b border-luxury-gray-mid pb-1 hover:text-(--color-gold) transition-colors block"
                              >
                                {sub.nombre}
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </nav>

              {/* Acciones mobile */}
              <div className="flex lg:hidden flex-1 justify-end items-center gap-4">
                <button
                  onClick={openDrawer}
                  aria-label="Ver carrito"
                  className="relative text-white hover:text-gold transition-all p-1"
                >
                  <div className="relative">
                    <ShoppingBag size={20} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-gold text-black text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none border-2 border-black">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={toggleTheme}
                  className="text-luxury-gray-light hover:text-gold transition-colors"
                  aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
                >
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  className="text-white hover:text-gold transition-colors"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Menú"
                >
                  {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="lg:hidden bg-luxury-black border-t border-luxury-gray px-4 py-6">
          <nav className="flex flex-col gap-4">
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm tracking-wider text-white hover:text-gold transition-colors">
              INICIO
            </Link>

            {navCategorias.map((cat) => (
              <div key={cat.id} className="border-t border-luxury-gray-mid pt-4">
                <Link
                  href={`/productos?categoria=${cat.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="text-gold text-xs tracking-widest mb-3 uppercase font-bold block"
                >
                  {cat.nombre}
                </Link>
                {cat.subcategorias.length > 0 && (
                  <div className="flex flex-col gap-1 pl-2">
                    {cat.subcategorias.some(s => s.slug in MEGA_MENU_SUBITEMS) ? (
                      cat.subcategorias.map((sub) => {
                        const subitems = MEGA_MENU_SUBITEMS[sub.slug] ?? [];
                        return (
                          <div key={sub.id} className="mt-2">
                            <Link
                              href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}`}
                              onClick={() => setMenuOpen(false)}
                              className="block text-white font-serif font-light text-[15px] border-b border-luxury-gray-mid pb-1 mb-1 hover:text-(--color-gold) transition-colors"
                            >
                              {sub.nombre}
                            </Link>
                            {subitems.map((item) => (
                              <Link
                                key={item}
                                href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}&tipo=${encodeURIComponent(item.toLowerCase())}`}
                                onClick={() => setMenuOpen(false)}
                                className="block font-serif font-light text-sm text-[#cccccc] hover:text-gold py-0.5 pl-2 transition-colors"
                              >
                                {item}
                              </Link>
                            ))}
                          </div>
                        );
                      })
                    ) : (
                      cat.subcategorias.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/productos?categoria=${cat.slug}&subcategoria=${sub.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="block font-serif font-light text-[15px] text-white hover:text-(--color-gold) py-1 transition-colors"
                        >
                          {sub.nombre}
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}

            {showCatalogo && (
              <button
                onClick={() => { setMenuOpen(false); openCatalogo(); }}
                className="text-sm tracking-wider text-white hover:text-gold transition-colors text-left border-t border-luxury-gray-mid pt-4"
              >
                CATÁLOGO
              </button>
            )}
            {showNosotros && (
              <Link
                href="/quienes-somos"
                onClick={() => setMenuOpen(false)}
                className={`text-sm tracking-wider transition-colors ${pathname === "/quienes-somos" ? "text-gold" : "text-white hover:text-gold"}`}
              >
                NOSOTROS
              </Link>
            )}
            {showFaq && (
              <Link
                href="/preguntas-frecuentes"
                onClick={() => setMenuOpen(false)}
                className={`text-sm tracking-wider transition-colors ${pathname === "/preguntas-frecuentes" ? "text-gold" : "text-white hover:text-gold"}`}
              >
                FAQ
              </Link>
            )}
            {customerUser ? (
              <Link
                href="/cuenta"
                onClick={() => setMenuOpen(false)}
                className="text-sm tracking-wider text-gold font-bold transition-colors"
              >
                HOLA, {customerUser.name.split(" ")[0].toUpperCase()}
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-sm tracking-wider text-gold font-bold transition-colors"
              >
                INICIAR SESIÓN
              </Link>
            )}

            <div className="border-t border-luxury-gray-mid pt-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 bg-luxury-gray border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
                <button type="submit" className="px-3 py-2 bg-gold text-black">
                  <Search size={16} />
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
