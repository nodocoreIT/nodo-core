import { useState, type FormEvent } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Eye, EyeOff } from "lucide-react";

export type PasswordResetPanelProps = {
  /** Node label for headings, e.g. "Nodo Finanzas Personales". */
  nodeLabel?: string;
  /** Called with the new password; return an error message or null on success. */
  onResetPassword: (password: string) => Promise<string | null>;
  onSuccess?: () => void;
  className?: string;
};

/**
 * Shared password recovery form — new password + confirm.
 * Used from landing login routes and can be embedded in any nodo portal.
 */
export function PasswordResetPanel({
  nodeLabel = "NODO",
  onResetPassword,
  onSuccess,
  className,
}: PasswordResetPanelProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setGeneralError(null);

    if (password.trim().length < 6) {
      setFieldError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const message = await onResetPassword(password.trim());
    setLoading(false);

    if (message) {
      setGeneralError(message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={className}>
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--color-brand-kicker,var(--color-brand,#DA5A0E))]">
        ◎ Restablecer contraseña
      </span>
      <h1 className="font-display font-bold text-ink text-[26px] mt-2 mb-1">
        Nueva contraseña
      </h1>
      <p className="text-slate2 text-[14.5px] mb-6">
        Ingresá una nueva contraseña segura para tu cuenta en {nodeLabel}.
      </p>

      <div className="mb-4 space-y-2">
        <Label htmlFor="shared-reset-pass">Nueva contraseña</Label>
        <div className="relative">
          <Input
            id="shared-reset-pass"
            type={showPassword ? "text" : "password"}
            placeholder="Ingresé contraseña…"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldError(null);
            }}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-0 cursor-pointer"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <Label htmlFor="shared-reset-pass-confirm">Confirmar contraseña</Label>
        <div className="relative">
          <Input
            id="shared-reset-pass-confirm"
            type={showConfirm ? "text" : "password"}
            placeholder="Repetí la contraseña…"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldError(null);
            }}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 bg-transparent border-none p-0 cursor-pointer"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldError && (
          <p className="text-[12.5px] text-[#C0392B] mt-1.5">{fieldError}</p>
        )}
      </div>

      {generalError && (
        <p className="text-[13px] text-[#C0392B] mb-3 text-center">{generalError}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-md bg-[var(--color-brand,#DA5A0E)] text-[var(--color-brand-on,#ffffff)] font-semibold text-[15px] hover:bg-[var(--color-brand-600,#C04E0B)] active:scale-[.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? "Restableciendo…" : "Restablecer contraseña"}
      </button>
    </form>
  );
}
