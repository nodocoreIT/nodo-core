/**
 * Resolves the public base URL of the app.
 *
 * Lives in its own module (no other imports) so it can be used both from
 * payment/notification code and from email templates without creating an
 * import cycle (email/resend.ts -> email/clinic-email-layout.ts, while
 * clinic/appointment-payment.ts -> email/resend.ts).
 */
export function appBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.CLINIC_APP_URL?.trim()) {
    return process.env.CLINIC_APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_BASE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/$/, "");
  }
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return `https://${vercelProduction.replace(/\/$/, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return "https://clinica.nodocore.com.ar";
  }
  return "http://localhost:3002";
}
