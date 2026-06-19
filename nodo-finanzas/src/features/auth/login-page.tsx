import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { enforceNodeAccess, INVALID_LOGIN_MESSAGE, mustSetPassword } from '@nodocore/shared-components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'register';

function landingApiBase(): string {
  const configured = import.meta.env.VITE_NODO_LANDING_URL?.replace(/\/$/, '');
  if (configured) return configured;
  return window.location.origin;
}

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleForcedPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim().length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('La sesión expiró. Volvé a iniciar sesión.');
      setNeedsNewPassword(false);
      setLoading(false);
      return;
    }

    const res = await fetch(`${landingApiBase()}/api/auth/complete-forced-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'No se pudo actualizar la contraseña.');
      setLoading(false);
      return;
    }

    await supabase.auth.refreshSession();
    setNeedsNewPassword(false);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(INVALID_LOGIN_MESSAGE);
      } else {
        const access = await enforceNodeAccess(supabase, 'Finanzas');
        if (!access.ok) {
          setError(access.message);
        } else if (mustSetPassword(data.session)) {
          setNeedsNewPassword(true);
          setPassword('');
          setConfirmPassword('');
        }
      }
    } else {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) {
        setError(authError.message);
      } else {
        setSuccess('¡Cuenta creada! Revisá tu email para confirmar el registro.');
        setEmail('');
        setPassword('');
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError(null);
    setSuccess(null);
    setNeedsNewPassword(false);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10">
            <DollarSign className="h-6 w-6 text-brand" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-navy font-display">Finanzas Personales</h1>
            <p className="text-xs text-slate2 mt-1">
              {needsNewPassword
                ? 'Definí tu nueva contraseña'
                : mode === 'login'
                  ? 'Ingresá a tu cuenta'
                  : 'Crear cuenta nueva'}
            </p>
          </div>
        </div>

        {needsNewPassword ? (
          <form onSubmit={handleForcedPassword} className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Repetir contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Guardando…' : 'Continuar'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Cargando…' : mode === 'login' ? 'Ingresar' : 'Registrarse'}
            </Button>
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-brand hover:underline"
            >
              {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
