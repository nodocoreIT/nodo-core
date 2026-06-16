import {
  MessageCircle,
  Mail,
  CreditCard,
  Share2,
  Table,
  Zap,
  CheckCircle2,
  Clock,
  Settings,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { AUTOMATIONS } from "../automation-definitions";
import type { AutomationDef, AutomationStatus } from "../types";

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_META = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, iconClass: "text-green-500" },
  email:    { label: "Email",    icon: Mail,          iconClass: "text-blue-500"  },
  payments: { label: "Pagos",    icon: CreditCard,    iconClass: "text-green-600" },
  social:   { label: "Redes Sociales", icon: Share2,  iconClass: "text-purple-500"},
  sheets:   { label: "Google Sheets",  icon: Table,   iconClass: "text-emerald-500"},
  internal: { label: "Internos", icon: Zap,           iconClass: "text-brand"     },
} as const;

const CATEGORY_ORDER: Array<keyof typeof CATEGORY_META> = [
  "whatsapp",
  "internal",
  "payments",
  "email",
  "sheets",
  "social",
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AutomationStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Activo
      </span>
    );
  }
  if (status === "coming_soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" />
        Próximamente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      <Settings className="h-3 w-3" />
      Sin configurar
    </span>
  );
}

// ── Automation card ───────────────────────────────────────────────────────────

function AutomationCard({ automation }: { automation: AutomationDef }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {automation.title}
        </p>
        <StatusBadge status={automation.status} />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {automation.description}
      </p>
      {automation.configHint && (
        <p className="text-xs text-muted-foreground/70 border-t border-border pt-3">
          {automation.configHint}
        </p>
      )}
    </div>
  );
}

// ── Category group ────────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
}: {
  category: keyof typeof CATEGORY_META;
  items: AutomationDef[];
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", meta.iconClass)} />
        <h2 className="text-base font-semibold text-foreground">{meta.label}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((automation) => (
          <AutomationCard key={automation.id} automation={automation} />
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AutomationsPage() {
  const byCategory = CATEGORY_ORDER.reduce<
    Partial<Record<keyof typeof CATEGORY_META, AutomationDef[]>>
  >((acc, cat) => {
    const items = AUTOMATIONS.filter((a) => a.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Automatizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Conectá tu inmobiliaria con las herramientas que ya usás
        </p>
      </div>

      {/* Category groups */}
      {CATEGORY_ORDER.map((cat) => {
        const items = byCategory[cat];
        if (!items?.length) return null;
        return <CategoryGroup key={cat} category={cat} items={items} />;
      })}
    </div>
  );
}
