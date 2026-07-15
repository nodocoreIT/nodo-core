"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Mail, Clock } from "lucide-react";
import InstagramIcon from "@/components/ui/InstagramIcon";
import { SITE_CONFIG } from "@/constants/site";
import NewsletterModal from "../ui/NewsletterModal";

interface ContactConfig {
  whatsapp?: string
  instagram?: string
  tiktok?: string
  facebook?: string
  contact_address?: string
  contact_horarios?: string
  contact_email?: string
}

const TikTokIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z" />
  </svg>
);

export default function Footer({ contact = {} }: { contact?: ContactConfig }) {
  const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);

  const phone = contact.whatsapp || SITE_CONFIG.contact.phone
  const address = contact.contact_address || SITE_CONFIG.contact.address
  const horarios = contact.contact_horarios || ''
  const email = contact.contact_email || SITE_CONFIG.contact.email
  const instagram = contact.instagram || SITE_CONFIG.social.instagram
  const tiktok = contact.tiktok || SITE_CONFIG.social.tiktok

  return (
    <footer className="bg-black border-t border-luxury-gray mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {/* Horarios */}
          <div>
            <h4 className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-4">
              Horarios de Atención
            </h4>
            {horarios ? (
              <div className="flex items-start gap-2 text-gray-400 text-sm">
                <Clock size={15} className="text-gold mt-0.5 shrink-0" />
                <p className="whitespace-pre-line">{horarios}</p>
              </div>
            ) : phone ? (
              <a
                href={`https://wa.me/${phone}?text=${encodeURIComponent("Hola, me interesa saber los días y horarios de atención.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 text-sm hover:text-gold transition-colors duration-200 underline underline-offset-2"
              >
                Consultanos por WhatsApp
              </a>
            ) : null}
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-4">
              Contacto & Ubicación
            </h4>
            <div className="space-y-3">
              {address && (
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gold mt-0.5 shrink-0" />
                  <p className="text-gray-500 text-sm">{address}</p>
                </div>
              )}

              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 text-gray-500 hover:text-gold transition-colors text-sm"
                >
                  <Mail size={15} className="text-gold shrink-0" />
                  {email}
                </a>
              )}

              {phone && (
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-500 hover:text-gold transition-colors text-sm"
                >
                  <img src="/what.png" alt="WhatsApp" className="w-4 h-4 rounded-full object-cover" />
                  {phone}
                </a>
              )}

              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-500 hover:text-gold transition-colors text-sm"
                >
                  <InstagramIcon size={16} className="text-gold" />
                  {instagram.replace("https://www.instagram.com/", "@").replace(/\/$/, "")}
                </a>
              )}

              {tiktok && (
                <a
                  href={tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-500 hover:text-gold transition-colors text-sm"
                >
                  <span className="text-gold"><TikTokIcon size={16} /></span>
                  {tiktok.replace("https://www.tiktok.com/", "")}
                </a>
              )}
            </div>
          </div>

          {/* Novedades / Newsletter */}
          <div>
            <h4 className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-4">
              Novedades
            </h4>
            <div className="space-y-4">
              <p className="text-gray-500 text-sm leading-relaxed">
                Suscribite para recibir lanzamientos exclusivos y novedades de nuestra colección.
              </p>
              <button
                onClick={() => setIsNewsletterOpen(true)}
                className="w-full bg-luxury-gray text-gold border border-gold/20 hover:border-gold hover:bg-gold hover:text-black transition-all duration-300 font-bold py-3 text-xs tracking-widest uppercase"
              >
                Suscribirme al Newsletter
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-luxury-gray mt-12 pt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-luxury-gray-light text-xs font-bold tracking-wider uppercase">
            © {new Date().getFullYear()} {SITE_CONFIG.name} — Todos los derechos reservados.
          </p>
          <p className="text-gray-400 text-xs">
            Página web desarrollada por{" "}
            <a
              href="https://www.nodocore.com.ar/nodo-it"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:font-bold transition-all"
            >
              NODO Core
            </a>
          </p>
        </div>
      </div>

      <NewsletterModal 
        isOpen={isNewsletterOpen} 
        onClose={() => setIsNewsletterOpen(false)} 
      />
    </footer>
  );
}
