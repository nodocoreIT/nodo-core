"use client";

import { useState } from "react";
import { X, Send, CheckCircle2 } from "lucide-react";

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewsletterModal({
  isOpen,
  onClose,
}: NewsletterModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    // Simulación de envío (luego podés conectar con Mailchimp o similar)
    setTimeout(() => {
      setStatus("success");
      setEmail("");
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 3000);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-luxury-black border border-gold/30 max-w-lg w-full p-8 md:p-12 shadow-2xl shadow-black">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {status === "success" ? (
          <div className="text-center py-8 animate-fade-in">
            <CheckCircle2 className="text-gold w-16 h-16 mx-auto mb-6" />
            <h3 className="text-2xl font-serif text-white mb-2">
              ¡Bienvenido a la Colección!
            </h3>
            <p className="text-gray-400">
              Te has suscrito correctamente. Pronto recibirás nuestras novedades
              exclusivas.
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h3 className="text-gold text-xs font-bold tracking-[0.3em] uppercase mb-4">
                Newsletter
              </h3>
              <h2 className="font-serif text-3xl text-white mb-4">
                Sé parte de la exclusividad
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Suscribite para recibir lanzamientos anticipados, eventos
                privados y consejos de perfumería de lujo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu correo electrónico"
                  className="w-full bg-black border border-luxury-gray text-white px-4 py-4 focus:outline-none focus:border-gold transition-colors placeholder:text-gray-700"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-gold text-black font-bold py-4 uppercase tracking-widest text-xs hover:bg-gold-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  "Procesando..."
                ) : (
                  <>
                    Suscribirme <Send size={14} />
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-gray-600 text-center mt-6 uppercase tracking-widest">
              Privacidad garantizada. Sin spam.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
