"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Share2, Save, CheckCircle, Phone } from "lucide-react";

interface Props {
  config: Record<string, string>;
}

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function RedesSocialesClient({ config: initial }: Props) {
  const [form, setForm] = useState({
    instagram: initial.instagram || "",
    whatsapp: initial.whatsapp || "",
    facebook: initial.facebook || "",
    tiktok: initial.tiktok || "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const entries = Object.entries(form).map(([clave, valor]) => ({
      clave,
      valor,
      updated_at: new Date().toISOString(),
    }));

    const { error: err } = await supabase
      .from("configuracion")
      .upsert(entries, { onConflict: "clave" });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const FIELDS = [
    {
      key: "instagram" as const,
      label: "Instagram (URL completa)",
      placeholder: "https://www.instagram.com/mitienda/",
      icon: <span className="text-pink-400">✦</span>,
    },
    {
      key: "whatsapp" as const,
      label: "WhatsApp (número con código de país, sin +)",
      placeholder: "549XXXXXXXXXX",
      icon: <Phone size={16} className="text-green-400" />,
    },
    {
      key: "facebook" as const,
      label: "Facebook (URL completa)",
      placeholder: "https://www.facebook.com/...",
      icon: <span className="text-blue-400"><FacebookIcon /></span>,
    },
    {
      key: "tiktok" as const,
      label: "TikTok (URL completa)",
      placeholder: "https://www.tiktok.com/@...",
      icon: <span className="text-white"><TikTokIcon /></span>,
    },
  ];

  return (
    <>
      <div className="mb-8">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
        <h1 className="text-white text-2xl font-serif">Redes Sociales</h1>
        <p className="text-[#555555] text-sm mt-1">
          Estos datos se usan en el sitio web (footer, banners, CTAs).
        </p>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSubmit} className="bg-luxury-black border border-luxury-gray p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-luxury-gray">
            <Share2 size={18} className="text-gold" />
            <h2 className="text-white text-sm font-semibold tracking-wider uppercase">Contacto y redes</h2>
          </div>

          {FIELDS.map(({ key, label, placeholder, icon }) => (
            <div key={key}>
              <label className="block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5 flex items-center gap-2">
                {icon} {label}
              </label>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full bg-luxury-black border border-luxury-gray-mid text-white px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-gold text-black font-bold px-6 py-3 text-sm tracking-wider hover:bg-gold-light transition-colors disabled:opacity-50 w-full justify-center"
          >
            {saved ? (
              <><CheckCircle size={16} /> Guardado</>
            ) : loading ? (
              <><span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><Save size={16} /> Guardar cambios</>
            )}
          </button>
        </form>

        {/* Vista previa links activos */}
        <div className="mt-4 bg-luxury-black border border-luxury-gray p-4">
          <p className="text-[#555555] text-xs mb-3 uppercase tracking-wider">Links activos</p>
          <div className="space-y-2">
            {FIELDS.map(({ key, label }) => (
              form[key] ? (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-[#555555]">{label.split(" (")[0]}</span>
                  <a href={key === "whatsapp" ? `https://wa.me/${form[key]}` : form[key]}
                    target="_blank" rel="noopener noreferrer"
                    className="text-gold hover:underline truncate max-w-[200px]">
                    {key === "whatsapp" ? `wa.me/${form[key]}` : form[key].replace("https://", "")}
                  </a>
                </div>
              ) : null
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
