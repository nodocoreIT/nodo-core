import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { ThemeTab } from "./theme-tab";
import { SectionsTab } from "./sections-tab";
import { NavigationTab } from "./navigation-tab";
import { DomainTab } from "./domain-tab";

type TabId = "theme" | "sections" | "navigation" | "domain";

const TABS: { id: TabId; label: string }[] = [
  { id: "theme", label: "Apariencia" },
  { id: "sections", label: "Secciones" },
  { id: "navigation", label: "Navegación" },
  { id: "domain", label: "Dominio" },
];

export function StoreBuilderPage() {
  const [activeTab, setActiveTab] = useState<TabId>("theme");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Mi tienda</h1>
        <p className="text-sm text-slate2 mt-1">
          Personalizá la apariencia y contenido de tu tienda online.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "theme" && <ThemeTab />}
        {activeTab === "sections" && <SectionsTab />}
        {activeTab === "navigation" && <NavigationTab />}
        {activeTab === "domain" && <DomainTab />}
      </div>
    </div>
  );
}
