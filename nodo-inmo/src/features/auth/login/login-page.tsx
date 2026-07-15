/**
 * LoginPage — email + password form using shadcn primitives.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import {
  useAuth,
  useSupabase,
  enforceNodeAccess,
  mapAuthLoginError,
  fetchMustSetPassword,
  RequiredPasswordForm,
} from "@nodocore/shared-components";
import { acceptPendingInvitations } from "@/shared/lib/accept-pending-invitations";
import { Card, CardContent, CardHeader } from "@nodocore/shared-components";
import { BrandMark } from "@/shared/components/brand-mark";
import { Input } from "@nodocore/shared-components";
import { Label } from "@nodocore/shared-components";
import { Button } from "@nodocore/shared-components";

const ACCENT = '#DA5A0E';
const ACCENT_RGB = '218,90,14';

export function LoginPage() {
  const { signInWithPassword } = useAuth();
  const supabase = useSupabase();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      return;
    }

    setError(null);
    setLoading(true);

    const { error: authError } = await signInWithPassword({ email, password });

    if (authError) {
      setError(mapAuthLoginError(authError.message));
      setLoading(false);
      return;
    }

    // Auto-accept any pending invitations before checking access.
    await acceptPendingInvitations(supabase);

    const access = await enforceNodeAccess(supabase, "Inmo");
    if (!access.ok) {
      setError(access.message);
      setLoading(false);
      return;
    }

    if (await fetchMustSetPassword(supabase)) {
      setNeedsNewPassword(true);
      setLoading(false);
      return;
    }

    navigate("/");
    setLoading(false);
  }

  return (
    <div className="min-h-screen grid grid-cols-1 login-split">
      {/* ── Left branding panel ── */}
      <aside
        className="login-brand-panel relative overflow-hidden text-white p-12 hidden"
        style={{ backgroundColor: '#121e2f' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(72% 58% at 38% 42%, rgba(${ACCENT_RGB},.22), transparent 72%)`,
          }}
        />

        {/* Top logo */}
        <div className="relative z-[1]">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'white', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>nodo</span>
            <span style={{ color: ACCENT, fontWeight: 600 }}>| Inmo</span>
          </div>
        </div>

        {/* Center lockup */}
        <div className="relative z-[1] flex flex-1 flex-col items-center justify-center py-8">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `rgba(${ACCENT_RGB},0.15)`,
                border: `1px solid rgba(${ACCENT_RGB},0.35)`,
                color: ACCENT,
              }}
            >
              <Building2 aria-hidden className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="flex items-center gap-[0.4em] flex-wrap">
              <span
                aria-hidden
                className="font-light leading-none"
                style={{ fontSize: 'clamp(30px,3vw,40px)', color: 'rgba(255,255,255,0.3)' }}
              >
                nodo
              </span>
              <span
                aria-hidden
                className="font-light leading-none"
                style={{ fontSize: 'clamp(30px,3vw,40px)', color: 'rgba(234,240,247,.3)' }}
              >
                |
              </span>
              <span
                className="font-display font-extrabold text-white"
                style={{ fontSize: 'clamp(30px,3vw,40px)', lineHeight: 1.1 }}
              >
                Inmo
              </span>
            </div>
          </div>
        </div>

        {/* Bottom description */}
        <div
          className="relative z-[1] pt-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p
            className="max-w-[34em] text-[14.5px] leading-relaxed"
            style={{ color: 'rgba(234,240,247,.72)' }}
          >
            Administrá tus propiedades e inquilinos desde un solo lugar.
          </p>
          <p
            className="mt-8 text-[13px]"
            style={{ color: 'rgba(234,240,247,.48)' }}
          >
            © 2026 Nodo Core · Transparencia tecnológica
          </p>
        </div>
      </aside>

      {/* ── Right form panel ── */}
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Card className="w-full max-w-sm shadow-md">
          <CardHeader className="items-center">
            <BrandMark className="text-2xl" iconClassName="h-9 w-9" />
          </CardHeader>
          <CardContent>
            {needsNewPassword ? (
              <RequiredPasswordForm
                supabase={supabase}
                onSuccess={() => navigate("/")}
              />
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="login-password">Contraseña</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresé contraseña…"
                    required
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Cargando…" : "Iniciar sesión"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
