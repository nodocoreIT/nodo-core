"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Filosofía", id: "filosofia" },
  { label: "Unidades", id: "unidades" },
  { label: "Beneficios", id: "beneficios" },
  { label: "Contacto", id: "contacto" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // On the home page, intercept and smooth-scroll. On any other route, let the
  // <Link> navigate to /#id so the home page loads and jumps to the section.
  function handleSectionClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    if (isHome) {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      window.history.replaceState(null, "", `/#${id}`);
    }
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(18,30,47,.85)" : "rgba(18,30,47,.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: scrolled
          ? "1px solid rgba(255,255,255,.08)"
          : "1px solid transparent",
      }}
    >
      <div className="w-[min(1200px,92vw)] mx-auto flex items-center justify-between h-[68px]">
        {/* Logo */}
        <Link
          href="/"
          className="flex-shrink-0"
          onClick={(e) => {
            if (isHome) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <Image
            src="/logos/logo%20compuesto.png"
            alt="Nodo Core"
            height={32}
            width={137}
            className="h-[32px] w-auto"
            priority
          />
        </Link>

        {/* Center links */}
        <ul className="nav-links flex items-center gap-8 list-none m-0 p-0">
          {navLinks.map((link) => (
            <li key={link.id}>
              <Link
                href={`/#${link.id}`}
                onClick={(e) => handleSectionClick(e, link.id)}
                className="text-[14.5px] font-medium text-white/70 hover:text-white transition-colors duration-150 bg-transparent border-none cursor-pointer p-0"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right CTAs */}
      </div>
    </nav>
  );
}
