import { cn } from "@/shared/lib/utils";

export type VehicleTab = "datos" | "fotos" | "qr" | "documentacion" | "notas";

const TAB_LABELS: Record<VehicleTab, string> = {
  datos: "Datos",
  fotos: "Fotos",
  qr: "QR",
  documentacion: "Documentación",
  notas: "Notas",
};

interface VehicleTabBarProps {
  activeTab: VehicleTab;
  onChange: (tab: VehicleTab) => void;
  showExtendedTabs?: boolean;
}

export function VehicleTabBar({ activeTab, onChange, showExtendedTabs = true }: VehicleTabBarProps) {
  const tabs: VehicleTab[] = showExtendedTabs
    ? ["datos", "fotos", "qr", "documentacion", "notas"]
    : ["datos", "fotos", "notas"];

  return (
    <nav className="flex gap-1 border-b border-mist" aria-label="Secciones del vehículo">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === tab
              ? "border-brand text-brand"
              : "border-transparent text-slate2 hover:text-navy hover:border-mist",
          )}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
