"use client";

import { Card, CardContent } from "@/components/ui/card";

export function SidebarAdSpace() {
  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center gap-3">
          <div className="text-4xl text-slate-300">📢</div>
          <p className="text-sm font-medium text-slate-600">
            Espacio para publicidad
          </p>
          <p className="text-xs text-slate-500">
            Próximamente ofertas especiales para pacientes
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
