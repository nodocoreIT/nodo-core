import type { Metadata } from "next";
import { Sora, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nodo | Clinicas",
  description:
    "Telemedicina profesional con agenda, videoconsultas, historial clínico e informes con IA.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${hanken.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <AppProviders>
          <ThemeProvider>
            {children}
            <Toaster
  position="top-center"
  richColors
  style={{
    top: "50%",
    transform: "translateY(-50%)",
  }}
/>
          </ThemeProvider>
        </AppProviders>
      </body>
    </html>
  );
}
