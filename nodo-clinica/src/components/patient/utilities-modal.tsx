"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <DialogContent className="w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Utilidades y servicios útiles</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="farmacias" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 shrink-0">
              <TabsTrigger value="farmacias">Farmacias</TabsTrigger>
              <TabsTrigger value="laboratorios">Laboratorios</TabsTrigger>
              <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
            </TabsList>

            <TabsContent value="farmacias" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden">
              <PharmacyOnCallCard />
            </TabsContent>

            <TabsContent value="laboratorios" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden">
              <MedicalDirectoryCard
                category="laboratorio"
                title="Laboratorios de análisis clínicos"
                icon={FlaskConical}
                tone="sky"
                emptyLabel="Todavía no se cargó el listado de laboratorios."
              />
            </TabsContent>

            <TabsContent value="diagnostico" className="mt-4 flex-1 overflow-y-auto overflow-x-hidden">
              <MedicalDirectoryCard
                category="diagnostico_imagenes"
                title="Diagnóstico por imágenes"
                icon={Scan}
                tone="violet"
                emptyLabel="Todavía no se cargó el listado de centros de diagnóstico."
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
