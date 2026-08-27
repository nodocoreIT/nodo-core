"use client";

import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

export function SidebarAdSpace() {
  return (
    <Card className="border-slate-200 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Espacio publicitario
          </p>
          <a
            href="https://www.instagram.com/fusionsaludsr/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <Image
              src="/publicidades/fusionsalud.webp"
              alt="Fusión Salud"
              width={180}
              height={180}
              className="max-w-[160px] h-auto"
            />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
