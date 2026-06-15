import { useState } from "react";
import { DoctorSchedulePanel } from "@/features/schedule/doctor-schedule-panel";
import { DoctorOfficePanel } from "@/features/schedule/doctor-office-panel";

type ConfigTab = "disponibilidad" | "consultorio";

const TABS: { key: ConfigTab; label: string }[] = [
  { key: "disponibilidad", label: "Disponibilidad" },
  { key: "consultorio", label: "Consultorio" },
];

export function MedicoConfigPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("disponibilidad");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-navy mb-6">
        Configuración del consultorio
      </h1>

      <div className="flex border-b border-mist mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              "flex-1 pb-3 text-sm font-semibold transition-colors border-b-2",
              activeTab === key
                ? "border-brand text-brand"
                : "border-transparent text-slate2 hover:text-navy",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "disponibilidad" && <DoctorSchedulePanel />}
      {activeTab === "consultorio" && <DoctorOfficePanel />}
    </div>
  );
}
