"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, ShoppingBag } from "lucide-react";

const ECOMMERCE_ACCENT = '#C084FC';
const ECOMMERCE_ACCENT_RGB = '192,132,252';

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem("site-theme") as "dark" | "light" | null;
    const t = stored ?? (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
    setTheme(t);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Credenciales incorrectas. Verificá tu email y contraseña.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <style>{`
        @media (min-width: 881px) {
          .ecommerce-login-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .ecommerce-brand-panel {
            display: flex !important;
          }
        }
        @media (max-width: 880px) {
          .ecommerce-brand-panel {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-black ecommerce-login-split">
        {/* ── Left branding panel ── */}
        <aside
          className="ecommerce-brand-panel relative overflow-hidden text-white p-12 flex-col justify-between hidden"
          style={{ backgroundColor: '#0a0a0a', borderRight: '1px solid #1a1a1a' }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(72% 58% at 38% 42%, rgba(${ECOMMERCE_ACCENT_RGB},.15), transparent 72%)`,
            }}
          />

          {/* Top logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>nodo</span>
              <span style={{ color: ECOMMERCE_ACCENT, fontWeight: 600 }}>| Ecommerce</span>
            </div>
          </div>

          {/* Center lockup */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: `rgba(${ECOMMERCE_ACCENT_RGB},0.12)`,
                border: `1px solid rgba(${ECOMMERCE_ACCENT_RGB},0.3)`,
                color: ECOMMERCE_ACCENT,
              }}
            >
              <ShoppingBag aria-hidden style={{ width: 36, height: 36 }} strokeWidth={1.5} />
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 'clamp(28px,3vw,38px)', fontWeight: 300 }}>nodo</span>
              <span style={{ color: 'rgba(234,240,247,.3)', fontSize: 'clamp(28px,3vw,38px)', fontWeight: 300 }}>|</span>
              <span style={{ color: 'white', fontSize: 'clamp(28px,3vw,38px)', fontWeight: 800, letterSpacing: '-0.02em' }}>Ecommerce</span>
            </div>
          </div>

          {/* Bottom description */}
          <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '32px' }}>
            <p style={{ color: 'rgba(234,240,247,.65)', fontSize: '14.5px', lineHeight: 1.7, maxWidth: '34em' }}>
              Tu tienda online con catálogo, pedidos y pagos integrados.
            </p>
            <p style={{ color: 'rgba(234,240,247,.35)', fontSize: '13px', marginTop: '32px' }}>
              © 2026 Nodo Core · Transparencia tecnológica
            </p>
          </div>
        </aside>

        {/* ── Right form panel ── */}
        <div className="flex items-center justify-center px-4 min-h-screen">
          <div className="w-full max-w-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#555555] hover:text-gold transition-colors text-[10px] tracking-[0.2em] uppercase mb-8 group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Volver a la tienda
            </Link>

            <div className="flex flex-col items-center mb-10">
              <Image
                src={theme === "light" ? "/logo_transparent_light.png" : "/logo_transparent_dark.png"}
                alt="Logo"
                width={160}
                height={80}
                className="h-32 w-auto object-contain"
                priority
              />
              <p className="text-[#555555] text-xs tracking-[0.3em] uppercase mt-2">Panel Admin</p>
            </div>

            <form
              onSubmit={handleLogin}
              className="bg-luxury-black border border-luxury-gray p-8 space-y-5"
            >
              <h1 className="text-white font-serif text-xl mb-6">Acceso Administrativo</h1>

              <div>
                <label className="text-luxury-gray-light text-xs tracking-widest uppercase block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#555555] px-4 py-3 focus:outline-none focus:border-gold transition-colors text-sm"
                  placeholder="admin@mitienda.com"
                />
              </div>

              <div>
                <label className="text-luxury-gray-light text-xs tracking-widest uppercase block mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#555555] px-4 py-3 pr-11 focus:outline-none focus:border-gold transition-colors text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-gold transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-black font-bold py-3 tracking-widest text-sm uppercase hover:bg-gold-light transition-colors disabled:opacity-70"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
