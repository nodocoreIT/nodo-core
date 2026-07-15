import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { Toaster } from "react-hot-toast";
import { getThemeConfig } from "@/lib/theme/getThemeConfig";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mitienda.com";

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getThemeConfig();

  const icons: Metadata["icons"] = theme.favicon_url
    ? { icon: theme.favicon_url }
    : {
        icon: [
          { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
          { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
          { url: "/favicon.ico" },
        ],
        apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
        other: [
          { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
          { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
        ],
      };

  return {
    metadataBase: new URL(SITE_URL),
    icons,
    title: {
      default: theme.site_name,
      template: `%s | ${theme.site_name}`,
    },
    description: theme.site_tagline,
    keywords: [theme.site_name],
    authors: [{ name: theme.site_name }],
    creator: theme.site_name,
    openGraph: {
      type: "website",
      locale: "es_AR",
      url: SITE_URL,
      siteName: theme.site_name,
      title: theme.site_name,
      description: theme.site_tagline,
      images: theme.logo_url ? [{ url: theme.logo_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: theme.site_name,
      description: theme.site_tagline,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const umamiUrl =
    process.env.NEXT_PUBLIC_UMAMI_URL || "https://analytics.umami.is/script.js";

  const theme = await getThemeConfig();

  const themeCss = `
:root {
  --color-gold: ${theme.color_primary};
  --color-gold-light: ${theme.color_primary_light};
  --color-gold-dark: ${theme.color_primary_dark};
  --color-luxury-black: ${theme.color_bg};
  --color-luxury-gray: ${theme.color_surface};
  --color-text: ${theme.color_text};
  --color-nav-subcategory: ${theme.color_nav_subcategory};
}
html[data-theme="light"], [data-theme="light"] {
  --color-gold: ${theme.light_color_primary};
  --color-gold-light: ${theme.light_color_primary_light};
  --color-gold-dark: ${theme.light_color_primary_dark};
  --color-luxury-black: ${theme.light_color_bg};
  --color-luxury-gray: ${theme.light_color_surface};
  --color-text: ${theme.light_color_text};
  --color-nav-subcategory: ${theme.light_color_nav_subcategory};
}`;

  const siteTheme = ((theme.site_theme as string) === 'light' ? 'light' : 'dark') as 'dark' | 'light';

  return (
    <html lang="es-AR" className="h-full dark" data-theme={siteTheme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
        {/* Runtime theme CSS variables — overrides @theme compile-time defaults */}
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white antialiased transition-colors duration-300">
        <Suspense>
          <ScrollToTop />
        </Suspense>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--color-luxury-black)",
              color: "white",
              border: "1px solid var(--color-luxury-gray)",
              fontSize: "14px",
              padding: "12px 24px",
              borderRadius: "0px",
            },
          }}
        />

        {umamiId && (
          <Script
            src={umamiUrl}
            data-website-id={umamiId}
            strategy="afterInteractive"
            defer
          />
        )}
      </body>
    </html>
  );
}
