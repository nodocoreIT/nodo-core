/** Set by nodo-landing login before redirect — avoids a second "Entrando a" screen. */
export const FINANZAS_SKIP_SPLASH_KEY = "nodo-finanzas-skip-splash";

/** Fades out and removes the static splash from index.html (kept until app is ready). */
export function hideAppSplash(): void {
  document.documentElement.classList.remove("nodo-skip-splash");
  const splash = document.getElementById("nodo-splash");
  if (!splash) return;
  splash.style.opacity = "0";
  window.setTimeout(() => splash.remove(), 300);
}

/** Remove splash immediately when landing already showed the transition overlay. */
export function consumeSkipSplashFlag(): void {
  try {
    if (sessionStorage.getItem(FINANZAS_SKIP_SPLASH_KEY) === "1") {
      sessionStorage.removeItem(FINANZAS_SKIP_SPLASH_KEY);
      document.getElementById("nodo-splash")?.remove();
    }
  } catch {
    // ignore
  }
}
