"use client";

import { useState, useEffect } from "react";
import { X, Mail, CheckCircle2 } from "lucide-react";

interface Props {
  title?: string
  body?: string
  footer?: string
}

export default function NewsletterModal({ title, body, footer }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Check if the user has already seen or dismissed the modal
    const hasSeenNewsletter = localStorage.getItem("newsletter-dismissed");

    if (!hasSeenNewsletter) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000); // 3 seconds delay

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem("newsletter-dismissed", "true");
    }, 300); // Wait for fade out animation
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // Simulate API call
      setIsSubscribed(true);
      setTimeout(() => {
        handleClose();
      }, 2500);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative bg-zinc-900 border border-gold/30 w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.15)] transition-all duration-500 transform ${isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        {/* Decorative Gold Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-gold transition-colors z-10"
          aria-label="Cerrar"
        >
          <X size={24} />
        </button>

        <div className="p-8 md:p-12 text-center">
          {!isSubscribed ? (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center border border-gold/20">
                  <Mail className="text-gold" size={32} />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-serif text-white tracking-tight">
                  {title ?? 'Unite a la Elite'}
                </h2>
                <p className="text-zinc-400 text-sm md:text-base max-w-xs mx-auto">
                  {body ?? 'Suscribite para recibir lanzamientos exclusivos, ofertas privadas y novedades.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Tu correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-zinc-800 focus:border-gold outline-none px-4 py-3 text-white transition-all text-sm tracking-wide"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gold hover:bg-gold-light text-black font-bold py-3 text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-lg"
                >
                  Suscribirme
                </button>
              </form>

              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
                {footer ?? 'Sin spam. Solo exclusividad.'}
              </p>
            </div>
          ) : (
            <div className="py-12 space-y-6 animate-fade-in">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
                  <CheckCircle2 className="text-green-500" size={48} />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-serif text-white">¡Bienvenido!</h2>
                <p className="text-zinc-400 text-sm">
                  Gracias por suscribirte. Pronto recibirás nuestras novedades.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
