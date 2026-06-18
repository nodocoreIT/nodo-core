/** Public base URL for links in emails (verification, password reset, etc.). */
export function resolveRegistrationOrigin(clientOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;

  if (
    clientOrigin &&
    !clientOrigin.includes("localhost") &&
    !clientOrigin.includes("127.0.0.1")
  ) {
    return clientOrigin.replace(/\/$/, "");
  }

  return (clientOrigin ?? "http://localhost:3000").replace(/\/$/, "");
}
