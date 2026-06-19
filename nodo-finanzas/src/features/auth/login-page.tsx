import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { enforceNodeAccess, INVALID_LOGIN_MESSAGE } from '@nodocore/shared-components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(INVALID_LOGIN_MESSAGE);
      } else {
        const access = await enforceNodeAccess(supabase, 'Finanzas');
        if (!access.ok) setError(access.message);
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
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10">
            <DollarSign className="h-6 w-6 text-brand" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-navy font-display">Finanzas Personales</h1>
            <p className="text-xs text-slate2 mt-1">
              {mode === 'login' ? 'Ingresá a tu cuenta' : 'Crear cuenta nueva'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresé contraseña…"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-brand bg-mist border border-brand/20 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
            {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
        </form>

        {/* Toggle */}
        <p className="text-center text-xs text-slate2 mt-6">
          {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
          <button type="button" onClick={toggleMode} className="text-brand font-medium hover:underline">
            {mode === 'login' ? 'Registrate' : 'Ingresá'}
          </button>
        </p>
      </div>
    </div>
  );
}
