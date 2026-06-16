import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { useThemeSettings, useThemeStore } from "@/shared/hooks/use-theme-settings";
import { useFinanzasThemeSync } from "@/shared/hooks/use-finanzas-theme-sync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeInitializer({ children }: { children: ReactNode }) {
  useFinanzasThemeSync();
  useThemeSettings();
  return <>{children}</>;
}

// Re-export store for consumers that need direct access
export { useThemeStore };

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer>
        {children}
        <Toaster richColors position="top-right" />
      </ThemeInitializer>
    </QueryClientProvider>
  );
}
