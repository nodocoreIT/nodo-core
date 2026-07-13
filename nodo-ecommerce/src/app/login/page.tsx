"use client";

import { Suspense, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/cuenta";
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem("site-theme") as "dark" | "light" | null;
    const t = stored ?? (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
    setTheme(t);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Credenciales incorrectas. Verificá tu email y contraseña.");
        setLoading(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setSuccess("Revisá tu email para confirmar tu cuenta.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
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
          <p className="text-[#555555] text-xs tracking-[0.3em] uppercase mt-2">Acceso de Clientes</p>
        </div>

        {/* Tabs */}
        <div className="flex border border-luxury-gray mb-0">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 py-3 text-xs tracking-[0.2em] uppercase font-bold transition-colors ${
              mode === "login"
                ? "bg-gold text-black"
                : "bg-luxury-black text-luxury-gray-light hover:text-white"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-3 text-xs tracking-[0.2em] uppercase font-bold transition-colors ${
              mode === "register"
                ? "bg-gold text-black"
                : "bg-luxury-black text-luxury-gray-light hover:text-white"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-luxury-black border border-t-0 border-luxury-gray p-8 space-y-5"
        >
          {mode === "register" && (
            <div>
              <label className="text-luxury-gray-light text-xs tracking-widest uppercase block mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-luxury-gray border border-luxury-gray-mid text-white placeholder-[#555555] px-4 py-3 focus:outline-none focus:border-gold transition-colors text-sm"
                placeholder="Tu nombre"
              />
            </div>
          )}

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
              placeholder="tu@email.com"
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

          {success && (
            <p className="text-green-400 text-xs bg-green-400/10 border border-green-400/20 px-3 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-black font-bold py-3 tracking-widest text-sm uppercase hover:bg-gold-light transition-colors disabled:opacity-70"
          >
            {loading
              ? mode === "login"
                ? "Ingresando..."
                : "Creando cuenta..."
              : mode === "login"
              ? "Ingresar"
              : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
