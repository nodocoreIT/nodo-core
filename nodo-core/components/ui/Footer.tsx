"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

// Brand glyphs (lucide-react no longer ships brand icons). fill=currentColor so
// they inherit text color and respond to hover.
function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/nodo.core",
    Icon: InstagramIcon,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@NodoCore",
    Icon: YoutubeIcon,
  },
];

const ecosystemLinks = ["Inmo", "Obra", "Capital", "IT", "Contable"];
const companyLinks = [
  { label: "Filosofía", id: "filosofia" },
  { label: "Unidades", id: "unidades" },
  { label: "Beneficios", id: "beneficios" },
  { label: "Contacto", id: "contacto" },
];
const accessLinks = [
  { label: "Ingreso clientes", href: "/login" },
  { label: "Panel administración", href: "/login" },
];

const colHeaderClass =
  "block text-[13px] font-bold uppercase tracking-[.1em] mb-5 text-slate2-300";

const linkClass =
  "block text-[14.5px] mb-3 transition-colors duration-150 hover:text-white";

export default function Footer() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // On the home page, intercept and smooth-scroll WITHOUT writing the hash to
  // the URL. On any other route, let the <Link> navigate to /#id so the home
  // page loads and jumps to the section.
  function handleSectionClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) {
    if (isHome) {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <footer style={{ backgroundColor: "var(--color-footer)" }}>
      <div className="w-[min(1200px,92vw)] mx-auto pt-16 pb-8">
        {/* Main grid */}
        <div
          className="footer-grid grid gap-10"
          style={{
            gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
          }}
        >
          {/* Col 1: Brand */}
          <div>
            <Image
              src="/logos/nodo bco.png"
              alt="Nodo Core"
              height={26}
              width={78}
              className="h-[26px] w-auto mb-5"
            />
            <p
              className="text-[14.5px] leading-relaxed max-w-[260px]"
              style={{ color: "rgba(255,255,255,.66)" }}
            >
              El ecosistema que centraliza, conecta y potencia. Un holding
              tecnológico-productivo construido sobre la transparencia.
            </p>

            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-white/70 transition-colors duration-150 hover:text-white hover:border-white/40"
                >
                  <Icon className="h-[17px] w-[17px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Ecosistema */}
          <div>
            <span className={colHeaderClass}>Ecosistema</span>
            <ul className="list-none m-0 p-0">
              {ecosystemLinks.map((item) => (
                <li key={item}>
                  <a
                    href={`/nodo-${item.toLowerCase()}`}
                    className={linkClass}
                    style={{ color: "rgba(255,255,255,.74)" }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Empresa */}
          <div>
            <span className={colHeaderClass}>Empresa</span>
            <ul className="list-none m-0 p-0">
              {companyLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/#${item.id}`}
                    onClick={(e) => handleSectionClick(e, item.id)}
                    className={linkClass}
                    style={{ color: "rgba(255,255,255,.74)" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 mt-12 pt-6 text-[13px]"
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.4)",
          }}
        >
          <span>© 2026 Nodo Core. Todos los derechos reservados.</span>
          <span>Transparencia tecnológica</span>
        </div>
      </div>
    </footer>
  );
}
