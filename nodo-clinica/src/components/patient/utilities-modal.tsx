"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PharmacyOnCallCard } from "@/components/patient/pharmacy-on-call-card";
import { MedicalDirectoryCard } from "@/components/patient/medical-directory-card";
import { FlaskConical, Scan } from "lucide-react";

export function UtilitiesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-4xl h-[85vh] flex flex-col gap-0 p-6 overflow-hidden">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="text-2xl">Utilidades y servicios útiles</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="farmacias" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 shrink-0 mb-4">
            <TabsTrigger value="farmacias">Farmacias</TabsTrigger>
            <TabsTrigger value="laboratorios">Laboratorios</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1 pr-4">
              <TabsContent value="farmacias" className="mt-0">
                <PharmacyOnCallCard />
              </TabsContent>

              <TabsContent value="laboratorios" className="mt-0">
                <MedicalDirectoryCard
                  category="laboratorio"
                  title="Laboratorios de análisis clínicos"
                  icon={FlaskConical}
                  tone="sky"
                  emptyLabel="Todavía no se cargó el listado de laboratorios."
                />
              </TabsContent>

              <TabsContent value="diagnostico" className="mt-0">
                <MedicalDirectoryCard
                  category="diagnostico_imagenes"
                  title="Diagnóstico por imágenes"
                  icon={Scan}
                  tone="violet"
                  emptyLabel="Todavía no se cargó el listado de centros de diagnóstico."
                />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
