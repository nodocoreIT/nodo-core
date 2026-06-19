/** Fades out and removes the static splash from index.html (kept until app is ready). */
export function hideAppSplash(): void {
  const splash = document.getElementById("nodo-splash");
  if (!splash) return;
  splash.style.opacity = "0";
  window.setTimeout(() => splash.remove(), 300);
}
